CREATE OR REPLACE FUNCTION public.public_trust_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  total_paid bigint := 0;
  paid_30d bigint := 0;
  avg_settle_minutes numeric := 0;
  cron_uptime_7d numeric := 100;
  audit_pass_30d numeric := 100;
  policy_pass_7d numeric := 100;
  unack_anomalies int := 0;
  last_cron timestamptz;
  total_members int := 0;
  active_members_30d int := 0;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.transactions
  WHERE kind = 'package_settle' AND direction = 'in';

  SELECT COALESCE(SUM(amount), 0) INTO paid_30d
  FROM public.transactions
  WHERE kind = 'package_settle' AND direction = 'in'
    AND created_at > now() - interval '30 days';

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (approved_at - created_at))/60), 0)::numeric(10,2)
    INTO avg_settle_minutes
  FROM public.package_purchases
  WHERE approved_at IS NOT NULL AND created_at > now() - interval '30 days';

  SELECT COALESCE(
    ROUND(100.0 * SUM(CASE WHEN ok THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2),
    100
  ) INTO cron_uptime_7d
  FROM public.cron_settle_audit_log
  WHERE created_at > now() - interval '7 days';

  SELECT COALESCE(
    ROUND(100.0 * SUM(CASE WHEN ok THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2),
    100
  ) INTO audit_pass_30d
  FROM public.security_audit_log
  WHERE created_at > now() - interval '30 days';

  SELECT COALESCE(
    ROUND(100.0 * SUM(CASE WHEN passed THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2),
    100
  ) INTO policy_pass_7d
  FROM public.policy_assertion_runs
  WHERE created_at > now() - interval '7 days';

  SELECT COUNT(*) INTO unack_anomalies
  FROM public.anomaly_events
  WHERE acknowledged = false;

  SELECT MAX(created_at) INTO last_cron FROM public.cron_settle_audit_log;

  SELECT COUNT(*) INTO total_members FROM public.profiles;

  SELECT COUNT(DISTINCT user_id) INTO active_members_30d
  FROM public.transactions
  WHERE created_at > now() - interval '30 days';

  RETURN jsonb_build_object(
    'total_paid', total_paid,
    'paid_30d', paid_30d,
    'avg_settle_minutes', avg_settle_minutes,
    'cron_uptime_7d', cron_uptime_7d,
    'audit_pass_30d', audit_pass_30d,
    'policy_pass_7d', policy_pass_7d,
    'unack_anomalies', unack_anomalies,
    'last_cron_at', last_cron,
    'total_members', total_members,
    'active_members_30d', active_members_30d,
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_trust_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_trust_metrics() TO anon, authenticated, service_role;