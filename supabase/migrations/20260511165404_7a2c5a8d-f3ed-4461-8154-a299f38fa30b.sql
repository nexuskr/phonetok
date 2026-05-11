ALTER TABLE public.guilds ALTER COLUMN leader_id DROP NOT NULL;

ALTER TABLE public.bot_personas
  ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'ko',
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.bot_settings
  ADD COLUMN IF NOT EXISTS dau_threshold_low  integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS dau_threshold_high integer NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS auto_phase_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bot_ratio_phase    integer NOT NULL DEFAULT 1;

INSERT INTO public.bot_settings (id, enabled, strength_pct, online_base, online_jitter)
SELECT 1, true, 100, 12000, 6000
WHERE NOT EXISTS (SELECT 1 FROM public.bot_settings WHERE id=1);

DO $$
DECLARE
  n_target int := 18000;
  n_current int;
  n_to_add int;
  i int;
  region_code text; lang_code text; tier text; gen text; emoji text; nick text;
  r numeric;
  ko_nicks text[] := ARRAY['황금사자','강남킹','부산제왕','서울독수리','수도승','다이아왕','폰마스터','제국군주','골드러시','블랙타이거','파이어드래곤','심해의왕','북극곰','은행원','벤츠오너','강철의지','한라산','동해바다','지리산정','경복궁'];
  jp_nicks text[] := ARRAY['サムライ','東京帝王','金龍','黒鷹','大阪虎','北海道熊','富士山','侍道','光速','雷神','風林火山','黄金武士','銀座王','京都帝','大将軍'];
  tw_nicks text[] := ARRAY['台北王','金鳳凰','龍騰虎躍','黑騎士','麒麟','財神','大富翁','金剛','飛龍','戰神'];
  th_nicks text[] := ARRAY['Naga','Garuda','GoldenLion','BangkokKing','ChiangMai','Phuket','RoyalTiger','SiamGold'];
  en_nicks text[] := ARRAY['ApexLord','GoldenEagle','TitanKing','EmperorX','DiamondHand','BlackWolf','PhantomKing','IronGiant','SolarFlare','NebulaKing','VortexLord','OmegaPrime','ZenithKing','InfernoLord'];
  emojis  text[] := ARRAY['👑','🦁','🐅','🐉','⚔️','💎','🏆','🥇','🔥','⚡','💰','🌟','🚀','💸','🎯','🎰','🐺','🦅','🦂','🦈','💵','🪙'];
BEGIN
  SELECT count(*) INTO n_current FROM public.bot_personas;
  n_to_add := GREATEST(0, n_target - n_current);
  IF n_to_add = 0 THEN RETURN; END IF;

  FOR i IN 1..n_to_add LOOP
    r := random();
    IF r < 0.35 THEN
      region_code:='KR'; lang_code:='ko';
      nick := ko_nicks[1+floor(random()*array_length(ko_nicks,1))::int] || (1000+floor(random()*8999))::text;
    ELSIF r < 0.55 THEN
      region_code:='JP'; lang_code:='ja';
      nick := jp_nicks[1+floor(random()*array_length(jp_nicks,1))::int] || (100+floor(random()*899))::text;
    ELSIF r < 0.70 THEN
      region_code:='TW'; lang_code:='zh';
      nick := tw_nicks[1+floor(random()*array_length(tw_nicks,1))::int] || (100+floor(random()*899))::text;
    ELSIF r < 0.80 THEN
      region_code:='TH'; lang_code:='th';
      nick := th_nicks[1+floor(random()*array_length(th_nicks,1))::int] || (100+floor(random()*899))::text;
    ELSE
      region_code:='EN'; lang_code:='en';
      nick := en_nicks[1+floor(random()*array_length(en_nicks,1))::int] || (100+floor(random()*899))::text;
    END IF;

    r := random();
    IF r < 0.01 THEN tier:='phantom';
    ELSIF r < 0.04 THEN tier:='empire';
    ELSIF r < 0.08 THEN tier:='god';
    ELSIF r < 0.14 THEN tier:='elite';
    ELSIF r < 0.24 THEN tier:='vip';
    ELSIF r < 0.49 THEN tier:='pro';
    ELSIF r < 0.79 THEN tier:='starter';
    ELSE tier:='free';
    END IF;

    r := random();
    IF r < 0.18 THEN gen:='20s';
    ELSIF r < 0.43 THEN gen:='30s';
    ELSIF r < 0.65 THEN gen:='40s';
    ELSIF r < 0.83 THEN gen:='50s';
    ELSIF r < 0.93 THEN gen:='60s';
    ELSIF r < 0.97 THEN gen:='70s';
    ELSE gen:='freelancer';
    END IF;

    emoji := emojis[1+floor(random()*array_length(emojis,1))::int];

    INSERT INTO public.bot_personas
      (nickname, avatar_emoji, generation, tier_weight, region, language, is_synthetic, last_active_at)
    VALUES
      (nick, emoji, gen, tier, region_code, lang_code, true,
       now() - (random()*interval '30 days'));
  END LOOP;
END $$;

INSERT INTO public.guilds (name, emblem, description, max_members, is_seed)
SELECT name, emblem, description, max_members, true
FROM (VALUES
  ('강남제국',      '👑', 'Gangnam Empire — 강남발 글로벌 정복단',     500),
  ('부산정복단',    '⚓', 'Busan Conquerors — 해운대에서 출발한 제국',  300),
  ('서울골드클럽',  '🥇', 'Seoul Gold Club — 수도권 최정예',            500),
  ('제주바이브',    '🌴', 'Jeju Vibe — 휴양과 정복 사이',                200),
  ('도쿄프리미엄',  '🗼', 'Tokyo Premium — 도쿄 엘리트 길드',            400),
  ('오사카블레이드','⚔️', 'Osaka Blade — 칸사이 최강',                   300),
  ('타이베이엘리트','🐉', 'Taipei Elite — 타이베이 최정예',              300),
  ('방콕로얄',      '🐘', 'Bangkok Royal — 시암 골든',                   200),
  ('Apex Global',   '🌍', 'Apex Global — Worldwide Empire',              500),
  ('Titan Reserve', '⚡', 'Titan Reserve — High-stakes only',            300),
  ('Phantom Order', '👻', 'Phantom Order — Stealth empire',              200),
  ('Solar Dynasty', '☀️', 'Solar Dynasty — Daylight conquerors',         400)
) AS s(name, emblem, description, max_members)
WHERE NOT EXISTS (SELECT 1 FROM public.guilds g WHERE g.name = s.name);

CREATE OR REPLACE FUNCTION public.cleanup_bot_activity()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.bot_activity_events WHERE occurred_at < now() - interval '30 days';
$$;
REVOKE ALL ON FUNCTION public.cleanup_bot_activity() FROM public;

CREATE INDEX IF NOT EXISTS idx_bot_personas_region ON public.bot_personas(region);
CREATE INDEX IF NOT EXISTS idx_bot_personas_tier ON public.bot_personas(tier_weight);
CREATE INDEX IF NOT EXISTS idx_bot_personas_lang ON public.bot_personas(language);
CREATE INDEX IF NOT EXISTS idx_bot_activity_events_occurred_at ON public.bot_activity_events(occurred_at DESC);