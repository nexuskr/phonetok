CREATE OR REPLACE FUNCTION public.admin_cron_status()
RETURNS TABLE(
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  last_run_at timestamptz,
  last_status text,
  last_duration_ms bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, cron
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    j.jobid,
    j.jobname::text,
    j.schedule::text,
    j.active,
    last_run.start_time AS last_run_at,
    last_run.status::text AS last_status,
    CASE
      WHEN last_run.end_time IS NOT NULL AND last_run.start_time IS NOT NULL
        THEN EXTRACT(EPOCH FROM (last_run.end_time - last_run.start_time))::bigint * 1000
      ELSE NULL
    END AS last_duration_ms
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT d.start_time, d.end_time, d.status
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
    ORDER BY d.start_time DESC NULLS LAST
    LIMIT 1
  ) last_run ON TRUE
  ORDER BY j.jobname;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cron_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cron_status() TO authenticated;

NOTIFY pgrst, 'reload schema';