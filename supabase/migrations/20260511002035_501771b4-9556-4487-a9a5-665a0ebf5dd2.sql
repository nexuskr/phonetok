-- Admin EV health: manual trigger
CREATE OR REPLACE FUNCTION public.admin_run_ev_health_now()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_res jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = '42501';
  END IF;
  SELECT public.check_daily_ev_health() INTO v_res;
  RETURN v_res;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_run_ev_health_now() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_run_ev_health_now() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_ev_history(_limit int DEFAULT 30)
RETURNS TABLE(id uuid, created_at timestamptz, severity text, dedupe_key text, evidence jsonb)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ae.id, ae.created_at, ae.severity, ae.dedupe_key, ae.evidence
  FROM public.anomaly_events ae
  WHERE has_role(auth.uid(), 'admin'::app_role)
    AND ae.rule = 'negative_ev'
  ORDER BY ae.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
$$;
REVOKE ALL ON FUNCTION public.admin_get_ev_history(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_ev_history(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_ab_active(_key text, _active boolean)
RETURNS TABLE(experiment_key text, is_active boolean, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    UPDATE public.ab_experiments e
       SET is_active = _active, updated_at = now()
     WHERE e.experiment_key = _key
    RETURNING e.experiment_key, e.is_active, e.updated_at;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_ab_active(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_ab_active(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_ab_stats(_key text)
RETURNS TABLE(variant text, assignments bigint)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT a.variant, COUNT(*)::bigint AS assignments
  FROM public.ab_assignments a
  WHERE has_role(auth.uid(), 'admin'::app_role)
    AND a.experiment_key = _key
  GROUP BY a.variant
  ORDER BY a.variant;
$$;
REVOKE ALL ON FUNCTION public.admin_get_ab_stats(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_ab_stats(text) TO authenticated;

INSERT INTO public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note)
VALUES
  ('admin_run_ev_health_now', '', ARRAY['authenticated'], 'admin_only', 'Internal admin guard via has_role.'),
  ('admin_get_ev_history',    'integer', ARRAY['authenticated'], 'admin_only', 'Internal admin guard via has_role.'),
  ('admin_set_ab_active',     'text, boolean', ARRAY['authenticated'], 'admin_only', 'Internal admin guard via has_role.'),
  ('admin_get_ab_stats',      'text', ARRAY['authenticated'], 'admin_only', 'Internal admin guard via has_role.')
ON CONFLICT (function_name, function_args) DO UPDATE SET allowed_roles = EXCLUDED.allowed_roles, category = EXCLUDED.category, note = EXCLUDED.note;