-- Sprint 4 Telemetry: client_metrics + error log + admin analytics RPC

CREATE TABLE IF NOT EXISTS public.client_metrics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NULL,
  route       text NOT NULL,
  metric      text NOT NULL,
  value       double precision NOT NULL,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_metrics_metric_chk CHECK (metric IN
    ('inp','lcp','cls','fps_sample','haptic_ok','haptic_fail','swipe_ok','swipe_fail'))
);

CREATE INDEX IF NOT EXISTS idx_client_metrics_metric_created
  ON public.client_metrics (metric, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_metrics_route_created
  ON public.client_metrics (route, created_at DESC);

ALTER TABLE public.client_metrics ENABLE ROW LEVEL SECURITY;

-- Block direct INSERT from anon/auth. Only service_role (edge function) can write.
CREATE POLICY "client_metrics_admin_select"
  ON public.client_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies for authenticated/anon → blocked by RLS.

CREATE TABLE IF NOT EXISTS public.client_metrics_error_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload     jsonb,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_metrics_error_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_metrics_error_admin_select"
  ON public.client_metrics_error_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin analytics RPC -------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_lobby_analytics(window_hours int DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
  v_result jsonb;
  v_hours int := GREATEST(1, LEAST(COALESCE(window_hours, 24), 168));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_since := now() - make_interval(hours => v_hours);

  WITH base AS (
    SELECT metric, value, meta
    FROM public.client_metrics
    WHERE created_at >= v_since
      AND route = '/duel'
  ),
  pct AS (
    SELECT
      metric,
      percentile_cont(0.5)  WITHIN GROUP (ORDER BY value) AS p50,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY value) AS p75,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY value) AS p95,
      avg(value)                                          AS avg,
      min(value)                                          AS min,
      count(*)                                            AS n
    FROM base
    WHERE metric IN ('inp','lcp','cls','fps_sample')
    GROUP BY metric
  ),
  haptic AS (
    SELECT
      sum(CASE WHEN metric='haptic_ok'   THEN 1 ELSE 0 END) AS ok,
      sum(CASE WHEN metric='haptic_fail' THEN 1 ELSE 0 END) AS fail
    FROM base
  ),
  swipe AS (
    SELECT
      sum(CASE WHEN metric='swipe_ok'   THEN 1 ELSE 0 END) AS ok,
      sum(CASE WHEN metric='swipe_fail' THEN 1 ELSE 0 END) AS fail
    FROM base
  ),
  tiers AS (
    SELECT
      coalesce(meta->>'device_tier', 'unknown') AS tier,
      count(*) AS n
    FROM base
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'window_hours', v_hours,
    'generated_at', now(),
    'metrics', (
      SELECT jsonb_object_agg(metric, jsonb_build_object(
        'p50', round(p50::numeric, 3),
        'p75', round(p75::numeric, 3),
        'p95', round(p95::numeric, 3),
        'avg', round(avg::numeric, 3),
        'min', round(min::numeric, 3),
        'n',   n
      )) FROM pct
    ),
    'haptic', (
      SELECT jsonb_build_object(
        'ok',   coalesce(ok,0),
        'fail', coalesce(fail,0),
        'rate', CASE WHEN coalesce(ok,0)+coalesce(fail,0) = 0 THEN NULL
                     ELSE round((ok::numeric / (ok+fail)) * 100, 2) END
      ) FROM haptic
    ),
    'swipe', (
      SELECT jsonb_build_object(
        'ok',   coalesce(ok,0),
        'fail', coalesce(fail,0),
        'rate', CASE WHEN coalesce(ok,0)+coalesce(fail,0) = 0 THEN NULL
                     ELSE round((ok::numeric / (ok+fail)) * 100, 2) END
      ) FROM swipe
    ),
    'device_tiers', (
      SELECT jsonb_object_agg(tier, n) FROM tiers
    )
  ) INTO v_result;

  RETURN coalesce(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_lobby_analytics(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_lobby_analytics(int) TO authenticated;

-- Cleanup function (30d retention)
CREATE OR REPLACE FUNCTION public.cleanup_client_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.client_metrics       WHERE created_at < now() - INTERVAL '30 days';
  DELETE FROM public.client_metrics_error_log WHERE created_at < now() - INTERVAL '30 days';
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_client_metrics() FROM PUBLIC, anon, authenticated;