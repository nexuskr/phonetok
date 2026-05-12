
-- 1) profiles 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS empire_level INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS crown_score BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_empire_level ON public.profiles (empire_level);
CREATE INDEX IF NOT EXISTS idx_profiles_crown_score ON public.profiles (crown_score DESC);

-- 2) empire_levels master
CREATE TABLE IF NOT EXISTS public.empire_levels (
  level INT PRIMARY KEY CHECK (level BETWEEN 1 AND 10),
  name TEXT NOT NULL,
  crown_required BIGINT NOT NULL,
  leverage_cap NUMERIC NOT NULL DEFAULT 1.0,
  fee_discount NUMERIC NOT NULL DEFAULT 0.0,
  growth_speed_bonus NUMERIC NOT NULL DEFAULT 0.0,
  perks JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.empire_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empire_levels public read" ON public.empire_levels;
CREATE POLICY "empire_levels public read" ON public.empire_levels FOR SELECT USING (true);

INSERT INTO public.empire_levels (level, name, crown_required, leverage_cap, fee_discount, growth_speed_bonus, perks) VALUES
  (1,  'Citizen',     0,        1.0, 0.00, 0.00, '{"badge":"🪙"}'::jsonb),
  (2,  'Trader',      500,      1.5, 0.02, 0.02, '{"badge":"⚔️"}'::jsonb),
  (3,  'Knight',      2000,     2.0, 0.05, 0.05, '{"badge":"🛡️"}'::jsonb),
  (4,  'Captain',     6000,     3.0, 0.08, 0.08, '{"badge":"⚓"}'::jsonb),
  (5,  'Lord',        15000,    4.0, 0.12, 0.12, '{"badge":"👑"}'::jsonb),
  (6,  'Viscount',    35000,    5.0, 0.16, 0.16, '{"badge":"🏰"}'::jsonb),
  (7,  'Baron',       75000,    7.0, 0.22, 0.22, '{"badge":"💎","fomo":true}'::jsonb),
  (8,  'Count',       150000,   8.5, 0.26, 0.28, '{"badge":"🌟"}'::jsonb),
  (9,  'Marquess',    300000,   9.5, 0.28, 0.34, '{"badge":"☄️"}'::jsonb),
  (10, 'Emperor',     600000,   10.0,0.30, 0.40, '{"badge":"🔥","mars":true}'::jsonb)
ON CONFLICT (level) DO UPDATE
  SET name=EXCLUDED.name, crown_required=EXCLUDED.crown_required,
      leverage_cap=EXCLUDED.leverage_cap, fee_discount=EXCLUDED.fee_discount,
      growth_speed_bonus=EXCLUDED.growth_speed_bonus, perks=EXCLUDED.perks;

-- 3) fomo_notifications (level-up FOMO 알림)
CREATE TABLE IF NOT EXISTS public.fomo_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  level INT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ NULL,
  dedupe_key TEXT NOT NULL,
  UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_fomo_notif_user ON public.fomo_notifications (user_id, created_at DESC);

ALTER TABLE public.fomo_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fomo own read" ON public.fomo_notifications;
CREATE POLICY "fomo own read" ON public.fomo_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "fomo own update" ON public.fomo_notifications;
CREATE POLICY "fomo own update" ON public.fomo_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) crown_events
CREATE TABLE IF NOT EXISTS public.crown_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  base_amount INT NOT NULL,
  awarded_amount INT NOT NULL,
  variance NUMERIC NOT NULL,
  level_mult NUMERIC NOT NULL,
  streak_mult NUMERIC NOT NULL,
  type_mult NUMERIC NOT NULL,
  expected_amount INT NOT NULL,
  rpe NUMERIC NOT NULL, -- (awarded - expected) / expected
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_crown_events_user ON public.crown_events (user_id, created_at DESC);

ALTER TABLE public.crown_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crown own read" ON public.crown_events;
CREATE POLICY "crown own read" ON public.crown_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
-- INSERT only via SECURITY DEFINER RPC (no policy needed; default deny)

-- 5) Update sensitive guard to include empire_level + crown_score
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := COALESCE(public.has_role(auth.uid(), 'admin'), false);
  v_is_definer BOOLEAN := (current_setting('role', true) = 'rds_superuser')
                          OR (auth.role() = 'service_role');
BEGIN
  IF v_is_admin OR v_is_definer THEN
    RETURN NEW;
  END IF;

  IF NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.withdraw_pin_hash IS DISTINCT FROM OLD.withdraw_pin_hash
     OR NEW.total_coin_deposits IS DISTINCT FROM OLD.total_coin_deposits
     OR NEW.total_withdrawn IS DISTINCT FROM OLD.total_withdrawn
     OR NEW.coin_master_unlocked IS DISTINCT FROM OLD.coin_master_unlocked
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.referred_by IS DISTINCT FROM OLD.referred_by
     OR NEW.attendance_streak IS DISTINCT FROM OLD.attendance_streak
     OR NEW.last_attendance IS DISTINCT FROM OLD.last_attendance
     OR NEW.empire_level IS DISTINCT FROM OLD.empire_level
     OR NEW.crown_score IS DISTINCT FROM OLD.crown_score
  THEN
    RAISE EXCEPTION 'forbidden: sensitive column update requires admin/definer';
  END IF;
  RETURN NEW;
