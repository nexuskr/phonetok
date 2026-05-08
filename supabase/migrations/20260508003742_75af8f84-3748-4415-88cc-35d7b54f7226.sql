
-- ========== security_audit_log ==========
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  issue_count integer NOT NULL DEFAULT 0,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'cron'
);
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sal_admin_read ON public.security_audit_log;
CREATE POLICY sal_admin_read ON public.security_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_sal_created ON public.security_audit_log (created_at DESC);

-- ========== cron_settle_audit_log ==========
CREATE TABLE IF NOT EXISTS public.cron_settle_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  settled_count integer NOT NULL DEFAULT 0,
  duration_ms integer,
  caller text,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.cron_settle_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS csal_admin_read ON public.cron_settle_audit_log;
CREATE POLICY csal_admin_read ON public.cron_settle_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_csal_created ON public.cron_settle_audit_log (created_at DESC);

-- ========== check_rls_integrity ==========
CREATE OR REPLACE FUNCTION public.check_rls_integrity()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  issues jsonb := '[]'::jsonb;
  must_have_rls text[] := ARRAY[
    'package_purchases','transactions','wallet_balances','mission_history',
    'daily_stats','deposit_requests','withdrawal_requests','user_roles',
    'profiles','empire_founding_seats','error_logs','security_audit_log',
    'cron_settle_audit_log'
  ];
  t text;
  rls_on boolean;
  pol_count integer;
BEGIN
  -- 1. Every protected table must have RLS enabled and at least one policy
  FOREACH t IN ARRAY must_have_rls LOOP
    SELECT c.relrowsecurity INTO rls_on
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = t;
    IF rls_on IS NULL THEN
      issues := issues || jsonb_build_object('table', t, 'severity','error','msg','table missing');
      CONTINUE;
    END IF;
    IF NOT rls_on THEN
      issues := issues || jsonb_build_object('table', t, 'severity','error','msg','RLS disabled');
    END IF;
    SELECT count(*) INTO pol_count FROM pg_policies WHERE schemaname='public' AND tablename=t;
    IF pol_count = 0 THEN
      issues := issues || jsonb_build_object('table', t, 'severity','error','msg','no RLS policies');
    END IF;
  END LOOP;

  -- 2. user_roles must NOT have any permissive INSERT/UPDATE/DELETE policy for non-admin paths
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='user_roles'
       AND cmd IN ('INSERT','UPDATE','DELETE')
       AND policyname NOT IN ('roles_admin_write','roles_block_self_write')
  ) THEN
    issues := issues || jsonb_build_object('table','user_roles','severity','error',
      'msg','unexpected write policy on user_roles');
  END IF;

  -- 3. transactions / wallet_balances / mission_history must not allow direct user writes
  FOREACH t IN ARRAY ARRAY['transactions','wallet_balances','mission_history','daily_stats',
                           'roulette_spins','referral_earnings','profit_share_distributions'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename=t AND cmd IN ('INSERT','UPDATE','DELETE')
    ) THEN
      issues := issues || jsonb_build_object('table',t,'severity','error',
        'msg','direct write policy on append-only table');
    END IF;
  END LOOP;

  -- 4. package_purchases: status changes must be admin-only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='package_purchases'
       AND cmd='UPDATE' AND qual ILIKE '%has_role%admin%'
  ) THEN
    issues := issues || jsonb_build_object('table','package_purchases','severity','error',
      'msg','UPDATE policy is not admin-gated');
  END IF;

  -- 5. has_role function must be SECURITY DEFINER with locked search_path
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='has_role'
       AND p.prosecdef = true
       AND 'search_path=public' = ANY(p.proconfig)
  ) THEN
    issues := issues || jsonb_build_object('function','has_role','severity','error',
      'msg','has_role() not SECURITY DEFINER with search_path=public');
  END IF;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(issues) = 0,
    'issue_count', jsonb_array_length(issues),
    'issues', issues,
    'checked_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rls_integrity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_rls_integrity() TO authenticated;

-- Wrapper: admin-only entrypoint that records the result
CREATE OR REPLACE FUNCTION public.run_security_self_audit(_source text DEFAULT 'manual')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  result := public.check_rls_integrity();
  INSERT INTO public.security_audit_log (ok, issue_count, issues, source)
    VALUES ((result->>'ok')::boolean, (result->>'issue_count')::int, result->'issues', _source);
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_security_self_audit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_security_self_audit(text) TO authenticated;

-- Internal cron-only variant (no auth check, only callable via cron / service_role)
CREATE OR REPLACE FUNCTION public._cron_security_self_audit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  result := public.check_rls_integrity();
  INSERT INTO public.security_audit_log (ok, issue_count, issues, source)
    VALUES ((result->>'ok')::boolean, (result->>'issue_count')::int, result->'issues', 'pg_cron');
END;
$$;
REVOKE EXECUTE ON FUNCTION public._cron_security_self_audit() FROM PUBLIC, anon, authenticated;

-- ========== Defense-in-depth: explicit deny on user_roles self-write ==========
DROP POLICY IF EXISTS roles_block_self_write ON public.user_roles;
CREATE POLICY roles_block_self_write ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ========== Cron settle audit insert helper ==========
CREATE OR REPLACE FUNCTION public.log_cron_settle(
  _ok boolean,
  _settled_count integer,
  _duration_ms integer,
  _caller text,
  _error text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role only';
  END IF;
  INSERT INTO public.cron_settle_audit_log (ok, settled_count, duration_ms, caller, error, metadata)
    VALUES (_ok, COALESCE(_settled_count,0), _duration_ms, _caller, _error, COALESCE(_metadata,'{}'::jsonb));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_cron_settle(boolean,integer,integer,text,text,jsonb) FROM PUBLIC, anon, authenticated;

-- ========== Schedule daily security self-audit ==========
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'security-self-audit-daily') THEN
    PERFORM cron.unschedule('security-self-audit-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'security-self-audit-daily',
  '15 3 * * *',
  $$ SELECT public._cron_security_self_audit(); $$
);
