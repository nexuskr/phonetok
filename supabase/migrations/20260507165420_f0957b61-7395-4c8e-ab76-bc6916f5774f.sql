-- Phase 26: Gamification (Achievements / Badges / Season Pass / Quests)

-- Achievements
CREATE TABLE IF NOT EXISTS public.achievements_catalog (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  ap int NOT NULL DEFAULT 10,
  reward_credit bigint NOT NULL DEFAULT 0,
  badge_tier text,
  hidden boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.achievements_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY ac_public_read ON public.achievements_catalog FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_key text NOT NULL REFERENCES public.achievements_catalog(key) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  UNIQUE(user_id, achievement_key)
);
CREATE INDEX IF NOT EXISTS ua_user_idx ON public.user_achievements(user_id);
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY ua_self_select ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Badges
CREATE TABLE IF NOT EXISTS public.badges_catalog (
  key text PRIMARY KEY,
  name text NOT NULL,
  tier text NOT NULL,
  season_id text,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.badges_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY bc_public_read ON public.badges_catalog FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_key text NOT NULL REFERENCES public.badges_catalog(key) ON DELETE CASCADE,
  equipped_slot int,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_key)
);
CREATE INDEX IF NOT EXISTS ub_user_idx ON public.user_badges(user_id);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY ub_self_select ON public.user_badges FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY ub_public_read_equipped ON public.user_badges FOR SELECT
  USING (equipped_slot IS NOT NULL);

-- Seasons
CREATE TABLE IF NOT EXISTS public.seasons (
  id text PRIMARY KEY,
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  max_level int NOT NULL DEFAULT 50,
  premium_price bigint NOT NULL DEFAULT 100000,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY sn_public_read ON public.seasons FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.season_pass_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  level int NOT NULL,
  free_reward jsonb NOT NULL DEFAULT '{}'::jsonb,
  premium_reward jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(season_id, level)
);
ALTER TABLE public.season_pass_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY spr_public_read ON public.season_pass_rewards FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.season_pass_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  season_id text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  xp bigint NOT NULL DEFAULT 0,
  level int NOT NULL DEFAULT 0,
  premium boolean NOT NULL DEFAULT false,
  free_claimed jsonb NOT NULL DEFAULT '[]'::jsonb,
  premium_claimed jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, season_id)
);
ALTER TABLE public.season_pass_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY spp_self_select ON public.season_pass_progress FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Quests
CREATE TABLE IF NOT EXISTS public.quests_catalog (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  period text NOT NULL CHECK (period IN ('daily','weekly')),
  target int NOT NULL,
  metric text NOT NULL,
  xp_reward int NOT NULL DEFAULT 100,
  credit_reward bigint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.quests_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY qc_public_read ON public.quests_catalog FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quest_key text NOT NULL REFERENCES public.quests_catalog(key) ON DELETE CASCADE,
  period_key text NOT NULL,
  progress int NOT NULL DEFAULT 0,
  claimed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, quest_key, period_key)
);
CREATE INDEX IF NOT EXISTS uq_user_idx ON public.user_quests(user_id, period_key);
ALTER TABLE public.user_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY uq_self_select ON public.user_quests FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- ============== HELPERS ==============
CREATE OR REPLACE FUNCTION public.current_season_id()
RETURNS text LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT id FROM public.seasons WHERE now() BETWEEN starts_at AND ends_at ORDER BY starts_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.xp_for_level(_level int)
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT (500 + _level * 250)::bigint;
$$;

