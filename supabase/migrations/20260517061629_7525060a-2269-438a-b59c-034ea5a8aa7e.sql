
-- =============================================================================
-- PHON Economy Pass 2 — v2 (schema-corrected)
-- =============================================================================

-- 0) Widen phon_transactions.kind to allow new entry types
ALTER TABLE public.phon_transactions DROP CONSTRAINT IF EXISTS phon_transactions_kind_check;
ALTER TABLE public.phon_transactions ADD CONSTRAINT phon_transactions_kind_check
  CHECK (kind = ANY (ARRAY[
    'deposit_usdt','first_deposit_godmode','war_prize','referral','admin_adjust',
    'spend','buyback','bequest_in','bequest_out','fee_discount',
    'booster_purchase','crown_boost_purchase','vip_pass_subscribe',
    'swap_in','swap_out','stake_in','stake_out','stake_yield','bet_open','bet_close'
  ]));

-- 1) KILL SWITCHES
INSERT INTO public.platform_kill_switches (key, enabled, reason)
VALUES
  ('phon_swap',    true, 'PHON↔KRW 즉시 스왑 활성화'),
  ('phon_staking', true, 'PHON 스테이킹 활성화'),
  ('phon_betting', true, 'PHON 통화 베팅 + 수수료 할인 활성화')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 2) SWAP
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.swap_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('krw_to_phon','phon_to_krw')),
  in_amount numeric NOT NULL,
  out_amount numeric NOT NULL,
  rate numeric NOT NULL,
  idem_key text NOT NULL,
  anomaly text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idem_key)
);
ALTER TABLE public.swap_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "swap_audit_self_select" ON public.swap_audit;
CREATE POLICY "swap_audit_self_select" ON public.swap_audit
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "swap_audit_admin_all" ON public.swap_audit;
CREATE POLICY "swap_audit_admin_all" ON public.swap_audit
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.swap_limits_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  total_in_krw numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.swap_limits_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "swap_limits_self_select" ON public.swap_limits_daily;
CREATE POLICY "swap_limits_self_select" ON public.swap_limits_daily
  FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.swap_phon_krw(
  p_direction text,
  p_amount numeric,
  p_idem_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_aal text := (auth.jwt() ->> 'aal');
  v_rate numeric := 1300.0 / 1400.0;  -- PHON per KRW
  v_in numeric;
  v_out numeric;
  v_krw_equiv numeric;
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_daily_limit numeric := 5000000;
  v_existing record;
  v_used_today numeric := 0;
  v_kill boolean;
  v_avail bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF v_aal IS NULL OR v_aal <> 'aal2' THEN RAISE EXCEPTION 'step_up_required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_idem_key IS NULL OR length(p_idem_key) < 8 THEN RAISE EXCEPTION 'invalid_idem_key'; END IF;
  IF p_direction NOT IN ('krw_to_phon','phon_to_krw') THEN RAISE EXCEPTION 'invalid_direction'; END IF;

  SELECT enabled INTO v_kill FROM public.platform_kill_switches WHERE key='phon_swap';
  IF NOT COALESCE(v_kill, false) THEN RAISE EXCEPTION 'feature_disabled'; END IF;

  SELECT * INTO v_existing FROM public.swap_audit
    WHERE user_id = v_uid AND idem_key = p_idem_key;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'replay', true,
      'direction', v_existing.direction,
      'in_amount', v_existing.in_amount,
      'out_amount', v_existing.out_amount,
      'rate', v_existing.rate);
  END IF;

  v_in := p_amount;
  IF p_direction = 'krw_to_phon' THEN
    v_out := floor(v_in * v_rate);
    v_krw_equiv := v_in;
  ELSE
    v_out := floor(v_in / v_rate);
    v_krw_equiv := v_out;
  END IF;

  SELECT COALESCE(total_in_krw,0) INTO v_used_today
    FROM public.swap_limits_daily WHERE user_id=v_uid AND day=v_today;
  IF v_used_today + v_krw_equiv > v_daily_limit THEN
    INSERT INTO public.anomaly_events(user_id, rule, severity, dedupe_key, evidence)
      VALUES (v_uid, 'swap_limit_exceeded', 'warning',
              'swap:' || v_uid::text || ':' || v_today::text,
              jsonb_build_object('attempted_krw', v_krw_equiv, 'used_today', v_used_today, 'limit', v_daily_limit))
      ON CONFLICT (dedupe_key) DO NOTHING;
    RAISE EXCEPTION 'daily_swap_limit_exceeded' USING DETAIL = jsonb_build_object('limit_krw', v_daily_limit)::text;
  END IF;

  IF p_direction = 'krw_to_phon' THEN
    -- Debit KRW from wallet_balances (available + total move together to satisfy chk_consistency)
    SELECT available_balance INTO v_avail FROM public.wallet_balances WHERE user_id=v_uid FOR UPDATE;
    IF COALESCE(v_avail,0) < v_in::bigint THEN RAISE EXCEPTION 'insufficient_krw'; END IF;
    UPDATE public.wallet_balances
       SET available_balance = available_balance - v_in::bigint,
           total_balance     = total_balance     - v_in::bigint,
           updated_at = now()
     WHERE user_id = v_uid;
    INSERT INTO public.phon_balances(user_id, balance) VALUES (v_uid, v_out)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.phon_balances.balance + v_out, updated_at = now();
    INSERT INTO public.phon_transactions(user_id, amount, kind, ref, meta)
      VALUES (v_uid, v_out, 'swap_in', p_idem_key, jsonb_build_object('from','krw','in_krw',v_in,'rate',v_rate));
  ELSE
    UPDATE public.phon_balances SET balance = balance - v_in, updated_at = now()
      WHERE user_id = v_uid AND balance >= v_in;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_phon'; END IF;
    INSERT INTO public.wallet_balances(user_id, total_balance, available_balance)
      VALUES (v_uid, v_out::bigint, v_out::bigint)
      ON CONFLICT (user_id) DO UPDATE
        SET available_balance = public.wallet_balances.available_balance + v_out::bigint,
            total_balance     = public.wallet_balances.total_balance     + v_out::bigint,
            updated_at = now();
    INSERT INTO public.phon_transactions(user_id, amount, kind, ref, meta)
      VALUES (v_uid, -v_in, 'swap_out', p_idem_key, jsonb_build_object('to','krw','out_krw',v_out,'rate',v_rate));
  END IF;

  INSERT INTO public.swap_limits_daily(user_id, day, total_in_krw)
    VALUES (v_uid, v_today, v_krw_equiv)
    ON CONFLICT (user_id, day) DO UPDATE SET total_in_krw = public.swap_limits_daily.total_in_krw + v_krw_equiv;

  INSERT INTO public.swap_audit(user_id, direction, in_amount, out_amount, rate, idem_key)
    VALUES (v_uid, p_direction, v_in, v_out, v_rate, p_idem_key);

  RETURN jsonb_build_object('ok', true, 'replay', false,
    'direction', p_direction, 'in_amount', v_in, 'out_amount', v_out, 'rate', v_rate);
