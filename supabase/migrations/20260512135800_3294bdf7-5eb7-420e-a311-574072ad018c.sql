
-- ============= 1. RECOMMENDATION ENGINE =====================
CREATE TABLE IF NOT EXISTS public.feed_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  video_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('view','3s','complete','share','like','skip')),
  dwell_ms INTEGER NOT NULL DEFAULT 0,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feed_events_user_ts ON public.feed_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_events_video ON public.feed_events (video_id);

ALTER TABLE public.feed_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feed_events: own select" ON public.feed_events;
CREATE POLICY "feed_events: own select" ON public.feed_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "feed_events: admin select" ON public.feed_events;
CREATE POLICY "feed_events: admin select" ON public.feed_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.feed_recommendations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  video_id TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'general',
  served_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clicked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_feed_reco_user_score ON public.feed_recommendations (user_id, score DESC);

ALTER TABLE public.feed_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feed_reco: own select" ON public.feed_recommendations;
CREATE POLICY "feed_reco: own select" ON public.feed_recommendations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "feed_reco: admin select" ON public.feed_recommendations;
CREATE POLICY "feed_reco: admin select" ON public.feed_recommendations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.user_feed_profile (
  user_id UUID PRIMARY KEY,
  persona TEXT NOT NULL DEFAULT 'general',
  mode TEXT NOT NULL DEFAULT 'general',
  region TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_feed_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feed_profile: own select" ON public.user_feed_profile;
CREATE POLICY "feed_profile: own select" ON public.user_feed_profile
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "feed_profile: own upsert" ON public.user_feed_profile;
CREATE POLICY "feed_profile: own upsert" ON public.user_feed_profile
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "feed_profile: own update" ON public.user_feed_profile;
CREATE POLICY "feed_profile: own update" ON public.user_feed_profile
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "feed_profile: admin select" ON public.user_feed_profile;
CREATE POLICY "feed_profile: admin select" ON public.user_feed_profile
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============= 2. VIRAL OPTIMIZER ===========================
CREATE TABLE IF NOT EXISTS public.viral_metrics (
  video_id TEXT PRIMARY KEY,
  watch_3s_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  completion_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  share_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  viral_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  region TEXT,
  posted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_viral_metrics_score ON public.viral_metrics (viral_score DESC);
ALTER TABLE public.viral_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "viral_metrics: admin only" ON public.viral_metrics;
CREATE POLICY "viral_metrics: admin only" ON public.viral_metrics
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.posting_schedule_queue (
  id BIGSERIAL PRIMARY KEY,
  video_id TEXT NOT NULL,
  region TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','posted','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posting_queue_due
  ON public.posting_schedule_queue (scheduled_at) WHERE status = 'pending';
ALTER TABLE public.posting_schedule_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posting_queue: admin only" ON public.posting_schedule_queue;
CREATE POLICY "posting_queue: admin only" ON public.posting_schedule_queue
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============= 3. REVENUE ENGINE ============================
CREATE TABLE IF NOT EXISTS public.revenue_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  source TEXT NOT NULL CHECK (source IN ('subscription','ad','fee','other')),
  amount_krw NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KRW',
  attribution_video_id TEXT,
  attribution_referrer UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_revenue_user_ts ON public.revenue_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_source_ts ON public.revenue_events (source, created_at DESC);
ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "revenue: own select" ON public.revenue_events;
CREATE POLICY "revenue: own select" ON public.revenue_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "revenue: admin select" ON public.revenue_events;
CREATE POLICY "revenue: admin select" ON public.revenue_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============= 4. RPCs ======================================
CREATE OR REPLACE FUNCTION public.record_feed_event(
  _video_id TEXT,
  _event TEXT,
  _dwell_ms INTEGER DEFAULT 0,
  _region TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid(); _id BIGINT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _event NOT IN ('view','3s','complete','share','like','skip') THEN RAISE EXCEPTION 'invalid_event'; END IF;
  INSERT INTO public.feed_events(user_id, video_id, event, dwell_ms, region)
  VALUES (_uid, _video_id, _event, COALESCE(_dwell_ms,0), _region)
  RETURNING id INTO _id;
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.record_feed_event(TEXT,TEXT,INTEGER,TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_feed_event(TEXT,TEXT,INTEGER,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.rank_feed_for_user(_limit INTEGER DEFAULT 20)
RETURNS TABLE (video_id TEXT, score DOUBLE PRECISION, mode TEXT, served_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  RETURN QUERY
    SELECT fr.video_id, fr.score, fr.mode, fr.served_at
    FROM public.feed_recommendations fr
    WHERE fr.user_id = _uid
    ORDER BY fr.score DESC, fr.served_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(_limit,20), 100));
END; $$;
REVOKE ALL ON FUNCTION public.rank_feed_for_user(INTEGER) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rank_feed_for_user(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_revenue_event(
  _user_id UUID,
  _source TEXT,
  _amount_krw NUMERIC,
  _attribution_video_id TEXT DEFAULT NULL,
  _attribution_referrer UUID DEFAULT NULL,
  _meta JSONB DEFAULT '{}'::jsonb
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id BIGINT;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF _source NOT IN ('subscription','ad','fee','other') THEN RAISE EXCEPTION 'invalid_source'; END IF;
  INSERT INTO public.revenue_events(user_id, source, amount_krw, attribution_video_id, attribution_referrer, meta)
  VALUES (_user_id, _source, _amount_krw, _attribution_video_id, _attribution_referrer, COALESCE(_meta,'{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.record_revenue_event(UUID,TEXT,NUMERIC,TEXT,UUID,JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_revenue_event(UUID,TEXT,NUMERIC,TEXT,UUID,JSONB) TO authenticated;

-- ============= 5. Permission baseline registration ==========
INSERT INTO public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note) VALUES
  ('record_feed_event', 'text, text, integer, text', '{authenticated}', 'recommendation', 'V17 feed event ingestion (own user)'),
  ('rank_feed_for_user', 'integer', '{authenticated}', 'recommendation', 'V17 personalized feed read (own user)'),
  ('record_revenue_event', 'uuid, text, numeric, text, uuid, jsonb', '{authenticated}', 'revenue', 'V17 revenue event ingestion (admin only)')
ON CONFLICT (function_name, function_args) DO UPDATE
  SET allowed_roles = EXCLUDED.allowed_roles, category = EXCLUDED.category, note = EXCLUDED.note, updated_at = now();
