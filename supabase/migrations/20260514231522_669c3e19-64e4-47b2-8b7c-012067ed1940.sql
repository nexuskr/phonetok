-- 1) vip_arrivals table
CREATE TABLE IF NOT EXISTS public.vip_arrivals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  arrived_at timestamptz NOT NULL DEFAULT now(),
  source text DEFAULT 'login'
);
CREATE INDEX IF NOT EXISTS idx_vip_arrivals_recent ON public.vip_arrivals(arrived_at DESC);
ALTER TABLE public.vip_arrivals ENABLE ROW LEVEL SECURITY;

-- only owner & admin can read raw rows; everyone consumes via RPC
CREATE POLICY "vip_arrivals_self" ON public.vip_arrivals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- 2) log_vip_arrival — VIP gate + per-minute dedupe
CREATE OR REPLACE FUNCTION public.log_vip_arrival()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_recent boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT public.is_vip_active(v_uid) THEN RAISE EXCEPTION 'vip_only'; END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.vip_arrivals
    WHERE user_id = v_uid AND arrived_at > now() - interval '60 seconds'
  ) INTO v_recent;
  IF v_recent THEN
    RETURN jsonb_build_object('ok', true, 'deduped', true);
  END IF;
  INSERT INTO public.vip_arrivals(user_id) VALUES (v_uid);
  RETURN jsonb_build_object('ok', true, 'deduped', false);
END; $$;

-- 3) get_recent_vip_arrivals — public to authenticated, masked nick, last 60s
CREATE OR REPLACE FUNCTION public.get_recent_vip_arrivals(_limit int DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'arrived_at', va.arrived_at,
    'nick', CASE
      WHEN length(COALESCE(p.nickname,'영주')) <= 2 THEN left(COALESCE(p.nickname,'영주'),1) || '*'
      ELSE left(p.nickname,1) || repeat('*', greatest(length(p.nickname)-2,1)) || right(p.nickname,1)
    END
  ) ORDER BY va.arrived_at DESC), '[]'::jsonb)
  INTO v_result
  FROM public.vip_arrivals va
  LEFT JOIN public.profiles p ON p.id = va.user_id
  WHERE va.arrived_at > now() - interval '60 seconds'
  ORDER BY va.arrived_at DESC
  LIMIT GREATEST(_limit,1);
  RETURN v_result;
END; $$;

-- 4) get_whale_strikes_vip_preview — VIP-only, last 30s window
CREATE OR REPLACE FUNCTION public.get_whale_strikes_vip_preview(_limit int DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT public.is_vip_active(v_uid) THEN RAISE EXCEPTION 'vip_only'; END IF;
  RETURN (
    WITH crown_top AS (
      SELECT 'crown'::text AS kind, ce.created_at, ce.awarded_amount::bigint AS amount,
             ce.event_type AS label, ce.user_id
      FROM public.crown_events ce
      WHERE ce.created_at >= now() - interval '30 seconds' AND ce.awarded_amount >= 3000
    ),
    wd AS (
      SELECT 'withdraw'::text AS kind, wr.completed_at AS created_at, wr.amount::bigint AS amount,
             'withdrawal'::text AS label, wr.user_id
      FROM public.withdrawal_requests wr
      WHERE wr.status = 'completed' AND wr.completed_at >= now() - interval '30 seconds'
        AND wr.amount >= 50000
    ),
    unioned AS (SELECT * FROM crown_top UNION ALL SELECT * FROM wd),
    ranked AS (
      SELECT u.kind, u.created_at, u.amount, u.label,
             COALESCE(p.nickname,'영주') AS nick
      FROM unioned u LEFT JOIN public.profiles p ON p.id = u.user_id
      ORDER BY u.created_at DESC
      LIMIT GREATEST(_limit,1)
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'kind', kind, 'created_at', created_at, 'amount', amount, 'label', label,
      'nick', CASE
        WHEN length(nick) <= 2 THEN left(nick,1) || '*'
        ELSE left(nick,1) || repeat('*', greatest(length(nick)-2,1)) || right(nick,1)
      END
    ) ORDER BY created_at DESC), '[]'::jsonb)
    FROM ranked
  );
END; $$;