END; $$;
REVOKE ALL ON FUNCTION public.swap_phon_krw(text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.swap_phon_krw(text, numeric, text) TO authenticated;

-- =============================================================================
-- 3) STAKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.staking_policies (
  id int PRIMARY KEY,
  apy_bps int NOT NULL,
  min_stake_phon numeric NOT NULL DEFAULT 100,
  lock_days int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staking_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staking_policies_read_authn" ON public.staking_policies;
CREATE POLICY "staking_policies_read_authn" ON public.staking_policies
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "staking_policies_admin_all" ON public.staking_policies;
CREATE POLICY "staking_policies_admin_all" ON public.staking_policies
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.staking_policies(id, apy_bps, min_stake_phon, lock_days, active)
  VALUES (1, 1500, 100, 0, true)
  ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.phon_stakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_id int NOT NULL REFERENCES public.staking_policies(id),
  amount numeric NOT NULL CHECK (amount > 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  unstaked_at timestamptz,
  last_yield_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed'))
);
CREATE INDEX IF NOT EXISTS idx_phon_stakes_user_status ON public.phon_stakes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_phon_stakes_active ON public.phon_stakes(status) WHERE status='active';
ALTER TABLE public.phon_stakes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "phon_stakes_self_select" ON public.phon_stakes;
CREATE POLICY "phon_stakes_self_select" ON public.phon_stakes
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "phon_stakes_admin_all" ON public.phon_stakes;
CREATE POLICY "phon_stakes_admin_all" ON public.phon_stakes
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.phon_stake_yields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id uuid NOT NULL REFERENCES public.phon_stakes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  yield_phon numeric NOT NULL,
  settled_for_date date NOT NULL,
  idem_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phon_stake_yields_user ON public.phon_stake_yields(user_id, created_at DESC);
ALTER TABLE public.phon_stake_yields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "phon_stake_yields_self_select" ON public.phon_stake_yields;
CREATE POLICY "phon_stake_yields_self_select" ON public.phon_stake_yields
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "phon_stake_yields_admin_all" ON public.phon_stake_yields;
CREATE POLICY "phon_stake_yields_admin_all" ON public.phon_stake_yields
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.phon_stake_yields;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

CREATE OR REPLACE FUNCTION public.stake_phon(p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pol public.staking_policies%ROWTYPE;
  v_bal numeric;
  v_id uuid;
  v_kill boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  SELECT enabled INTO v_kill FROM public.platform_kill_switches WHERE key='phon_staking';
  IF NOT COALESCE(v_kill,false) THEN RAISE EXCEPTION 'feature_disabled'; END IF;

  SELECT * INTO v_pol FROM public.staking_policies WHERE active = true ORDER BY id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_active_policy'; END IF;
  IF p_amount < v_pol.min_stake_phon THEN RAISE EXCEPTION 'amount_below_min'; END IF;

  SELECT balance INTO v_bal FROM public.phon_balances WHERE user_id=v_uid FOR UPDATE;
  IF COALESCE(v_bal,0) < p_amount THEN RAISE EXCEPTION 'insufficient_phon'; END IF;

  UPDATE public.phon_balances SET balance = balance - p_amount, updated_at = now() WHERE user_id=v_uid;

  INSERT INTO public.phon_stakes(user_id, policy_id, amount) VALUES (v_uid, v_pol.id, p_amount) RETURNING id INTO v_id;
  INSERT INTO public.phon_transactions(user_id, amount, kind, ref, meta)
    VALUES (v_uid, -p_amount, 'stake_in', v_id::text, jsonb_build_object('policy_id', v_pol.id));

  RETURN jsonb_build_object('ok', true, 'stake_id', v_id, 'amount', p_amount, 'apy_bps', v_pol.apy_bps);
END; $$;
REVOKE ALL ON FUNCTION public.stake_phon(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stake_phon(numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.unstake_phon(p_stake_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stake public.phon_stakes%ROWTYPE;
  v_pol public.staking_policies%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_stake FROM public.phon_stakes WHERE id=p_stake_id AND user_id=v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'stake_not_found'; END IF;
  IF v_stake.status <> 'active' THEN RAISE EXCEPTION 'stake_already_closed'; END IF;

  SELECT * INTO v_pol FROM public.staking_policies WHERE id=v_stake.policy_id;
  IF v_pol.lock_days > 0
     AND v_stake.started_at + (v_pol.lock_days || ' days')::interval > now() THEN
    RAISE EXCEPTION 'stake_locked' USING DETAIL = jsonb_build_object(
      'unlock_at', v_stake.started_at + (v_pol.lock_days || ' days')::interval)::text;
  END IF;

  UPDATE public.phon_stakes SET status='closed', unstaked_at=now() WHERE id=p_stake_id;
  INSERT INTO public.phon_balances(user_id, balance) VALUES (v_uid, v_stake.amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.phon_balances.balance + v_stake.amount, updated_at = now();
  INSERT INTO public.phon_transactions(user_id, amount, kind, ref, meta)
    VALUES (v_uid, v_stake.amount, 'stake_out', p_stake_id::text, '{}'::jsonb);

  RETURN jsonb_build_object('ok', true, 'returned_phon', v_stake.amount);
END; $$;
REVOKE ALL ON FUNCTION public.unstake_phon(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unstake_phon(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_stakes()
RETURNS TABLE (
  id uuid, amount numeric, started_at timestamptz, last_yield_at timestamptz,
  status text, apy_bps int, lock_days int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT s.id, s.amount, s.started_at, s.last_yield_at, s.status, p.apy_bps, p.lock_days
    FROM public.phon_stakes s
    JOIN public.staking_policies p ON p.id = s.policy_id
   WHERE s.user_id = auth.uid()
   ORDER BY s.started_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_stakes() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_stake_summary()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_active_total numeric := 0;
  v_total_yield numeric := 0;
  v_count int := 0;
  v_apy int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('active_total',0,'count',0,'total_yield',0,'apy_bps',0); END IF;
  SELECT COALESCE(SUM(amount),0), COUNT(*) INTO v_active_total, v_count
    FROM public.phon_stakes WHERE user_id=v_uid AND status='active';
  SELECT COALESCE(SUM(yield_phon),0) INTO v_total_yield
    FROM public.phon_stake_yields WHERE user_id=v_uid;
  SELECT apy_bps INTO v_apy FROM public.staking_policies WHERE active=true ORDER BY id LIMIT 1;
  RETURN jsonb_build_object(
    'active_total', v_active_total,
    'count', v_count,
    'total_yield', v_total_yield,
    'apy_bps', COALESCE(v_apy,0)
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_my_stake_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_recent_stake_yields(p_limit int DEFAULT 30)
RETURNS TABLE (yield_phon numeric, settled_for_date date, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT yield_phon, settled_for_date, created_at
    FROM public.phon_stake_yields
   WHERE user_id = auth.uid()
   ORDER BY created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;
GRANT EXECUTE ON FUNCTION public.get_my_recent_stake_yields(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_phon_staking_daily()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_total_paid numeric := 0;
  v_count int := 0;
  v_row record;
  v_date date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_yield numeric;
  v_idem text;
BEGIN
  FOR v_row IN
    SELECT s.id, s.user_id, s.amount, p.apy_bps
      FROM public.phon_stakes s
      JOIN public.staking_policies p ON p.id = s.policy_id
     WHERE s.status='active' AND p.active=true
  LOOP
    v_yield := floor(v_row.amount * v_row.apy_bps / 10000.0 / 365.0);
    IF v_yield <= 0 THEN CONTINUE; END IF;
    v_idem := v_row.id::text || ':' || v_date::text;
    BEGIN
      INSERT INTO public.phon_stake_yields(stake_id, user_id, yield_phon, settled_for_date, idem_key)
        VALUES (v_row.id, v_row.user_id, v_yield, v_date, v_idem);
      INSERT INTO public.phon_balances(user_id, balance) VALUES (v_row.user_id, v_yield)
        ON CONFLICT (user_id) DO UPDATE SET balance = public.phon_balances.balance + v_yield, updated_at = now();
      INSERT INTO public.phon_transactions(user_id, amount, kind, ref, meta)
        VALUES (v_row.user_id, v_yield, 'stake_yield', v_idem, jsonb_build_object('stake_id',v_row.id,'date',v_date));
      UPDATE public.phon_stakes SET last_yield_at = now() WHERE id = v_row.id;
      v_total_paid := v_total_paid + v_yield;
      v_count := v_count + 1;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'count', v_count, 'total_paid', v_total_paid, 'date', v_date);
END; $$;
-- internal only

-- =============================================================================
-- 4) PHON BETTING SIDECAR
-- =============================================================================

ALTER TABLE public.live_positions
  ADD COLUMN IF NOT EXISTS bet_currency text NOT NULL DEFAULT 'krw';

CREATE TABLE IF NOT EXISTS public.phon_bet_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position_id uuid,
  action text NOT NULL CHECK (action IN ('open','close')),
  amount_phon numeric NOT NULL,
  leverage int,
  pnl_phon numeric,
  fee_phon numeric,
  idem_key text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idem_key)
);
ALTER TABLE public.phon_bet_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "phon_bet_audit_self_select" ON public.phon_bet_audit;
CREATE POLICY "phon_bet_audit_self_select" ON public.phon_bet_audit
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "phon_bet_audit_admin_all" ON public.phon_bet_audit;
CREATE POLICY "phon_bet_audit_admin_all" ON public.phon_bet_audit
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- helper
CREATE OR REPLACE FUNCTION public.has_active_phon_bonus(_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT (
    EXISTS (SELECT 1 FROM public.phon_stakes WHERE user_id=_user AND status='active')
    OR EXISTS (SELECT 1 FROM public.vip_passes WHERE user_id=_user AND active=true AND expires_at > now())
  );
$$;

-- Update leverage gate to add +50% bonus when user has active stake or VIP
CREATE OR REPLACE FUNCTION public._get_max_leverage_for(_user uuid)
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_phon numeric := 0;
  v_base int;
  v_boost int;
  v_final int;
  v_bonus_mul numeric := 1.0;
BEGIN
  SELECT COALESCE(balance,0) INTO v_phon FROM public.phon_balances WHERE user_id = _user;
  v_base := CASE
    WHEN v_phon >= 5000 THEN 100
    WHEN v_phon >= 1200 THEN 50
    WHEN v_phon >= 500  THEN 25
    ELSE 10
  END;
  v_boost := public._get_total_boost_pct_for(_user);
  IF public.has_active_phon_bonus(_user) THEN
    v_bonus_mul := 1.5;
  END IF;
  v_final := floor(v_base * (1 + v_boost/100.0) * v_bonus_mul)::int;
  IF v_final > 100 THEN v_final := 100; END IF;
  RETURN v_final;
END; $$;

CREATE OR REPLACE FUNCTION public.get_my_phon_leverage_bonus()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_phon numeric := 0;
  v_base int;
  v_active boolean;
  v_effective int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('active', false, 'base', 10, 'bonus_pct', 0, 'effective', 10);
  END IF;
  SELECT COALESCE(balance,0) INTO v_phon FROM public.phon_balances WHERE user_id=v_uid;
  v_base := CASE
    WHEN v_phon >= 5000 THEN 100
    WHEN v_phon >= 1200 THEN 50
    WHEN v_phon >= 500  THEN 25
    ELSE 10 END;
  v_active := public.has_active_phon_bonus(v_uid);
  v_effective := public._get_max_leverage_for(v_uid);
  RETURN jsonb_build_object(
    'active', v_active,
    'base', v_base,
    'bonus_pct', CASE WHEN v_active THEN 50 ELSE 0 END,
    'effective', v_effective
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_my_phon_leverage_bonus() TO authenticated;

CREATE OR REPLACE FUNCTION public.open_position_phon(
  p_symbol text,
  p_side text,
  p_leverage int,
  p_amount_phon numeric,
  p_idem_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_bal numeric;
  v_pid uuid;
  v_kill boolean;
  v_existing record;
  v_max int;
  v_fee numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_symbol IS NULL OR length(p_symbol)<3 THEN RAISE EXCEPTION 'invalid_symbol'; END IF;
  IF p_side NOT IN ('long','short') THEN RAISE EXCEPTION 'invalid_side'; END IF;
  IF p_leverage < 1 OR p_leverage > 100 THEN RAISE EXCEPTION 'invalid_leverage'; END IF;
  IF p_amount_phon IS NULL OR p_amount_phon <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_idem_key IS NULL OR length(p_idem_key) < 8 THEN RAISE EXCEPTION 'invalid_idem_key'; END IF;

  SELECT enabled INTO v_kill FROM public.platform_kill_switches WHERE key='phon_betting';
  IF NOT COALESCE(v_kill,false) THEN RAISE EXCEPTION 'feature_disabled'; END IF;

  SELECT * INTO v_existing FROM public.phon_bet_audit
    WHERE user_id=v_uid AND idem_key=p_idem_key;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'replay', true, 'position_id', v_existing.position_id);
  END IF;

  v_max := public._get_max_leverage_for(v_uid);
  IF p_leverage > v_max THEN RAISE EXCEPTION 'leverage_exceeds_phon_tier'; END IF;

  SELECT balance INTO v_bal FROM public.phon_balances WHERE user_id=v_uid FOR UPDATE;
  IF COALESCE(v_bal,0) < p_amount_phon THEN RAISE EXCEPTION 'insufficient_phon'; END IF;

  v_fee := floor(p_amount_phon * p_leverage * 0.001 * 0.8);

  UPDATE public.phon_balances SET balance = balance - p_amount_phon, updated_at = now() WHERE user_id=v_uid;

  INSERT INTO public.live_positions(
    user_id, symbol, side, leverage, margin, size, entry, liq_price, fee_open, status, bet_currency, margin_mode
  )
  VALUES (
    v_uid, p_symbol, p_side, p_leverage, p_amount_phon::bigint,
    p_amount_phon, 0, 0, v_fee::bigint, 'open', 'phon', 'isolated'
  )
  RETURNING id INTO v_pid;

  INSERT INTO public.phon_bet_audit(user_id, position_id, action, amount_phon, leverage, fee_phon, idem_key, meta)
    VALUES (v_uid, v_pid, 'open', p_amount_phon, p_leverage, v_fee, p_idem_key,
            jsonb_build_object('symbol',p_symbol,'side',p_side,'house_edge_discount',0.20));

  INSERT INTO public.phon_transactions(user_id, amount, kind, ref, meta)
    VALUES (v_uid, -p_amount_phon, 'bet_open', v_pid::text, jsonb_build_object('lev',p_leverage,'symbol',p_symbol));

  RETURN jsonb_build_object('ok', true, 'replay', false, 'position_id', v_pid, 'fee_phon', v_fee);
END; $$;
REVOKE ALL ON FUNCTION public.open_position_phon(text,text,int,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_position_phon(text,text,int,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_position_phon(
  p_position_id uuid,
  p_pnl_pct numeric,
  p_idem_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pos public.live_positions%ROWTYPE;
  v_existing record;
  v_pnl numeric;
  v_fee_close numeric;
  v_payout numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_idem_key IS NULL OR length(p_idem_key) < 8 THEN RAISE EXCEPTION 'invalid_idem_key'; END IF;
  IF p_pnl_pct IS NULL OR p_pnl_pct < -1 OR p_pnl_pct > 100 THEN RAISE EXCEPTION 'invalid_pnl'; END IF;

  SELECT * INTO v_existing FROM public.phon_bet_audit
    WHERE user_id=v_uid AND idem_key=p_idem_key;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'replay', true, 'pnl_phon', v_existing.pnl_phon);
  END IF;

  SELECT * INTO v_pos FROM public.live_positions
    WHERE id=p_position_id AND user_id=v_uid AND bet_currency='phon' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'position_not_found'; END IF;
  IF v_pos.status <> 'open' THEN RAISE EXCEPTION 'position_not_open'; END IF;

  v_pnl := floor(v_pos.margin * p_pnl_pct);
  v_fee_close := floor(v_pos.margin * v_pos.leverage * 0.001 * 0.8);
  v_payout := GREATEST(0, v_pos.margin + v_pnl - v_fee_close);

  UPDATE public.live_positions SET status='closed' WHERE id=p_position_id;

  IF v_payout > 0 THEN
    INSERT INTO public.phon_balances(user_id, balance) VALUES (v_uid, v_payout)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.phon_balances.balance + v_payout, updated_at = now();
  END IF;

  INSERT INTO public.phon_bet_audit(user_id, position_id, action, amount_phon, leverage, pnl_phon, fee_phon, idem_key, meta)
    VALUES (v_uid, p_position_id, 'close', v_pos.margin, v_pos.leverage, v_pnl, v_fee_close, p_idem_key,
            jsonb_build_object('payout', v_payout, 'pnl_pct', p_pnl_pct, 'house_edge_discount', 0.20));

  INSERT INTO public.phon_transactions(user_id, amount, kind, ref, meta)
    VALUES (v_uid, v_payout, 'bet_close', p_position_id::text, jsonb_build_object('pnl_phon', v_pnl));

  RETURN jsonb_build_object('ok', true, 'replay', false, 'pnl_phon', v_pnl, 'payout', v_payout, 'fee_phon', v_fee_close);
END; $$;
REVOKE ALL ON FUNCTION public.close_position_phon(uuid,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_position_phon(uuid,numeric,text) TO authenticated;

-- Baseline (uses actual column names: category + note, no reviewed_at)
INSERT INTO public.function_permissions_baseline(function_name, function_args, allowed_roles, category, note)
VALUES
  ('swap_phon_krw',           'text,numeric,text',     ARRAY['authenticated']::text[], 'phon_economy', 'PHON↔KRW swap, AAL2 required'),
  ('stake_phon',              'numeric',               ARRAY['authenticated']::text[], 'phon_economy', 'PHON staking deposit'),
  ('unstake_phon',            'uuid',                  ARRAY['authenticated']::text[], 'phon_economy', 'PHON staking withdrawal'),
  ('get_my_stakes',           '',                      ARRAY['authenticated']::text[], 'phon_economy', 'List own stakes'),
  ('get_my_stake_summary',    '',                      ARRAY['authenticated']::text[], 'phon_economy', 'Stake aggregate summary'),
  ('get_my_recent_stake_yields','integer',             ARRAY['authenticated']::text[], 'phon_economy', 'Recent yields'),
  ('open_position_phon',      'text,text,integer,numeric,text', ARRAY['authenticated']::text[], 'phon_economy', 'PHON-bet open (sidecar, 20% house-edge discount)'),
  ('close_position_phon',     'uuid,numeric,text',     ARRAY['authenticated']::text[], 'phon_economy', 'PHON-bet close'),
  ('get_my_phon_leverage_bonus','',                    ARRAY['authenticated']::text[], 'phon_economy', 'Phon leverage bonus visualization')
ON CONFLICT (function_name, function_args) DO UPDATE
  SET allowed_roles = EXCLUDED.allowed_roles, category = EXCLUDED.category, note = EXCLUDED.note, updated_at = now();
