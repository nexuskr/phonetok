-- 1) earn_roulette_spins table
CREATE TABLE IF NOT EXISTS public.earn_roulette_spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  spin_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date),
  amount integer NOT NULL CHECK (amount > 0),
  base_amount integer NOT NULL CHECK (base_amount > 0),
  multiplier numeric(4,2) NOT NULL DEFAULT 1.0,
  weight_bucket text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, spin_date)
);

ALTER TABLE public.earn_roulette_spins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ers_select_own" ON public.earn_roulette_spins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "ers_admin_all" ON public.earn_roulette_spins
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_ers_user_date ON public.earn_roulette_spins(user_id, spin_date DESC);

-- 2) spin_daily_roulette() RPC
CREATE OR REPLACE FUNCTION public.spin_daily_roulette()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  _existing record;
  _roll numeric;
  _cum numeric := 0;
  _base int := 50;
  _bucket text := 'b50';
  _vip boolean := false;
  _mult numeric(4,2) := 1.0;
  _final int;
  _new_balance numeric;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
  END IF;

  -- Already spun today?
  SELECT * INTO _existing
  FROM public.earn_roulette_spins
  WHERE user_id = _uid AND spin_date = _today;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_spun', true,
      'amount', _existing.amount,
      'base_amount', _existing.base_amount,
      'multiplier', _existing.multiplier,
      'weight_bucket', _existing.weight_bucket
    );
  END IF;

  -- VIP active?
  _vip := COALESCE(public.is_vip_active(_uid), false);
  IF _vip THEN _mult := 1.5; END IF;

  -- Weighted random: total = 100
  -- 50:35, 100:30, 200:18, 500:12, 1000:4, 5000:1
  _roll := random() * 100;
  IF _roll < 35 THEN
    _base := 50; _bucket := 'b50';
  ELSIF _roll < 65 THEN
    _base := 100; _bucket := 'b100';
  ELSIF _roll < 83 THEN
    _base := 200; _bucket := 'b200';
  ELSIF _roll < 95 THEN
    _base := 500; _bucket := 'b500';
  ELSIF _roll < 99 THEN
    _base := 1000; _bucket := 'b1000';
  ELSE
    _base := 5000; _bucket := 'b5000';
  END IF;

  _final := floor(_base * _mult)::int;

  -- Insert spin log (unique constraint enforces 1/day)
  BEGIN
    INSERT INTO public.earn_roulette_spins(user_id, spin_date, amount, base_amount, multiplier, weight_bucket)
    VALUES (_uid, _today, _final, _base, _mult, _bucket);
  EXCEPTION WHEN unique_violation THEN
    -- Race: another tx beat us
    SELECT * INTO _existing
    FROM public.earn_roulette_spins
    WHERE user_id = _uid AND spin_date = _today;
    RETURN jsonb_build_object(
      'ok', true,
      'already_spun', true,
      'amount', _existing.amount,
      'multiplier', _existing.multiplier
    );
  END;

  -- Credit PHON balance (SECURITY DEFINER bypasses RLS)
  INSERT INTO public.phon_balances(user_id, balance, updated_at)
  VALUES (_uid, _final, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.phon_balances.balance + EXCLUDED.balance,
        updated_at = now()
  RETURNING balance INTO _new_balance;

  RETURN jsonb_build_object(
    'ok', true,
    'already_spun', false,
    'amount', _final,
    'base_amount', _base,
    'multiplier', _mult,
    'weight_bucket', _bucket,
    'balance_after', _new_balance,
    'vip_boost', _vip
  );
END;
$$;

REVOKE ALL ON FUNCTION public.spin_daily_roulette() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spin_daily_roulette() TO authenticated;

-- 3) Extend get_earn_hub_state with roulette + vip_boost
CREATE OR REPLACE FUNCTION public.get_earn_hub_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  _streak int := 0;
  _last_att date;
  _att_today boolean := false;
  _ref_code text;
  _ref_count int := 0;
  _ref_total bigint := 0;
  _today_earned bigint := 0;
  _mission_play boolean := false;
  _mission_invite boolean := false;
  _mission_deposit boolean := false;
  _play_today_done boolean := false;
  _share_channels text[] := ARRAY[]::text[];
  _vip boolean := false;
  _vip_exp timestamptz;
  _vip_tier text;
  _mult numeric(4,2) := 1.0;
  _roul record;
  _roul_amount int := 0;
  _roul_spun boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
  END IF;

  SELECT attendance_streak, last_attendance, referral_code
    INTO _streak, _last_att, _ref_code
  FROM public.profiles WHERE id = _uid;

  _att_today := (_last_att = _today);

  SELECT COUNT(*), COALESCE(SUM(commission), 0)
    INTO _ref_count, _ref_total
  FROM public.referral_earnings WHERE inviter_id = _uid;

  SELECT COALESCE(SUM(amount), 0) INTO _today_earned
  FROM public.daily_quick_claims
  WHERE user_id = _uid AND day = _today;

  IF _att_today THEN
    _today_earned := _today_earned + LEAST(100 + (_streak - 1) * 100, 1500);
  END IF;

  SELECT
    bool_or(kind = 'mission_play'),
    bool_or(kind = 'mission_invite'),
    bool_or(kind = 'mission_deposit'),
    bool_or(kind = 'play_today'),
    COALESCE(array_agg(kind) FILTER (WHERE kind LIKE 'share_%'), ARRAY[]::text[])
  INTO _mission_play, _mission_invite, _mission_deposit, _play_today_done, _share_channels
  FROM public.daily_quick_claims
  WHERE user_id = _uid AND day = _today;

  -- VIP boost
  SELECT active AND expires_at > now(), expires_at, tier
    INTO _vip, _vip_exp, _vip_tier
  FROM public.vip_passes WHERE user_id = _uid;
  _vip := COALESCE(_vip, false);
  IF _vip THEN _mult := 1.5; END IF;

  -- Roulette state
  SELECT * INTO _roul
  FROM public.earn_roulette_spins
  WHERE user_id = _uid AND spin_date = _today;
  IF FOUND THEN
    _roul_spun := true;
    _roul_amount := _roul.amount;
    _today_earned := _today_earned + _roul_amount;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'today_earned', _today_earned,
    'streak', jsonb_build_object(
      'days', COALESCE(_streak, 0),
      'claimed_today', _att_today,
      'next_reward', LEAST(100 + COALESCE(_streak, 0) * 100, 1500)
    ),
    'missions', jsonb_build_object(
      'play',    jsonb_build_object('claimed', COALESCE(_mission_play, false),    'amount', floor(100 * _mult)::int),
      'invite',  jsonb_build_object('claimed', COALESCE(_mission_invite, false),  'amount', floor(150 * _mult)::int),
      'deposit', jsonb_build_object('claimed', COALESCE(_mission_deposit, false), 'amount', floor(300 * _mult)::int)
    ),
    'play_today', jsonb_build_object(
      'claimed', COALESCE(_play_today_done, false), 'amount', floor(80 * _mult)::int
    ),
    'share_today', jsonb_build_object(
      'channels', COALESCE(_share_channels, ARRAY[]::text[]),
      'amount_each', floor(200 * _mult)::int
    ),
    'referral', jsonb_build_object(
      'code', COALESCE(_ref_code, ''),
      'invited', COALESCE(_ref_count, 0),
      'earned_total', COALESCE(_ref_total, 0)
    ),
    'roulette', jsonb_build_object(
      'spun_today', _roul_spun,
      'last_amount', _roul_amount,
      'multiplier', _mult,
      'next_at', (((now() AT TIME ZONE 'Asia/Seoul')::date + 1) AT TIME ZONE 'Asia/Seoul')
    ),
    'vip_boost', jsonb_build_object(
      'active', _vip,
      'multiplier', _mult,
      'tier', COALESCE(_vip_tier, ''),
      'ends_at', _vip_exp
    )
  );
END;
$function$;

-- 4) Permission baseline
INSERT INTO public.function_permissions_baseline(function_name, function_args, allowed_roles, category, note)
VALUES
  ('spin_daily_roulette', '', ARRAY['authenticated'], 'earn', 'v14 Sprint 1 daily free roulette'),
  ('get_earn_hub_state',  '', ARRAY['authenticated'], 'earn', 'v14 Sprint 1 extended with roulette + vip_boost')
ON CONFLICT (function_name, function_args) DO UPDATE
  SET allowed_roles = EXCLUDED.allowed_roles,
      category = EXCLUDED.category,
      note = EXCLUDED.note,
      updated_at = now();