-- 5) award_crown — apply VIP ×3 multiplier
CREATE OR REPLACE FUNCTION public.award_crown(_type text, _base integer, _meta jsonb DEFAULT '{}'::jsonb, _dedupe_key text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_level INT;
  v_streak INT;
  v_variance NUMERIC;
  v_level_mult NUMERIC;
  v_streak_mult NUMERIC;
  v_type_mult NUMERIC;
  v_vip_mult NUMERIC := 1.0;
  v_is_vip boolean := false;
  v_expected INT;
  v_awarded INT;
  v_rpe NUMERIC;
  v_dedupe TEXT;
  v_recent INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _base < 0 OR _base > 10000 THEN RAISE EXCEPTION 'base out of range'; END IF;

  SELECT COUNT(*) INTO v_recent FROM public.crown_events
    WHERE user_id = v_user AND created_at > now() - interval '1 second';
  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '42501';
  END IF;

  v_dedupe := COALESCE(_dedupe_key, _type || ':' || to_char(now(),'YYYYMMDDHH24MISSMS') || ':' || md5(random()::text));

  SELECT empire_level, COALESCE(attendance_streak,0) INTO v_level, v_streak
    FROM public.profiles WHERE id = v_user;
  v_level := COALESCE(v_level, 1);

  v_is_vip := public.is_vip_active(v_user);
  IF v_is_vip THEN v_vip_mult := 3.0; END IF;

  v_variance := 0.55 + random() * (2.9 - 0.55);
  v_level_mult := 1 + v_level * 0.08;
  v_streak_mult := 1 + power(LEAST(v_streak,30)::numeric / 7, 1.6) * 0.5;
  v_type_mult := CASE _type
    WHEN 'practice_win' THEN 1.80
    WHEN 'first_win'    THEN 1.80
    WHEN 'big_win'      THEN 1.80
    WHEN 'streak'       THEN 1.25
    ELSE 1.00
  END;

  v_expected := GREATEST(1, ROUND(_base * v_level_mult * v_streak_mult * v_type_mult * v_vip_mult));
  v_awarded  := GREATEST(1, ROUND(_base * v_variance * v_level_mult * v_streak_mult * v_type_mult * v_vip_mult));
  v_rpe := (v_awarded - v_expected)::numeric / GREATEST(v_expected,1);

  BEGIN
    INSERT INTO public.crown_events (user_id, event_type, base_amount, awarded_amount,
      variance, level_mult, streak_mult, type_mult, expected_amount, rpe, meta, dedupe_key)
    VALUES (v_user, _type, _base, v_awarded,
      v_variance, v_level_mult, v_streak_mult, v_type_mult,
      v_expected, v_rpe,
      _meta || jsonb_build_object('vip_bonus', v_is_vip, 'vip_mult', v_vip_mult),
      v_dedupe);
  EXCEPTION WHEN unique_violation THEN
    SELECT awarded_amount, expected_amount, rpe INTO v_awarded, v_expected, v_rpe
      FROM public.crown_events WHERE user_id = v_user AND dedupe_key = v_dedupe;
    RETURN jsonb_build_object('awarded', v_awarded, 'expected', v_expected, 'rpe', v_rpe,
                              'duplicate', true, 'level', v_level, 'vip_bonus', v_is_vip);
  END;

  RETURN jsonb_build_object(
    'awarded', v_awarded, 'expected', v_expected, 'rpe', v_rpe,
    'duplicate', false, 'level', v_level, 'streak', v_streak,
    'vip_bonus', v_is_vip, 'vip_mult', v_vip_mult
  );
END; $$;

-- 6) baseline registration
INSERT INTO public.function_permissions_baseline(function_name, function_args, allowed_roles, category, note) VALUES
  ('log_vip_arrival','', ARRAY['authenticated']::text[], 'vip', 'VIP entry broadcast log; vip_only guard + per-minute dedupe'),
  ('get_recent_vip_arrivals','_limit integer', ARRAY['authenticated']::text[], 'vip', 'Authenticated read of VIP arrivals last 60s, masked'),
  ('get_whale_strikes_vip_preview','_limit integer', ARRAY['authenticated']::text[], 'vip', 'VIP-only whale strikes last 30s preview')
ON CONFLICT (function_name, function_args) DO UPDATE
  SET allowed_roles = EXCLUDED.allowed_roles, note = EXCLUDED.note, updated_at = now();