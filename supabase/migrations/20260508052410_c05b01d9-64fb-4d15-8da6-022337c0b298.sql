-- Conversion telemetry events
CREATE TABLE public.conversion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  anon_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('view','cta_click','dismiss','convert')),
  surface text NOT NULL,
  variant text NOT NULL DEFAULT 'default',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_events_surface_type_ts ON public.conversion_events(surface, event_type, created_at DESC);
CREATE INDEX idx_conv_events_user_ts ON public.conversion_events(user_id, created_at DESC);
CREATE INDEX idx_conv_events_anon_ts ON public.conversion_events(anon_id, created_at DESC);
CREATE INDEX idx_conv_events_created_at ON public.conversion_events(created_at DESC);

ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authed) can insert their own event; user_id must match auth.uid() if provided
CREATE POLICY ce_insert_any
ON public.conversion_events
FOR INSERT
TO public
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND length(anon_id) BETWEEN 8 AND 64
  AND length(surface) BETWEEN 1 AND 64
  AND length(variant) <= 64
);

-- Admin-only read
CREATE POLICY ce_admin_read
ON public.conversion_events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Rate-limit trigger: max 30 events per anon_id per 10 seconds
CREATE OR REPLACE FUNCTION public.conversion_events_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.conversion_events
  WHERE anon_id = NEW.anon_id
    AND created_at > now() - interval '10 seconds';
  IF recent_count >= 30 THEN
    RAISE EXCEPTION 'rate_limit_exceeded' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_conversion_events_rate_limit
BEFORE INSERT ON public.conversion_events
FOR EACH ROW EXECUTE FUNCTION public.conversion_events_rate_limit();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversion_events;

-- Add to permission baseline
INSERT INTO public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note)
VALUES ('conversion_events_rate_limit', '', ARRAY['postgres','supabase_admin']::text[], 'trigger', 'Rate limit guard for conversion_events inserts')
ON CONFLICT DO NOTHING;