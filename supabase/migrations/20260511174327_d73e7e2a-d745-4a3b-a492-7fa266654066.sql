
-- =====================================================================
-- IMPERIAL SCORE ENGINE — 4-Pillar 통합 (IS · Booster · Ladder · Trading)
-- =====================================================================

-- 1. TABLES -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.imperial_scores (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_is    bigint NOT NULL DEFAULT 0,
  daily_is    bigint NOT NULL DEFAULT 0,
  weekly_is   bigint NOT NULL DEFAULT 0,
  season_is   bigint NOT NULL DEFAULT 0,
  daily_date  date   NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date),
  weekly_key  text   NOT NULL DEFAULT to_char((now() AT TIME ZONE 'Asia/Seoul')::date,'IYYY-IW'),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.imperial_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "is_self_select" ON public.imperial_scores FOR SELECT
  USING ((auth.uid() = user_id) OR public.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.imperial_score_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source     text NOT NULL,
  base       bigint NOT NULL,
  multiplier numeric(6,3) NOT NULL DEFAULT 1.0,
  delta      bigint NOT NULL,
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ise_user_created_idx ON public.imperial_score_events(user_id, created_at DESC);
ALTER TABLE public.imperial_score_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ise_self_select" ON public.imperial_score_events FOR SELECT
  USING ((auth.uid() = user_id) OR public.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.deposit_booster_windows (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  source_purchase_id  uuid,
  hours_accumulated   integer NOT NULL DEFAULT 24,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dbw_user_expires_idx ON public.deposit_booster_windows(user_id, expires_at DESC);
ALTER TABLE public.deposit_booster_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dbw_self_select" ON public.deposit_booster_windows FOR SELECT
  USING ((auth.uid() = user_id) OR public.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.escalation_milestones_catalog (
  key              text PRIMARY KEY,
  label            text NOT NULL,
  threshold_krw    bigint NOT NULL,
  threshold_window text NOT NULL CHECK (threshold_window IN ('daily','lifetime')),
  reward_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  badge_key        text REFERENCES public.badges_catalog(key) ON DELETE SET NULL,
  sort_order       integer NOT NULL DEFAULT 100,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.escalation_milestones_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emc_public_read" ON public.escalation_milestones_catalog FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_escalation_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_key text NOT NULL REFERENCES public.escalation_milestones_catalog(key) ON DELETE CASCADE,
  window_date  date,
  reached_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, milestone_key, window_date)
);
CREATE INDEX IF NOT EXISTS uep_user_idx ON public.user_escalation_progress(user_id, reached_at DESC);
ALTER TABLE public.user_escalation_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uep_self_select" ON public.user_escalation_progress FOR SELECT
  USING ((auth.uid() = user_id) OR public.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.daily_whale_leaderboard (
  date              date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname_masked   text NOT NULL DEFAULT '',
  deposit_total_krw bigint NOT NULL DEFAULT 0,
  is_total          bigint NOT NULL DEFAULT 0,
  rank              integer,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, user_id)
);
CREATE INDEX IF NOT EXISTS dwl_date_rank_idx ON public.daily_whale_leaderboard(date, rank);
ALTER TABLE public.daily_whale_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dwl_public_read" ON public.daily_whale_leaderboard FOR SELECT USING (true);

-- 2. WHALE BADGES SEED -----------------------------------------------

INSERT INTO public.badges_catalog (key, name, tier, icon) VALUES
  ('whale_bronze',    'Whale · Bronze',     'bronze',   '🥉'),
  ('whale_silver',    'Whale · Silver',     'silver',   '🥈'),
  ('whale_gold',      'Whale · Gold',       'gold',     '🥇'),
  ('whale_diamond',   'Whale · Diamond',    'diamond',  '💎'),
  ('whale_mythic',    'Whale · Mythic',     'mythic',   '🔱'),
  ('whale_emperor',   'Whale · Emperor',    'mythic',   '👑'),
  ('whale_legend',    'Whale · Legend',     'mythic',   '🏛️'),
  ('whale_deus',      'Whale · DEUS',       'mythic',   '⚡')
ON CONFLICT (key) DO NOTHING;

-- 3. ESCALATION CATALOG SEED -----------------------------------------

INSERT INTO public.escalation_milestones_catalog
  (key, label, threshold_krw, threshold_window, reward_json, badge_key, sort_order)
VALUES
  ('starter_29k',  'NORMAL 미션 해금',       29000,        'lifetime',
   '{"perks":["NORMAL 미션 풀","Bronze 뱃지"]}'::jsonb, 'whale_bronze', 10),
  ('silver_100k',  'VIP 미션 + 시즌패스 ×2', 100000,       'lifetime',
   '{"perks":["VIP 미션 풀","시즌패스 ×2"]}'::jsonb,    'whale_silver', 20),
  ('gold_1m',      'GOD 미션 + 트레이딩 ×2', 1000000,      'lifetime',
   '{"perks":["GOD 미션","Private Pool","트레이딩 레버 ×2"]}'::jsonb, 'whale_gold', 30),
  ('diamond_10m',  'EMPIRE 미션 + 1:1 매니저',10000000,    'lifetime',
   '{"perks":["EMPIRE 미션","1:1 매니저","Empire Day 자동"]}'::jsonb,  'whale_diamond', 40),
  ('mythic_50m',   'PHANTOM 자문석',         50000000,     'daily',
   '{"perks":["PHANTOM Syndicate 자문석","영구 보존 뱃지"]}'::jsonb,   'whale_mythic', 50),
  ('emperor_100m', '황제 좌석 (일 1명)',     100000000,    'daily',
   '{"perks":["일 1명 황제 좌석","1억 잭팟 추첨권"]}'::jsonb,           'whale_emperor', 60),
  ('legend_500m',  '명예의 전당 영구 등재',  500000000,    'daily',
   '{"perks":["명예의 전당 영구 등재","5억 잭팟 추첨권"]}'::jsonb,      'whale_legend', 70),
  ('deus_1b',      'DEUS 단 1명',            1000000000,   'daily',
   '{"perks":["영구 1순위 출금","30% 자동 매칭","평생 PHANTOM"]}'::jsonb,'whale_deus', 80)
ON CONFLICT (key) DO NOTHING;

-- 4. RPCs -------------------------------------------------------------

-- 4a. award_imperial_score (internal-only)
CREATE OR REPLACE FUNCTION public.award_imperial_score(
  _user_id uuid,
  _source  text,
  _base    bigint,
  _meta    jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _today date := ((now() AT TIME ZONE 'Asia/Seoul')::date);
  _week  text := to_char(_today,'IYYY-IW');
  _cap_daily bigint;
  _booster_active boolean;
  _mult numeric := 1.0;
  _current_daily bigint;
  _delta bigint;
  _new_total bigint;
BEGIN
  IF _user_id IS NULL OR _base IS NULL OR _base <= 0 THEN
    RETURN 0;
  END IF;

  _cap_daily := CASE _source
    WHEN 'mission'     THEN 1000
    WHEN 'quest'       THEN 300
    WHEN 'achievement' THEN 500
    WHEN 'trading'     THEN 1000000
    WHEN 'deposit'     THEN 1000000000
    WHEN 'jackpot'     THEN 200
    ELSE 200
  END;

  SELECT EXISTS(
    SELECT 1 FROM public.deposit_booster_windows
    WHERE user_id = _user_id AND expires_at > now()
  ) INTO _booster_active;

  IF _booster_active THEN
    _mult := CASE _source
      WHEN 'achievement' THEN 1.5
      WHEN 'trading'     THEN 1.5
      ELSE 2.0
    END;
  END IF;

  _delta := FLOOR(_base * _mult)::bigint;

  INSERT INTO public.imperial_scores (user_id, daily_date, weekly_key)
  VALUES (_user_id, _today, _week)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.imperial_scores
     SET daily_is  = CASE WHEN daily_date  <> _today THEN 0 ELSE daily_is END,
         weekly_is = CASE WHEN weekly_key  <> _week  THEN 0 ELSE weekly_is END,
         daily_date = _today,
         weekly_key = _week
   WHERE user_id = _user_id;

  SELECT daily_is INTO _current_daily FROM public.imperial_scores WHERE user_id = _user_id FOR UPDATE;
  IF _current_daily >= _cap_daily THEN
    RETURN 0;
  END IF;
  _delta := LEAST(_delta, _cap_daily - _current_daily);
  IF _delta <= 0 THEN RETURN 0; END IF;

  UPDATE public.imperial_scores
     SET total_is  = total_is  + _delta,
         daily_is  = daily_is  + _delta,
         weekly_is = weekly_is + _delta,
         season_is = season_is + _delta,
         updated_at = now()
   WHERE user_id = _user_id
   RETURNING total_is INTO _new_total;

  INSERT INTO public.imperial_score_events (user_id, source, base, multiplier, delta, meta)
  VALUES (_user_id, _source, _base, _mult, _delta, _meta);

  RETURN _delta;
END;
$$;

REVOKE ALL ON FUNCTION public.award_imperial_score(uuid,text,bigint,jsonb) FROM PUBLIC, anon, authenticated;

-- 4b. start_or_extend_booster (internal-only)
CREATE OR REPLACE FUNCTION public.start_or_extend_booster(
  _user_id uuid,
  _purchase_id uuid,
  _hours integer DEFAULT 24
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _existing record;
  _new_id uuid;
  _new_expiry timestamptz;
  _max_total_hours int := 168;
BEGIN
  IF _user_id IS NULL OR _hours <= 0 THEN RETURN NULL; END IF;

  SELECT * INTO _existing FROM public.deposit_booster_windows
   WHERE user_id = _user_id AND expires_at > now()
   ORDER BY expires_at DESC LIMIT 1 FOR UPDATE;

  IF FOUND THEN
    _new_expiry := LEAST(
      _existing.expires_at + (_hours || ' hours')::interval,
      _existing.started_at + (_max_total_hours || ' hours')::interval
    );
    UPDATE public.deposit_booster_windows
       SET expires_at = _new_expiry,
           hours_accumulated = LEAST(hours_accumulated + _hours, _max_total_hours),
           source_purchase_id = COALESCE(_purchase_id, source_purchase_id)
     WHERE id = _existing.id
     RETURNING id INTO _new_id;
  ELSE
    INSERT INTO public.deposit_booster_windows (user_id, started_at, expires_at, source_purchase_id, hours_accumulated)
    VALUES (_user_id, now(), now() + (_hours || ' hours')::interval, _purchase_id, LEAST(_hours, _max_total_hours))
    RETURNING id INTO _new_id;
  END IF;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_or_extend_booster(uuid,uuid,integer) FROM PUBLIC, anon, authenticated;

-- 4c. check_escalation (internal-only)
CREATE OR REPLACE FUNCTION public.check_escalation(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _today date := ((now() AT TIME ZONE 'Asia/Seoul')::date);
  _lifetime bigint;
  _today_amt bigint;
  _m record;
  _granted integer := 0;
  _window_date date;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(amount),0) INTO _lifetime
    FROM public.package_purchases
   WHERE user_id = _user_id AND status = 'confirmed';

  SELECT COALESCE(SUM(amount),0) INTO _today_amt
    FROM public.package_purchases
   WHERE user_id = _user_id AND status = 'confirmed'
     AND ((approved_at AT TIME ZONE 'Asia/Seoul')::date) = _today;

  FOR _m IN
    SELECT * FROM public.escalation_milestones_catalog ORDER BY sort_order
  LOOP
    _window_date := CASE WHEN _m.threshold_window = 'daily' THEN _today ELSE NULL END;

    IF (_m.threshold_window = 'lifetime' AND _lifetime >= _m.threshold_krw)
       OR (_m.threshold_window = 'daily'  AND _today_amt >= _m.threshold_krw)
    THEN
      INSERT INTO public.user_escalation_progress (user_id, milestone_key, window_date)
      VALUES (_user_id, _m.key, _window_date)
      ON CONFLICT DO NOTHING;

      IF _m.badge_key IS NOT NULL THEN
        INSERT INTO public.user_badges (user_id, badge_key)
        VALUES (_user_id, _m.badge_key)
        ON CONFLICT DO NOTHING;
      END IF;

      _granted := _granted + 1;
    END IF;
  END LOOP;

  RETURN _granted;
END;
$$;

REVOKE ALL ON FUNCTION public.check_escalation(uuid) FROM PUBLIC, anon, authenticated;

-- 4d. apply_booster_multipliers (helper)
CREATE OR REPLACE FUNCTION public.apply_booster_multipliers(
  _user_id uuid,
  _base    numeric,
  _source  text
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _active boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.deposit_booster_windows
    WHERE user_id = _user_id AND expires_at > now()
  ) INTO _active;
  IF NOT _active THEN RETURN _base; END IF;
  RETURN _base * CASE _source
    WHEN 'achievement' THEN 1.5
    WHEN 'trading'     THEN 1.5
    ELSE 2.0
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_booster_multipliers(uuid,numeric,text) FROM PUBLIC, anon, authenticated;

-- 4e. get_my_dashboard_state (user-callable)
CREATE OR REPLACE FUNCTION public.get_my_dashboard_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := ((now() AT TIME ZONE 'Asia/Seoul')::date);
  _score record;
  _booster record;
  _next record;
  _today_deposit bigint;
  _lifetime_deposit bigint;
  _rank integer;
  _trading_cap bigint;
BEGIN
  IF _uid IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT * INTO _score FROM public.imperial_scores WHERE user_id = _uid;

  SELECT * INTO _booster FROM public.deposit_booster_windows
   WHERE user_id = _uid AND expires_at > now()
   ORDER BY expires_at DESC LIMIT 1;

  SELECT COALESCE(SUM(amount),0) INTO _today_deposit
    FROM public.package_purchases
   WHERE user_id = _uid AND status = 'confirmed'
     AND ((approved_at AT TIME ZONE 'Asia/Seoul')::date) = _today;

  SELECT COALESCE(SUM(amount),0) INTO _lifetime_deposit
    FROM public.package_purchases
   WHERE user_id = _uid AND status = 'confirmed';

  _trading_cap := _today_deposit * 10;

  SELECT m.* INTO _next FROM public.escalation_milestones_catalog m
   WHERE NOT EXISTS (
     SELECT 1 FROM public.user_escalation_progress p
      WHERE p.user_id = _uid AND p.milestone_key = m.key
        AND (m.threshold_window = 'lifetime' OR p.window_date = _today)
   )
   ORDER BY m.sort_order LIMIT 1;

  SELECT rank INTO _rank FROM public.daily_whale_leaderboard
   WHERE date = _today AND user_id = _uid;

  RETURN jsonb_build_object(
    'total_is',    COALESCE(_score.total_is, 0),
    'daily_is',    COALESCE(CASE WHEN _score.daily_date = _today THEN _score.daily_is ELSE 0 END, 0),
    'weekly_is',   COALESCE(_score.weekly_is, 0),
    'season_is',   COALESCE(_score.season_is, 0),
    'booster_active', _booster.id IS NOT NULL,
    'booster_expires_at', _booster.expires_at,
    'booster_hours_accumulated', COALESCE(_booster.hours_accumulated, 0),
    'today_deposit_krw', _today_deposit,
    'lifetime_deposit_krw', _lifetime_deposit,
    'trading_position_cap_krw', _trading_cap,
    'next_milestone', CASE WHEN _next.key IS NOT NULL THEN jsonb_build_object(
      'key', _next.key,
      'label', _next.label,
      'threshold_krw', _next.threshold_krw,
      'threshold_window', _next.threshold_window,
      'remaining_krw', GREATEST(0, _next.threshold_krw - CASE WHEN _next.threshold_window = 'daily' THEN _today_deposit ELSE _lifetime_deposit END),
      'reward_json', _next.reward_json
    ) ELSE NULL END,
    'whale_rank_today', _rank
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_dashboard_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_dashboard_state() TO authenticated;

-- 4f. get_whale_leaderboard (public-callable)
CREATE OR REPLACE FUNCTION public.get_whale_leaderboard(_date date DEFAULT NULL)
RETURNS TABLE(rank integer, nickname_masked text, deposit_total_krw bigint, is_total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT rank, nickname_masked, deposit_total_krw, is_total
    FROM public.daily_whale_leaderboard
   WHERE date = COALESCE(_date, ((now() AT TIME ZONE 'Asia/Seoul')::date))
     AND rank IS NOT NULL
   ORDER BY rank ASC
   LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.get_whale_leaderboard(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_whale_leaderboard(date) TO anon, authenticated;

-- 5. TRIGGERS ---------------------------------------------------------

-- 5a. package_purchases confirmed → IS + Booster + Escalation
CREATE OR REPLACE FUNCTION public.trg_package_confirmed_engine()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _base_is bigint;
BEGIN
  IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' THEN RETURN NEW; END IF;

  _base_is := GREATEST(0, (NEW.amount / 10000) * 30);

  PERFORM public.award_imperial_score(
    NEW.user_id, 'deposit', _base_is,
    jsonb_build_object('purchase_id', NEW.id, 'package_id', NEW.package_id, 'amount', NEW.amount)
  );
  PERFORM public.start_or_extend_booster(NEW.user_id, NEW.id, 24);
  PERFORM public.check_escalation(NEW.user_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pp_engine ON public.package_purchases;
CREATE TRIGGER trg_pp_engine
AFTER INSERT OR UPDATE OF status ON public.package_purchases
FOR EACH ROW EXECUTE FUNCTION public.trg_package_confirmed_engine();

-- 5b. mission_history → IS
CREATE OR REPLACE FUNCTION public.trg_mission_history_is()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _tier_mult numeric;
  _base bigint;
BEGIN
  IF NOT NEW.is_win THEN RETURN NEW; END IF;
  _tier_mult := CASE NEW.tier
    WHEN 'normal'::user_tier THEN 1.0
    WHEN 'vip'::user_tier    THEN 1.5
    WHEN 'god'::user_tier    THEN 2.5
    WHEN 'empire'::user_tier THEN 4.0
    ELSE 1.0
  END;
  _base := GREATEST(1, FLOOR((NEW.final_reward / 1000.0) * _tier_mult)::bigint);
  PERFORM public.award_imperial_score(NEW.user_id, 'mission', _base,
    jsonb_build_object('mission_id', NEW.mission_id, 'reward', NEW.final_reward));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_mh_is ON public.mission_history;
CREATE TRIGGER trg_mh_is AFTER INSERT ON public.mission_history
FOR EACH ROW EXECUTE FUNCTION public.trg_mission_history_is();

-- 5c. user_quests claim → IS
CREATE OR REPLACE FUNCTION public.trg_user_quest_claim_is()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.claimed AND (OLD IS NULL OR NOT OLD.claimed) THEN
    PERFORM public.award_imperial_score(NEW.user_id, 'quest', 5,
      jsonb_build_object('quest_key', NEW.quest_key, 'period_key', NEW.period_key));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_uq_is ON public.user_quests;
CREATE TRIGGER trg_uq_is AFTER UPDATE OF claimed ON public.user_quests
FOR EACH ROW EXECUTE FUNCTION public.trg_user_quest_claim_is();

-- 5d. user_achievements unlock → IS
CREATE OR REPLACE FUNCTION public.trg_user_achievement_is()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _ap int;
BEGIN
  SELECT ap INTO _ap FROM public.achievements_catalog WHERE key = NEW.achievement_key;
  IF COALESCE(_ap,0) > 0 THEN
    PERFORM public.award_imperial_score(NEW.user_id, 'achievement', _ap::bigint,
      jsonb_build_object('achievement_key', NEW.achievement_key));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_ua_is ON public.user_achievements;
CREATE TRIGGER trg_ua_is AFTER INSERT ON public.user_achievements
FOR EACH ROW EXECUTE FUNCTION public.trg_user_achievement_is();

-- 5e. live_trade_history → IS (PnL %)
CREATE OR REPLACE FUNCTION public.trg_live_trade_is()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _base bigint;
BEGIN
  IF NEW.roi IS NULL OR NEW.roi <= 0 THEN RETURN NEW; END IF;
  _base := GREATEST(1, FLOOR(NEW.roi * 10)::bigint);
  PERFORM public.award_imperial_score(NEW.user_id, 'trading', _base,
    jsonb_build_object('symbol', NEW.symbol, 'pnl', NEW.pnl, 'roi', NEW.roi));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_lth_is ON public.live_trade_history;
CREATE TRIGGER trg_lth_is AFTER INSERT ON public.live_trade_history
FOR EACH ROW EXECUTE FUNCTION public.trg_live_trade_is();

-- 6. PERMISSION BASELINE REGISTRATION ---------------------------------

INSERT INTO public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note) VALUES
  ('award_imperial_score',     'uuid,text,bigint,jsonb', '{}', 'internal', 'Imperial Score 가산 — 트리거/RPC 내부에서만 호출'),
  ('start_or_extend_booster',  'uuid,uuid,integer',      '{}', 'internal', 'Deposit Booster 발동/연장'),
  ('check_escalation',         'uuid',                   '{}', 'internal', 'Escalation Ladder 도달 체크 + 뱃지 부여'),
  ('apply_booster_multipliers','uuid,numeric,text',      '{}', 'internal', 'Booster 배수 헬퍼'),
  ('get_my_dashboard_state',   '',                       '{authenticated}', 'user_callable', 'IS HUD 단일 페치'),
  ('get_whale_leaderboard',    'date',                   '{anon,authenticated}', 'public_read', 'Whale 일별 리더보드')
ON CONFLICT (function_name, function_args) DO UPDATE SET
  allowed_roles = EXCLUDED.allowed_roles,
  category = EXCLUDED.category,
  note = EXCLUDED.note,
  updated_at = now();