END;
$$;

-- 6) recompute_empire_level (called inside award_crown SECURITY DEFINER context)
CREATE OR REPLACE FUNCTION public.recompute_empire_level(_user_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_score BIGINT;
  v_old_level INT;
  v_new_level INT;
BEGIN
  SELECT crown_score, empire_level INTO v_score, v_old_level
    FROM public.profiles WHERE id = _user_id FOR UPDATE;

  SELECT MAX(level) INTO v_new_level
    FROM public.empire_levels WHERE crown_required <= COALESCE(v_score, 0);
  v_new_level := COALESCE(v_new_level, 1);

  IF v_new_level <> v_old_level THEN
    UPDATE public.profiles SET empire_level = v_new_level, updated_at = now() WHERE id = _user_id;
    -- Baron (7) FOMO trigger
    IF v_new_level >= 7 AND v_old_level < 7 THEN
      INSERT INTO public.fomo_notifications (user_id, kind, level, payload, dedupe_key)
      VALUES (_user_id, 'baron_promotion', v_new_level,
              jsonb_build_object('seats_left', 50, 'leverage', 7.0, 'fee_discount', 0.22),
              'baron_promotion_v1')
      ON CONFLICT (user_id, dedupe_key) DO NOTHING;
    END IF;
  END IF;
  RETURN v_new_level;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_empire_level(UUID) FROM PUBLIC, anon, authenticated;

-- 7) award_crown
CREATE OR REPLACE FUNCTION public.award_crown(
  _type TEXT,
  _base INT,
  _meta JSONB DEFAULT '{}'::jsonb,
  _dedupe_key TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_level INT;
  v_streak INT;
  v_variance NUMERIC;
  v_level_mult NUMERIC;
  v_streak_mult NUMERIC;
  v_type_mult NUMERIC;
  v_expected INT;
  v_awarded INT;
  v_rpe NUMERIC;
  v_dedupe TEXT;
  v_recent INT;
  v_new_level INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _base < 0 OR _base > 10000 THEN RAISE EXCEPTION 'base out of range'; END IF;

  -- Token bucket: max 5 events / 1 sec
  SELECT COUNT(*) INTO v_recent FROM public.crown_events
    WHERE user_id = v_user AND created_at > now() - interval '1 second';
  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '42501';
  END IF;

  v_dedupe := COALESCE(_dedupe_key, _type || ':' || to_char(now(),'YYYYMMDDHH24MISSMS') || ':' || md5(random()::text));

  SELECT empire_level, COALESCE(attendance_streak,0) INTO v_level, v_streak
    FROM public.profiles WHERE id = v_user;
  v_level := COALESCE(v_level, 1);

  -- Variance 0.55x ~ 2.9x (Variable Ratio reinforcement)
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

  v_expected := GREATEST(1, ROUND(_base * v_level_mult * v_streak_mult * v_type_mult));
  v_awarded  := GREATEST(1, ROUND(_base * v_variance * v_level_mult * v_streak_mult * v_type_mult));
  v_rpe := (v_awarded - v_expected)::numeric / GREATEST(v_expected,1);

  -- Insert event (idempotent on dedupe_key)
  BEGIN
    INSERT INTO public.crown_events (user_id, event_type, base_amount, awarded_amount,
      variance, level_mult, streak_mult, type_mult, expected_amount, rpe, meta, dedupe_key)
    VALUES (v_user, _type, _base, v_awarded,
      v_variance, v_level_mult, v_streak_mult, v_type_mult, v_expected, v_rpe, _meta, v_dedupe);
  EXCEPTION WHEN unique_violation THEN
    -- Already awarded for this dedupe key; return prior record
    SELECT awarded_amount, expected_amount, rpe INTO v_awarded, v_expected, v_rpe
      FROM public.crown_events WHERE user_id = v_user AND dedupe_key = v_dedupe;
    RETURN jsonb_build_object('awarded', v_awarded, 'expected', v_expected, 'rpe', v_rpe,
                              'duplicate', true, 'level', v_level);
  END;

  -- Update crown_score (sensitive guard bypassed via SECURITY DEFINER + service_role check)
  UPDATE public.profiles SET crown_score = crown_score + v_awarded, updated_at = now()
    WHERE id = v_user;

  v_new_level := public.recompute_empire_level(v_user);

  RETURN jsonb_build_object(
    'awarded', v_awarded,
    'expected', v_expected,
    'rpe', round(v_rpe, 4),
    'variance', round(v_variance, 4),
    'level_mult', round(v_level_mult, 4),
    'streak_mult', round(v_streak_mult, 4),
    'type_mult', v_type_mult,
    'level', v_new_level,
    'level_up', v_new_level <> v_level,
    'duplicate', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_crown(TEXT, INT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_crown(TEXT, INT, JSONB, TEXT) TO authenticated;

-- 8) Fix auto_adjust_bot_strength: use chat_messages instead of profiles.last_seen_at
CREATE OR REPLACE FUNCTION public.auto_adjust_bot_strength()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cur INT;
  v_rec INT;
  v_new INT;
  v_enabled BOOL;
  v_real_online BIGINT;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin or service_role only';
  END IF;

  SELECT enabled, strength_pct INTO v_enabled, v_cur FROM public.bot_settings WHERE id = 1;
  IF NOT v_enabled THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'bot engine disabled');
  END IF;

  SELECT COUNT(DISTINCT user_id) INTO v_real_online
    FROM public.chat_messages
    WHERE created_at > now() - interval '5 minutes' AND user_id IS NOT NULL;

  v_rec := CASE
    WHEN v_real_online >= 200 THEN 20
    WHEN v_real_online >= 100 THEN 25
    WHEN v_real_online >= 50  THEN 35
    WHEN v_real_online >= 20  THEN 45
    ELSE 50
  END;

  IF v_cur < v_rec THEN v_new := LEAST(50, v_cur + 5);
  ELSIF v_cur > v_rec THEN v_new := GREATEST(20, v_cur - 5);
  ELSE v_new := v_cur; END IF;

  v_new := LEAST(50, GREATEST(20, v_new));

  IF v_new <> v_cur THEN
    UPDATE public.bot_settings SET strength_pct = v_new, updated_at = now() WHERE id = 1;
    INSERT INTO public.bot_mix_log (prev_strength_pct, new_strength_pct, reason, source, metrics)
    VALUES (v_cur, v_new, 'auto adjust toward ' || v_rec, 'auto',
            jsonb_build_object('recommended', v_rec, 'real_active_5m', v_real_online));
  END IF;

  RETURN jsonb_build_object('prev', v_cur, 'new', v_new, 'recommended', v_rec, 'real_active_5m', v_real_online);
END;
$$;

-- Same fix for get_bot_mix_metrics
CREATE OR REPLACE FUNCTION public.get_bot_mix_metrics()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_strength INT; v_enabled BOOL;
  v_real_24h BIGINT; v_bot_24h BIGINT; v_real_online BIGINT;
  v_recommended INT; v_ratio NUMERIC;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  SELECT enabled, strength_pct INTO v_enabled, v_strength FROM public.bot_settings WHERE id = 1;
  SELECT COUNT(DISTINCT user_id) INTO v_real_24h FROM public.chat_messages
    WHERE created_at > now() - interval '24 hours' AND user_id IS NOT NULL;
  SELECT COUNT(*) INTO v_bot_24h FROM public.bot_feed_events
    WHERE occurred_at > now() - interval '24 hours';
  SELECT COUNT(DISTINCT user_id) INTO v_real_online FROM public.chat_messages
    WHERE created_at > now() - interval '5 minutes' AND user_id IS NOT NULL;
  v_ratio := CASE WHEN (v_real_24h + v_bot_24h) > 0
                  THEN v_real_24h::NUMERIC / (v_real_24h + v_bot_24h) ELSE 0 END;
  v_recommended := CASE
    WHEN v_real_online >= 200 THEN 20 WHEN v_real_online >= 100 THEN 25
    WHEN v_real_online >= 50 THEN 35  WHEN v_real_online >= 20 THEN 45
    ELSE 50 END;
  RETURN jsonb_build_object(
    'enabled', v_enabled, 'current_strength_pct', v_strength,
    'recommended_strength_pct', v_recommended,
    'real_active_users_24h', v_real_24h, 'bot_events_24h', v_bot_24h,
    'real_share', round(v_ratio, 4), 'real_online_5m', v_real_online,
    'cap_pct', 50, 'snapshot_at', now()
  );
END;
$$;

-- 9) Permission baseline
INSERT INTO public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note) VALUES
  ('award_crown', 'text, integer, jsonb, text', ARRAY['authenticated'], 'gamification',
   'auth.uid() guard inside; token bucket 5/sec; idempotent on dedupe_key'),
  ('recompute_empire_level', 'uuid', ARRAY[]::text[], 'gamification',
   'internal only; called by award_crown via SECURITY DEFINER')
ON CONFLICT (function_name, function_args) DO UPDATE
  SET allowed_roles = EXCLUDED.allowed_roles, note = EXCLUDED.note, updated_at = now();