-- ============== AWARD XP ==============
CREATE OR REPLACE FUNCTION public.award_xp(_amount bigint, _source jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _uid uuid := auth.uid();
  _sid text := public.current_season_id();
  _row season_pass_progress%ROWTYPE;
  _need bigint;
  _leveled int := 0;
  _max_level int;
BEGIN
  IF _uid IS NULL OR _amount <= 0 OR _sid IS NULL THEN RETURN jsonb_build_object('ok',false); END IF;
  SELECT max_level INTO _max_level FROM seasons WHERE id=_sid;

  INSERT INTO season_pass_progress(user_id, season_id, xp, level)
    VALUES (_uid, _sid, 0, 0)
    ON CONFLICT (user_id, season_id) DO NOTHING;
  SELECT * INTO _row FROM season_pass_progress WHERE user_id=_uid AND season_id=_sid FOR UPDATE;

  _row.xp := _row.xp + _amount;
  LOOP
    EXIT WHEN _row.level >= _max_level;
    _need := public.xp_for_level(_row.level);
    EXIT WHEN _row.xp < _need;
    _row.xp := _row.xp - _need;
    _row.level := _row.level + 1;
    _leveled := _leveled + 1;
  END LOOP;

  UPDATE season_pass_progress
    SET xp=_row.xp, level=_row.level, updated_at=now()
    WHERE user_id=_uid AND season_id=_sid;

  RETURN jsonb_build_object('ok',true,'xp',_row.xp,'level',_row.level,'leveled',_leveled);
END $$;

-- ============== UNLOCK ACHIEVEMENT ==============
CREATE OR REPLACE FUNCTION public.unlock_achievement(_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _uid uuid := auth.uid();
  _ach achievements_catalog%ROWTYPE;
  _wallet wallet_balances%ROWTYPE;
  _badge_key text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _ach FROM achievements_catalog WHERE key=_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  INSERT INTO user_achievements(user_id, achievement_key) VALUES (_uid, _key)
    ON CONFLICT (user_id, achievement_key) DO NOTHING
    RETURNING * INTO _ach;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','already'); END IF;

  IF _ach.reward_credit > 0 THEN
    SELECT * INTO _wallet FROM wallet_balances WHERE user_id=_uid FOR UPDATE;
    UPDATE wallet_balances SET
      available_balance = available_balance + (SELECT reward_credit FROM achievements_catalog WHERE key=_key),
      total_balance = total_balance + (SELECT reward_credit FROM achievements_catalog WHERE key=_key),
      updated_at=now() WHERE user_id=_uid;
  END IF;

  -- Award badge if exists with key = 'ach_' || key
  _badge_key := 'ach_' || _key;
  IF EXISTS (SELECT 1 FROM badges_catalog WHERE key=_badge_key) THEN
    INSERT INTO user_badges(user_id, badge_key) VALUES (_uid, _badge_key)
      ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;

  PERFORM public.award_xp(((SELECT ap FROM achievements_catalog WHERE key=_key) * 10)::bigint,
    jsonb_build_object('source','achievement','key',_key));

  RETURN jsonb_build_object('ok',true,'key',_key);
END $$;

-- ============== EQUIP BADGE ==============
CREATE OR REPLACE FUNCTION public.equip_badge(_badge_key text, _slot int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _slot IS NOT NULL AND _slot NOT IN (0,1,2) THEN RAISE EXCEPTION 'invalid_slot'; END IF;

  -- Unequip anything else in same slot
  IF _slot IS NOT NULL THEN
    UPDATE user_badges SET equipped_slot=NULL WHERE user_id=_uid AND equipped_slot=_slot;
  END IF;
  UPDATE user_badges SET equipped_slot=_slot WHERE user_id=_uid AND badge_key=_badge_key;
  RETURN jsonb_build_object('ok',true);
END $$;

-- ============== PURCHASE SEASON PASS ==============
CREATE OR REPLACE FUNCTION public.purchase_season_pass()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _uid uuid := auth.uid();
  _sid text := public.current_season_id();
  _price bigint;
  _tier user_tier;
  _wallet wallet_balances%ROWTYPE;
BEGIN
  IF _uid IS NULL OR _sid IS NULL THEN RAISE EXCEPTION 'unavailable'; END IF;
  SELECT premium_price INTO _price FROM seasons WHERE id=_sid;
  SELECT tier INTO _tier FROM profiles WHERE id=_uid;

  INSERT INTO season_pass_progress(user_id, season_id) VALUES (_uid, _sid)
    ON CONFLICT (user_id, season_id) DO NOTHING;

  IF _tier='empire' THEN
    UPDATE season_pass_progress SET premium=true WHERE user_id=_uid AND season_id=_sid;
    RETURN jsonb_build_object('ok',true,'free','empire');
  END IF;

  SELECT * INTO _wallet FROM wallet_balances WHERE user_id=_uid FOR UPDATE;
  IF _wallet.available_balance < _price THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
  UPDATE wallet_balances SET
    available_balance = available_balance - _price,
    total_balance = total_balance - _price,
    updated_at=now() WHERE user_id=_uid;
  UPDATE season_pass_progress SET premium=true WHERE user_id=_uid AND season_id=_sid;
  INSERT INTO transactions(user_id, kind, direction, amount, balance_after, available_after, metadata)
    VALUES (_uid,'admin_adjust','debit',_price, _wallet.total_balance - _price, _wallet.available_balance - _price,
            jsonb_build_object('source','season_pass_purchase','season',_sid));

  RETURN jsonb_build_object('ok',true,'price',_price);
END $$;

-- ============== CLAIM SEASON REWARD ==============
CREATE OR REPLACE FUNCTION public.claim_season_reward(_level int, _track text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _uid uuid := auth.uid();
  _sid text := public.current_season_id();
  _row season_pass_progress%ROWTYPE;
  _reward jsonb;
  _credit bigint;
  _badge text;
  _claimed jsonb;
BEGIN
  IF _uid IS NULL OR _sid IS NULL THEN RAISE EXCEPTION 'unavailable'; END IF;
  IF _track NOT IN ('free','premium') THEN RAISE EXCEPTION 'invalid_track'; END IF;

  SELECT * INTO _row FROM season_pass_progress WHERE user_id=_uid AND season_id=_sid FOR UPDATE;
  IF NOT FOUND OR _row.level < _level THEN RAISE EXCEPTION 'level_locked'; END IF;
  IF _track='premium' AND NOT _row.premium THEN RAISE EXCEPTION 'no_premium'; END IF;

  IF _track='free' THEN
    _claimed := _row.free_claimed;
    SELECT free_reward INTO _reward FROM season_pass_rewards WHERE season_id=_sid AND level=_level;
  ELSE
    _claimed := _row.premium_claimed;
    SELECT premium_reward INTO _reward FROM season_pass_rewards WHERE season_id=_sid AND level=_level;
  END IF;
  IF _reward IS NULL THEN RAISE EXCEPTION 'no_reward'; END IF;
  IF _claimed @> to_jsonb(_level) THEN RAISE EXCEPTION 'already_claimed'; END IF;

  _credit := COALESCE((_reward->>'credit')::bigint, 0);
  _badge := _reward->>'badge';

  IF _credit > 0 THEN
    UPDATE wallet_balances SET
      available_balance = available_balance + _credit,
      total_balance = total_balance + _credit,
      updated_at=now() WHERE user_id=_uid;
  END IF;
  IF _badge IS NOT NULL THEN
    INSERT INTO user_badges(user_id, badge_key) VALUES (_uid, _badge)
      ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;

  IF _track='free' THEN
    UPDATE season_pass_progress SET free_claimed = free_claimed || to_jsonb(_level), updated_at=now()
      WHERE user_id=_uid AND season_id=_sid;
  ELSE
    UPDATE season_pass_progress SET premium_claimed = premium_claimed || to_jsonb(_level), updated_at=now()
      WHERE user_id=_uid AND season_id=_sid;
  END IF;

  RETURN jsonb_build_object('ok',true,'credit',_credit,'badge',_badge);
END $$;

-- ============== QUEST PROGRESS ==============
CREATE OR REPLACE FUNCTION public._period_key(_period text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE _period
    WHEN 'daily' THEN to_char(CURRENT_DATE,'YYYY-MM-DD')
    WHEN 'weekly' THEN to_char(date_trunc('week', CURRENT_DATE),'YYYY-"W"IW')
    ELSE 'unknown'
  END
$$;

CREATE OR REPLACE FUNCTION public.bump_quest_metric(_metric text, _delta int DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _uid uuid := auth.uid();
  _q quests_catalog%ROWTYPE;
  _pk text;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  FOR _q IN SELECT * FROM quests_catalog WHERE active AND metric=_metric LOOP
    _pk := public._period_key(_q.period);
    INSERT INTO user_quests(user_id, quest_key, period_key, progress)
      VALUES (_uid, _q.key, _pk, LEAST(_q.target, _delta))
      ON CONFLICT (user_id, quest_key, period_key)
      DO UPDATE SET progress = LEAST(_q.target, user_quests.progress + _delta), updated_at=now();
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.claim_quest(_quest_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _uid uuid := auth.uid();
  _q quests_catalog%ROWTYPE;
  _pk text;
  _uq user_quests%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO _q FROM quests_catalog WHERE key=_quest_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  _pk := public._period_key(_q.period);
  SELECT * INTO _uq FROM user_quests WHERE user_id=_uid AND quest_key=_quest_key AND period_key=_pk FOR UPDATE;
  IF NOT FOUND OR _uq.progress < _q.target THEN RAISE EXCEPTION 'incomplete'; END IF;
  IF _uq.claimed THEN RAISE EXCEPTION 'already_claimed'; END IF;

  IF _q.credit_reward > 0 THEN
    UPDATE wallet_balances SET
      available_balance = available_balance + _q.credit_reward,
      total_balance = total_balance + _q.credit_reward,
      updated_at=now() WHERE user_id=_uid;
  END IF;
  IF _q.xp_reward > 0 THEN PERFORM public.award_xp(_q.xp_reward, jsonb_build_object('source','quest','key',_quest_key)); END IF;

  UPDATE user_quests SET claimed=true, updated_at=now()
    WHERE user_id=_uid AND quest_key=_quest_key AND period_key=_pk;

  RETURN jsonb_build_object('ok',true,'credit',_q.credit_reward,'xp',_q.xp_reward);
END $$;

-- ============== OVERVIEW RPCs ==============
CREATE OR REPLACE FUNCTION public.get_season_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _uid uuid := auth.uid();
  _sid text := public.current_season_id();
  _season jsonb;
  _progress jsonb;
  _next_xp bigint;
BEGIN
  IF _sid IS NULL THEN RETURN jsonb_build_object('season',null); END IF;
  SELECT to_jsonb(s) INTO _season FROM seasons s WHERE id=_sid;
  IF _uid IS NOT NULL THEN
    SELECT to_jsonb(p) INTO _progress FROM season_pass_progress p WHERE user_id=_uid AND season_id=_sid;
    IF _progress IS NULL THEN _progress := jsonb_build_object('xp',0,'level',0,'premium',false,'free_claimed','[]'::jsonb,'premium_claimed','[]'::jsonb); END IF;
    _next_xp := public.xp_for_level(COALESCE((_progress->>'level')::int,0));
    _progress := _progress || jsonb_build_object('next_level_xp',_next_xp);
  END IF;
  RETURN jsonb_build_object('season',_season,'progress',_progress);
END $$;

CREATE OR REPLACE FUNCTION public.get_my_quests()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb := '[]'::jsonb;
  _q quests_catalog%ROWTYPE;
  _pk text; _progress int; _claimed boolean;
BEGIN
  IF _uid IS NULL THEN RETURN _result; END IF;
  FOR _q IN SELECT * FROM quests_catalog WHERE active ORDER BY period, key LOOP
    _pk := public._period_key(_q.period);
    SELECT progress, claimed INTO _progress, _claimed FROM user_quests
      WHERE user_id=_uid AND quest_key=_q.key AND period_key=_pk;
    _result := _result || jsonb_build_object(
      'key',_q.key,'name',_q.name,'description',_q.description,'period',_q.period,
      'target',_q.target,'progress',COALESCE(_progress,0),'claimed',COALESCE(_claimed,false),
      'xp',_q.xp_reward,'credit',_q.credit_reward
    );
  END LOOP;
  RETURN _result;
END $$;

-- ============== SEED CATALOG ==============
INSERT INTO public.achievements_catalog(key,name,description,category,ap,reward_credit,badge_tier,sort_order) VALUES
('first_win','첫 승리','첫 미션을 승리하세요','mission',10,1000,'bronze',10),
('win_100','백전백승','미션 100승 달성','mission',50,20000,'silver',20),
('win_1000','전설의 도전자','미션 1000승','mission',200,200000,'gold',30),
('streak_10','10연승','10연승 달성','mission',30,10000,'silver',40),
('streak_30','불멸의 연승','30연승 달성','mission',100,100000,'gold',50),
('cap_first','첫 적립','총 100만원 적립','wealth',20,5000,'bronze',60),
('cap_100m','억대 자산가','총 1억 적립','wealth',300,500000,'platinum',70),
('first_withdraw','첫 출금','첫 출금을 완료하세요','wealth',30,5000,'bronze',80),
('tier_vip','VIP 등극','VIP 등급 달성','wealth',50,20000,'silver',90),
('tier_god','GOD 등극','GOD 등급 달성','wealth',150,100000,'gold',100),
('tier_empire','EMPIRE 등극','EMPIRE 등급 달성','wealth',500,1000000,'diamond',110),
('bot_first','AI 봇 첫 클레임','AI 봇 보상을 처음 받기','bot',20,5000,'bronze',120),
('bot_trade_pro','트레이딩 마스터','Trading Bot 25%+ 수익','bot',80,30000,'gold',130),
('bot_100','자동화의 달인','AI 봇 100회 실행','bot',150,80000,'platinum',140),
('roulette_jackpot','룰렛 잭팟','룰렛 잭팟 당첨','luck',100,50000,'gold',150),
('gacha_ur','UR 가챠','UR 등급 가챠 획득','luck',300,200000,'mythic',160),
('golden_jackpot','골든 잭팟','골든 잭팟 당첨','luck',500,1000000,'mythic',170),
('invite_1','첫 초대','친구 1명 초대','social',20,5000,'bronze',180),
('invite_5','인플루언서','친구 5명 초대','social',60,30000,'silver',190),
('invite_25','커뮤니티 리더','친구 25명 초대','social',200,300000,'gold',200),
('attend_7','일주일 출석','7일 연속 출석','attendance',30,10000,'bronze',210),
('attend_30','한 달 출석','30일 연속 출석','attendance',100,80000,'gold',220),
('attend_100','100일의 헌신','100일 연속 출석','attendance',300,500000,'platinum',230)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.badges_catalog(key,name,tier,icon) VALUES
('ach_first_win','첫 승리','bronze','🏆'),
('ach_win_100','백전백승','silver','⚔️'),
('ach_win_1000','전설의 도전자','gold','👑'),
('ach_streak_10','10연승','silver','🔥'),
('ach_streak_30','불멸의 연승','gold','💎'),
('ach_cap_first','첫 적립','bronze','💰'),
('ach_cap_100m','억대 자산가','platinum','🏦'),
('ach_first_withdraw','첫 출금','bronze','💸'),
('ach_tier_vip','VIP','silver','⭐'),
('ach_tier_god','GOD','gold','✨'),
('ach_tier_empire','EMPIRE','diamond','👑'),
('ach_bot_first','AI 봇 입문','bronze','🤖'),
('ach_bot_trade_pro','트레이딩 마스터','gold','📈'),
('ach_bot_100','자동화 달인','platinum','⚙️'),
('ach_roulette_jackpot','룰렛 잭팟','gold','🎰'),
('ach_gacha_ur','UR 컬렉터','mythic','🌟'),
('ach_golden_jackpot','골든 잭팟','mythic','🏅'),
('ach_invite_1','첫 초대','bronze','🤝'),
('ach_invite_5','인플루언서','silver','📣'),
('ach_invite_25','커뮤니티 리더','gold','👥'),
('ach_attend_7','일주일 출석','bronze','📅'),
('ach_attend_30','한 달 출석','gold','🗓️'),
('ach_attend_100','100일 출석','platinum','💯')
ON CONFLICT (key) DO NOTHING;

-- Initial Season S1
INSERT INTO public.seasons(id, name, starts_at, ends_at, max_level, premium_price)
VALUES ('s1', 'Season 1 — Genesis', date_trunc('day', now()), date_trunc('day', now()) + interval '28 days', 50, 100000)
ON CONFLICT (id) DO NOTHING;

-- Season rewards (50 levels)
DO $$
DECLARE i int;
BEGIN
  FOR i IN 1..50 LOOP
    INSERT INTO public.season_pass_rewards(season_id, level, free_reward, premium_reward) VALUES (
      's1', i,
      CASE WHEN i % 5 = 0 THEN jsonb_build_object('credit', 5000 * i) ELSE jsonb_build_object('credit', 500 * i) END,
      jsonb_build_object('credit', 2000 * i || CASE WHEN i IN (10,25,50) THEN '' ELSE '' END)::jsonb
    ) ON CONFLICT (season_id, level) DO NOTHING;
  END LOOP;
END $$;

-- Season-exclusive badges
INSERT INTO public.badges_catalog(key,name,tier,season_id,icon) VALUES
('s1_genesis','Genesis Pioneer','mythic','s1','🌌'),
('s1_premium','S1 Premium','diamond','s1','💎')
ON CONFLICT (key) DO NOTHING;

UPDATE public.season_pass_rewards
  SET premium_reward = jsonb_build_object('credit', 50000, 'badge', 's1_premium')
  WHERE season_id='s1' AND level=10;
UPDATE public.season_pass_rewards
  SET premium_reward = jsonb_build_object('credit', 500000, 'badge', 's1_genesis')
  WHERE season_id='s1' AND level=50;

-- Quests
INSERT INTO public.quests_catalog(key,name,description,period,target,metric,xp_reward,credit_reward) VALUES
('d_mission_5','일일 미션','미션 5승','daily',5,'mission_win',150,3000),
('d_bot_1','AI 봇 작동','AI 봇 1회 클레임','daily',1,'bot_claim',100,2000),
('d_roulette_1','오늘의 운','룰렛 1회 돌리기','daily',1,'roulette_spin',80,1500),
('w_mission_50','주간 미션','미션 50승','weekly',50,'mission_win',1000,30000),
('w_bot_10','주간 자동화','AI 봇 10회 클레임','weekly',10,'bot_claim',800,25000),
('w_attend','주간 출석','7일 출석','weekly',7,'attendance',1200,40000)
ON CONFLICT (key) DO NOTHING;

-- ============== HOOK INTO EXISTING FLOWS ==============
-- Patch settle_mission to award xp + quest progress + achievements
CREATE OR REPLACE FUNCTION public.settle_mission(_mission_id text, _is_win boolean, _base_reward bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _tier public.user_tier;
  _cap BIGINT;
  _boost NUMERIC;
  _wallet public.wallet_balances%ROWTYPE;
  _stats public.daily_stats%ROWTYPE;
  _streak INT := 0;
  _mult NUMERIC := 1.0;
  _dyn NUMERIC := 1.0;
  _final BIGINT := 0;
  _today DATE := CURRENT_DATE;
  _month TEXT := to_char(CURRENT_DATE,'YYYY-MM');
  _cap_remaining BIGINT;
  _wins_total INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _base_reward < 0 OR _base_reward > 1000000 THEN RAISE EXCEPTION 'invalid reward'; END IF;

  SELECT tier INTO _tier FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _tier IS NULL THEN RAISE EXCEPTION 'profile missing'; END IF;
  _cap := public.tier_daily_cap(_tier);
  _boost := public.tier_boost(_tier);

  SELECT * INTO _wallet FROM public.wallet_balances WHERE user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.wallet_balances(user_id) VALUES (_uid) RETURNING * INTO _wallet;
  END IF;

  IF _wallet.last_reset_date <> _today THEN
    _wallet.today_earned := 0; _wallet.last_reset_date := _today;
  END IF;
  IF _wallet.last_reset_month <> _month THEN
    _wallet.monthly_earned := 0; _wallet.last_reset_month := _month;
  END IF;

  INSERT INTO public.daily_stats(user_id, stat_date) VALUES (_uid, _today)
    ON CONFLICT (user_id, stat_date) DO NOTHING;
  SELECT * INTO _stats FROM public.daily_stats WHERE user_id = _uid AND stat_date = _today FOR UPDATE;
  _streak := _stats.current_streak;

  IF _is_win THEN
    _streak := _streak + 1;
    _mult := LEAST(2.5, 1.0 + _streak * 0.05);
    _dyn := 0.95 + random() * 0.10;
    _final := FLOOR(_base_reward * _mult * _boost * _dyn)::BIGINT;

    _cap_remaining := GREATEST(0, _cap - _wallet.today_earned);
    IF _final > _cap_remaining THEN _final := _cap_remaining; END IF;

    IF _final > 0 THEN
      _wallet.available_balance := _wallet.available_balance + _final;
      _wallet.total_balance     := _wallet.total_balance + _final;
      _wallet.today_earned      := _wallet.today_earned + _final;
      _wallet.monthly_earned    := _wallet.monthly_earned + _final;
    END IF;

    _stats.wins := _stats.wins + 1;
    _stats.earned := _stats.earned + _final;
    _stats.current_streak := _streak;
    _stats.best_streak := GREATEST(_stats.best_streak, _streak);
  ELSE
    _streak := 0;
    _stats.losses := _stats.losses + 1;
    _stats.current_streak := 0;
    _final := 0;
  END IF;

  UPDATE public.daily_stats
    SET wins=_stats.wins, losses=_stats.losses, earned=_stats.earned,
        current_streak=_stats.current_streak, best_streak=_stats.best_streak
    WHERE user_id=_uid AND stat_date=_today;

  UPDATE public.wallet_balances SET
    total_balance=_wallet.total_balance,
    available_balance=_wallet.available_balance,
    pending_balance=_wallet.pending_balance,
    locked_balance=_wallet.locked_balance,
    today_earned=_wallet.today_earned,
    monthly_earned=_wallet.monthly_earned,
    last_reset_date=_wallet.last_reset_date,
    last_reset_month=_wallet.last_reset_month,
    updated_at=now()
  WHERE user_id=_uid;

  INSERT INTO public.mission_history(user_id, mission_id, is_win, base_reward, final_reward, streak, multiplier, tier, cap_remaining)
    VALUES (_uid, _mission_id, _is_win, _base_reward, _final, _streak, _mult, _tier, GREATEST(0,_cap - _wallet.today_earned));

  IF _final > 0 THEN
    INSERT INTO public.transactions(user_id, kind, direction, amount, balance_after, available_after, mission_id, metadata)
      VALUES (_uid, 'mission_win', 'credit', _final, _wallet.total_balance, _wallet.available_balance, _mission_id,
              jsonb_build_object('streak',_streak,'multiplier',_mult,'tier',_tier));

    PERFORM public._credit_referral_commission(_uid, _final, 'mission_win');

    -- Phase 26: XP + quest + achievement triggers
    PERFORM public.award_xp(GREATEST(20, FLOOR(_final/1000))::bigint, jsonb_build_object('source','mission'));
    PERFORM public.bump_quest_metric('mission_win', 1);

    SELECT COALESCE(SUM(wins),0) INTO _wins_total FROM public.daily_stats WHERE user_id=_uid;
    PERFORM public.unlock_achievement('first_win');
    IF _wins_total >= 100 THEN PERFORM public.unlock_achievement('win_100'); END IF;
    IF _wins_total >= 1000 THEN PERFORM public.unlock_achievement('win_1000'); END IF;
    IF _streak >= 10 THEN PERFORM public.unlock_achievement('streak_10'); END IF;
    IF _streak >= 30 THEN PERFORM public.unlock_achievement('streak_30'); END IF;
    IF _wallet.total_balance >= 1000000 THEN PERFORM public.unlock_achievement('cap_first'); END IF;
    IF _wallet.total_balance >= 100000000 THEN PERFORM public.unlock_achievement('cap_100m'); END IF;
  END IF;

  RETURN jsonb_build_object(
    'is_win',_is_win,'final_reward',_final,'streak',_streak,'multiplier',_mult,
    'tier',_tier,'available_balance',_wallet.available_balance,
    'today_earned',_wallet.today_earned,'cap_remaining',GREATEST(0,_cap - _wallet.today_earned)
  );
END $function$;
