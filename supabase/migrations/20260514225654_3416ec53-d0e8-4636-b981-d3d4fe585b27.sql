
-- ═══════════════════════════════════════════════════════════════
-- Week 3: Viral Loop — Tournaments + Forced Share + Influencer 2.0
-- ═══════════════════════════════════════════════════════════════

-- 1) Tournament schedule
CREATE TABLE IF NOT EXISTS public.tournament_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  prize_phon BIGINT NOT NULL DEFAULT 0,
  prize_crown BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','live','ended','canceled')),
  overlay_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12),'hex'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tournament_schedule_status ON public.tournament_schedule(status, starts_at);

ALTER TABLE public.tournament_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tournament_schedule public read"
  ON public.tournament_schedule FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tournament_schedule admin write"
  ON public.tournament_schedule FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2) Share events (forced share moments funnel)
CREATE TABLE IF NOT EXISTS public.share_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  trigger TEXT NOT NULL,
  channel TEXT,
  action TEXT NOT NULL CHECK (action IN ('shown','shared','dismissed','copied')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_share_events_trigger_time ON public.share_events(trigger, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_events_user ON public.share_events(user_id, created_at DESC);

ALTER TABLE public.share_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "share_events self insert"
  ON public.share_events FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "share_events admin read"
  ON public.share_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "share_events self read"
  ON public.share_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3) Influencer codes
CREATE TABLE IF NOT EXISTS public.influencer_codes (
  code TEXT PRIMARY KEY,
  owner_user_id UUID,
  display_name TEXT NOT NULL,
  channel TEXT,
  bonus_phon INTEGER NOT NULL DEFAULT 0,
  bonus_crown INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  clicks_count INTEGER NOT NULL DEFAULT 0,
  signups_count INTEGER NOT NULL DEFAULT 0,
  deposits_count INTEGER NOT NULL DEFAULT 0,
  deposits_total_phon BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "influencer_codes public read"
  ON public.influencer_codes FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY "influencer_codes admin write"
  ON public.influencer_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4) Influencer click raw log
CREATE TABLE IF NOT EXISTS public.influencer_clicks (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  fingerprint TEXT,
  ua TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_influencer_clicks_code_time ON public.influencer_clicks(code, created_at DESC);

ALTER TABLE public.influencer_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "influencer_clicks anon insert"
  ON public.influencer_clicks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "influencer_clicks admin read"
  ON public.influencer_clicks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ═══════════════════════════════════════════════════════════════
-- Public RPCs
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_next_tournament()
RETURNS TABLE(
  id UUID, slug TEXT, title TEXT, subtitle TEXT,
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
  prize_phon BIGINT, prize_crown BIGINT, status TEXT,
  overlay_token TEXT, seconds_until_start INTEGER, seconds_until_end INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.slug, t.title, t.subtitle, t.starts_at, t.ends_at,
         t.prize_phon, t.prize_crown, t.status, t.overlay_token,
         GREATEST(0, EXTRACT(EPOCH FROM (t.starts_at - now()))::INTEGER) AS seconds_until_start,
         GREATEST(0, EXTRACT(EPOCH FROM (t.ends_at - now()))::INTEGER) AS seconds_until_end
  FROM public.tournament_schedule t
  WHERE t.status IN ('upcoming','live')
  ORDER BY CASE WHEN t.status='live' THEN 0 ELSE 1 END, t.starts_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_tournament_leaderboard(_overlay_token TEXT, _limit INTEGER DEFAULT 20)
RETURNS TABLE(rank INTEGER, masked_name TEXT, score NUMERIC, crown_count INTEGER)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_t RECORD;
BEGIN
  SELECT id, starts_at, ends_at INTO v_t
  FROM public.tournament_schedule
  WHERE overlay_token = _overlay_token
  LIMIT 1;
  IF v_t IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY SUM(c.amount) DESC)::INTEGER,
    'Emperor ' || substr(md5(c.user_id::text), 1, 4),
    SUM(c.amount)::NUMERIC,
    COUNT(*)::INTEGER
  FROM public.crown_events c
  WHERE c.created_at BETWEEN v_t.starts_at AND v_t.ends_at
  GROUP BY c.user_id
  ORDER BY SUM(c.amount) DESC
  LIMIT GREATEST(1, LEAST(100, _limit));
END;
$$;

CREATE OR REPLACE FUNCTION public.log_share_event(
  _trigger TEXT, _action TEXT, _channel TEXT DEFAULT NULL, _payload JSONB DEFAULT '{}'::jsonb
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id BIGINT;
BEGIN
  IF _trigger IS NULL OR length(_trigger) > 64 THEN
    RAISE EXCEPTION 'invalid_trigger';
  END IF;
  IF _action NOT IN ('shown','shared','dismissed','copied') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;
  INSERT INTO public.share_events(user_id, trigger, action, channel, payload)
  VALUES (auth.uid(), _trigger, _action, NULLIF(_channel,''), COALESCE(_payload,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_influencer_click(_code TEXT, _fingerprint TEXT DEFAULT NULL, _referrer TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_exists BOOLEAN;
BEGIN
  IF _code IS NULL OR length(_code) > 32 THEN RETURN false; END IF;
  SELECT true INTO v_exists FROM public.influencer_codes WHERE code = upper(_code) AND active LIMIT 1;
  IF NOT v_exists THEN RETURN false; END IF;
  INSERT INTO public.influencer_clicks(code, fingerprint, referrer)
  VALUES (upper(_code), _fingerprint, _referrer);
  UPDATE public.influencer_codes SET clicks_count = clicks_count + 1, updated_at = now() WHERE code = upper(_code);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_influencer_public(_code TEXT)
RETURNS TABLE(code TEXT, display_name TEXT, channel TEXT, bonus_phon INTEGER, bonus_crown INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT code, display_name, channel, bonus_phon, bonus_crown
  FROM public.influencer_codes WHERE code = upper(_code) AND active LIMIT 1;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Admin RPCs
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_create_tournament(
  _slug TEXT, _title TEXT, _subtitle TEXT, _starts_at TIMESTAMPTZ, _ends_at TIMESTAMPTZ,
  _prize_phon BIGINT DEFAULT 0, _prize_crown BIGINT DEFAULT 0
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _ends_at <= _starts_at THEN RAISE EXCEPTION 'invalid_window'; END IF;
  INSERT INTO public.tournament_schedule(slug,title,subtitle,starts_at,ends_at,prize_phon,prize_crown)
  VALUES(lower(_slug),_title,NULLIF(_subtitle,''),_starts_at,_ends_at,GREATEST(0,_prize_phon),GREATEST(0,_prize_crown))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_influencer_code(
  _code TEXT, _display_name TEXT, _channel TEXT DEFAULT NULL,
  _bonus_phon INTEGER DEFAULT 0, _bonus_crown INTEGER DEFAULT 0, _owner_user_id UUID DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _code IS NULL OR length(_code) < 3 OR length(_code) > 32 THEN RAISE EXCEPTION 'invalid_code'; END IF;
  INSERT INTO public.influencer_codes(code, display_name, channel, bonus_phon, bonus_crown, owner_user_id)
  VALUES(upper(_code), _display_name, NULLIF(_channel,''), GREATEST(0,_bonus_phon), GREATEST(0,_bonus_crown), _owner_user_id)
  ON CONFLICT (code) DO UPDATE
    SET display_name = EXCLUDED.display_name, channel = EXCLUDED.channel,
        bonus_phon = EXCLUDED.bonus_phon, bonus_crown = EXCLUDED.bonus_crown,
        owner_user_id = COALESCE(EXCLUDED.owner_user_id, public.influencer_codes.owner_user_id),
        updated_at = now();
  RETURN upper(_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_influencer_codes(_limit INTEGER DEFAULT 100)
RETURNS SETOF public.influencer_codes
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.influencer_codes
  ORDER BY clicks_count DESC, created_at DESC
  LIMIT GREATEST(1, LEAST(500, _limit));
$$;

CREATE OR REPLACE FUNCTION public.admin_get_share_funnel(_hours INTEGER DEFAULT 24)
RETURNS TABLE(trigger TEXT, shown BIGINT, shared BIGINT, dismissed BIGINT, ctr NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT trigger,
         COUNT(*) FILTER (WHERE action='shown') AS shown,
         COUNT(*) FILTER (WHERE action IN ('shared','copied')) AS shared,
         COUNT(*) FILTER (WHERE action='dismissed') AS dismissed,
         CASE WHEN COUNT(*) FILTER (WHERE action='shown') > 0
              THEN ROUND(100.0 * COUNT(*) FILTER (WHERE action IN ('shared','copied'))
                              / COUNT(*) FILTER (WHERE action='shown'), 2)
              ELSE 0 END AS ctr
  FROM public.share_events
  WHERE created_at > now() - (GREATEST(1, LEAST(720, _hours)) || ' hours')::interval
  GROUP BY trigger
  ORDER BY shown DESC;
$$;

-- Auto state machine: upcoming → live → ended
CREATE OR REPLACE FUNCTION public.tournament_tick()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cnt INTEGER := 0;
BEGIN
  UPDATE public.tournament_schedule
    SET status='live', updated_at=now()
    WHERE status='upcoming' AND starts_at <= now() AND ends_at > now();
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  UPDATE public.tournament_schedule
    SET status='ended', updated_at=now()
    WHERE status IN ('upcoming','live') AND ends_at <= now();
  RETURN v_cnt;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Permission baseline registration
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note) VALUES
  ('get_next_tournament',         '',                                         ARRAY['anon','authenticated']::text[], 'public_stats', 'Next/live tournament'),
  ('get_tournament_leaderboard',  'text, integer',                            ARRAY['anon','authenticated']::text[], 'public_stats', 'Live leaderboard for OBS overlay'),
  ('log_share_event',             'text, text, text, jsonb',                  ARRAY['anon','authenticated']::text[], 'viral',        'Forced-share funnel logger'),
  ('track_influencer_click',      'text, text, text',                         ARRAY['anon','authenticated']::text[], 'viral',        'Influencer landing click counter'),
  ('get_influencer_public',       'text',                                     ARRAY['anon','authenticated']::text[], 'viral',        'Influencer code public preview'),
  ('admin_create_tournament',     'text, text, text, timestamp with time zone, timestamp with time zone, bigint, bigint',
                                                                              ARRAY['authenticated']::text[],         'admin',        'Create tournament'),
  ('admin_create_influencer_code','text, text, text, integer, integer, uuid', ARRAY['authenticated']::text[],         'admin',        'Create/upsert influencer code'),
  ('admin_list_influencer_codes', 'integer',                                  ARRAY['authenticated']::text[],         'admin',        'List influencer codes'),
  ('admin_get_share_funnel',      'integer',                                  ARRAY['authenticated']::text[],         'admin',        'Forced-share funnel stats'),
  ('tournament_tick',             '',                                         ARRAY['service_role']::text[],          'cron',         'Tournament status state machine')
ON CONFLICT (function_name, function_args) DO UPDATE
  SET allowed_roles = EXCLUDED.allowed_roles, category = EXCLUDED.category, note = EXCLUDED.note;
