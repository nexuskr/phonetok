
-- 1) bot_personas
CREATE TABLE IF NOT EXISTS public.bot_personas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname     text NOT NULL,
  avatar_emoji text NOT NULL DEFAULT '👤',
  generation   text NOT NULL CHECK (generation IN ('20s','30s','40s','50s','60s','70s','freelancer')),
  tier_weight  text NOT NULL DEFAULT 'starter'
               CHECK (tier_weight IN ('free','starter','pro','vip','god','empire','elite','phantom')),
  region       text NOT NULL DEFAULT 'KR',
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_personas_read_authenticated"
  ON public.bot_personas FOR SELECT TO authenticated USING (true);

-- 2) bot_activity_events (TTL 24h)
CREATE TABLE IF NOT EXISTS public.bot_activity_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  persona_id    uuid NOT NULL REFERENCES public.bot_personas(id) ON DELETE CASCADE,
  event_type    text NOT NULL CHECK (event_type IN (
                  'attendance','mission_clear','paper_win','package_purchase',
                  'jackpot_contrib','withdrawal','recovery','guild_join','new_signup'
                )),
  event_text    text NOT NULL,
  reward_amount bigint,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS bot_activity_events_occurred_idx ON public.bot_activity_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS bot_activity_events_expires_idx  ON public.bot_activity_events (expires_at);
CREATE INDEX IF NOT EXISTS bot_activity_events_type_idx     ON public.bot_activity_events (event_type, occurred_at DESC);
ALTER TABLE public.bot_activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_activity_events_read_authenticated"
  ON public.bot_activity_events FOR SELECT TO authenticated
  USING (occurred_at > now() - interval '1 hour');

-- 3) bot_settings (singleton)
CREATE TABLE IF NOT EXISTS public.bot_settings (
  id           int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled      boolean NOT NULL DEFAULT true,
  strength_pct int NOT NULL DEFAULT 100 CHECK (strength_pct BETWEEN 0 AND 100),
  online_base  int NOT NULL DEFAULT 12000 CHECK (online_base BETWEEN 0 AND 50000),
  online_jitter int NOT NULL DEFAULT 3000 CHECK (online_jitter BETWEEN 0 AND 20000),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid
);
INSERT INTO public.bot_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_settings_read_authenticated"
  ON public.bot_settings FOR SELECT TO authenticated USING (true);

-- RPC get_bot_feed
CREATE OR REPLACE FUNCTION public.get_bot_feed(_limit int DEFAULT 50)
RETURNS TABLE (
  id bigint, nickname text, avatar_emoji text, event_type text,
  event_text text, reward_amount bigint, occurred_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, p.nickname, p.avatar_emoji, e.event_type, e.event_text,
         e.reward_amount, e.occurred_at
    FROM public.bot_activity_events e
    JOIN public.bot_personas p ON p.id = e.persona_id
   WHERE e.occurred_at > now() - interval '1 hour'
   ORDER BY e.occurred_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 200))
$$;
GRANT EXECUTE ON FUNCTION public.get_bot_feed(int) TO authenticated;

-- RPC get_bot_online_count
CREATE OR REPLACE FUNCTION public.get_bot_online_count()
RETURNS int
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s record;
  bucket bigint;
  noise double precision;
BEGIN
  SELECT enabled, strength_pct, online_base, online_jitter
    INTO s FROM public.bot_settings WHERE id = 1;
  IF NOT FOUND OR NOT s.enabled OR s.strength_pct = 0 THEN RETURN 0; END IF;
  bucket := floor(extract(epoch FROM now()) / 30)::bigint;
  noise  := (sin(bucket::double precision * 0.7) + cos(bucket::double precision * 1.3)) / 2.0;
  RETURN GREATEST(0,
         (s.online_base + (noise * s.online_jitter)::int) * s.strength_pct / 100);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_bot_online_count() TO authenticated;

-- RPC admin_set_bot_strength
CREATE OR REPLACE FUNCTION public.admin_set_bot_strength(
  _enabled boolean, _strength_pct int,
  _online_base int DEFAULT NULL, _online_jitter int DEFAULT NULL
)
RETURNS public.bot_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result public.bot_settings;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF _strength_pct < 0 OR _strength_pct > 100 THEN
    RAISE EXCEPTION 'invalid_strength' USING ERRCODE = '22023';
  END IF;
  UPDATE public.bot_settings
     SET enabled=_enabled, strength_pct=_strength_pct,
         online_base = COALESCE(_online_base, online_base),
         online_jitter= COALESCE(_online_jitter, online_jitter),
         updated_at=now(), updated_by=auth.uid()
   WHERE id=1 RETURNING * INTO result;
  BEGIN
    INSERT INTO public.permission_change_log (actor_id, target_id, action, details)
    VALUES (auth.uid(), auth.uid(), 'bot_settings_update',
            jsonb_build_object('enabled',_enabled,'strength_pct',_strength_pct));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_bot_strength(boolean,int,int,int) TO authenticated;

-- 500 페르소나 시드
DO $$
DECLARE
  surnames text[] := ARRAY['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','류','전','홍','고','문','양','손','배','백','허','유','남','심','노','하','곽','성','차','주','우','구'];
  given1   text[] := ARRAY['민','지','서','준','현','수','연','예','우','시','하','은','채','윤','도','선','승','재','정','수'];
  emojis   text[] := ARRAY['👤','🧑','👨','👩','🧑‍💼','👨‍💼','👩‍💼','🧑‍🎓','🧑‍🌾','🧑‍🍳','🦸','🥷','🤴','👸'];
  gens     text[] := ARRAY['20s','30s','40s','50s','60s','70s','freelancer'];
  tiers    text[] := ARRAY['free','starter','starter','starter','pro','pro','vip','god','empire','elite','phantom'];
  i int;
BEGIN
  IF (SELECT count(*) FROM public.bot_personas) > 0 THEN RETURN; END IF;
  FOR i IN 1..500 LOOP
    INSERT INTO public.bot_personas (nickname, avatar_emoji, generation, tier_weight)
    VALUES (
      surnames[1+floor(random()*array_length(surnames,1))::int]
        || given1[1+floor(random()*array_length(given1,1))::int] || '**',
      emojis[1+floor(random()*array_length(emojis,1))::int],
      gens[1+floor(random()*array_length(gens,1))::int],
      tiers[1+floor(random()*array_length(tiers,1))::int]
    );
  END LOOP;
END $$;

-- baseline 등록
INSERT INTO public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note)
VALUES
  ('get_bot_feed','integer',ARRAY['authenticated'],'public_read','P0.5 bot live feed'),
  ('get_bot_online_count','',ARRAY['authenticated'],'public_read','P0.5 bot online count'),
  ('admin_set_bot_strength','boolean, integer, integer, integer',ARRAY['authenticated'],'admin_only','P0.5 admin via has_role guard')
ON CONFLICT (function_name, function_args)
DO UPDATE SET allowed_roles=EXCLUDED.allowed_roles, note=EXCLUDED.note, updated_at=now();
