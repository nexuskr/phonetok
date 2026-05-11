
-- 1) Guild activity feed (real-time bot/user activity stream)
CREATE TABLE IF NOT EXISTS public.guild_activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  actor_name text NOT NULL,
  actor_seed integer NOT NULL DEFAULT 0,
  action text NOT NULL CHECK (action IN ('join','contribute','war_declare','raid_win','level_up','donate','recruit')),
  amount bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_bot boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gaf_created ON public.guild_activity_feed (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gaf_guild_created ON public.guild_activity_feed (guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gaf_action_created ON public.guild_activity_feed (action, created_at DESC);

ALTER TABLE public.guild_activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity feed readable by anyone"
  ON public.guild_activity_feed FOR SELECT
  USING (true);

-- INSERT is service_role only (no policy = blocked for anon/authenticated)

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_activity_feed;

-- Seed activity generator: chooses random seed guild, random action, inserts 1 row
CREATE OR REPLACE FUNCTION public.gen_seed_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nicks text[] := ARRAY[
    '강철멘탈','비트왕','코린이탈출','불꽃손가락','돈복사기','제국황제','서울맘','부산짠돌이',
    '30대대리','40대팀장','퇴직준비중','월급도둑','와이프몰래','두번째인생','주식왕','트레이딩여신',
    '민준','서연','도윤','하은','지호','유나','현우','수아','주원','지유','건우','서윤',
    '재민','채원','승현','지안','예준','서아','우진','하린','지환','민서','태윤','수빈',
    '강남대디','수원아빠','광주누나','대전형','인천삼촌','울산이모','제주형님','일산아재',
    '판교개발자','여의도과장','분당주부','일산직장인','강서워킹맘','마포힙스터','신촌학생',
    '청담언니','잠실오빠','이태원언니','홍대디제이','성수동작가','을지로힙스','문래공방',
    '도전한다','마지막기회','이번엔간다','월급탈출','회사때려친다','존버한다','풀매수','갓생'
  ];
  _actions text[] := ARRAY['join','contribute','war_declare','raid_win','level_up','donate','recruit'];
  _weights int[] := ARRAY[30, 25, 8, 12, 10, 10, 5];
  _r int;
  _action text;
  _cum int := 0;
  _pick int;
  _guild record;
  _amount bigint;
  _nick text;
  _seed int;
BEGIN
  -- weighted action pick
  _pick := floor(random() * 100)::int;
  FOR _r IN 1..array_length(_actions, 1) LOOP
    _cum := _cum + _weights[_r];
    IF _pick < _cum THEN
      _action := _actions[_r];
      EXIT;
    END IF;
  END LOOP;
  IF _action IS NULL THEN _action := 'join'; END IF;

  -- pick a guild weighted by member_count + total_power (seeded ones preferred)
  SELECT id, name, emblem, total_power
    INTO _guild
    FROM public.guilds
    WHERE is_seed = true
    ORDER BY random() * (1 + total_power / 10000.0) DESC
    LIMIT 1;

  IF _guild.id IS NULL THEN RETURN; END IF;

  _nick := _nicks[1 + floor(random() * array_length(_nicks, 1))::int];
  IF random() < 0.45 THEN
    _nick := _nick || floor(random() * 999)::text;
  END IF;
  _seed := floor(random() * 100000)::int;

  IF _action IN ('contribute','donate') THEN
    _amount := (10 + floor(random() * 490))::bigint * 10000; -- 10~500만
  ELSIF _action = 'raid_win' THEN
    _amount := (50 + floor(random() * 950))::bigint * 10000;
  ELSIF _action = 'level_up' THEN
    _amount := (1 + floor(random() * 50))::bigint; -- level number
  ELSE
    _amount := NULL;
  END IF;

  INSERT INTO public.guild_activity_feed(guild_id, actor_name, actor_seed, action, amount, metadata, is_bot)
  VALUES (_guild.id, _nick, _seed, _action, _amount,
          jsonb_build_object('guild_name', _guild.name, 'guild_emblem', _guild.emblem),
          true);
END
$$;

-- 2) User onboarding progress (resumable tutorials)
CREATE TABLE IF NOT EXISTS public.user_onboarding_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow text NOT NULL,
  step integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, flow)
);

ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own onboarding select"
  ON public.user_onboarding_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Own onboarding insert"
  ON public.user_onboarding_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Own onboarding update"
  ON public.user_onboarding_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Cleanup helper trigger
CREATE OR REPLACE FUNCTION public.touch_onboarding_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_onboarding ON public.user_onboarding_progress;
CREATE TRIGGER trg_touch_onboarding
  BEFORE UPDATE ON public.user_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_onboarding_updated_at();
