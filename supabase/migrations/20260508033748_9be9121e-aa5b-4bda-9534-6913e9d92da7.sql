-- 1) baseline table
CREATE TABLE IF NOT EXISTS public.function_permissions_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  function_args text NOT NULL DEFAULT '',
  allowed_roles text[] NOT NULL DEFAULT '{}',
  category text NOT NULL,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (function_name, function_args)
);
ALTER TABLE public.function_permissions_baseline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fpb_admin_read ON public.function_permissions_baseline;
DROP POLICY IF EXISTS fpb_admin_write ON public.function_permissions_baseline;
CREATE POLICY fpb_admin_read ON public.function_permissions_baseline FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY fpb_admin_write ON public.function_permissions_baseline FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 2) change log
CREATE TABLE IF NOT EXISTS public.permission_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at timestamptz NOT NULL DEFAULT now(),
  function_name text NOT NULL,
  function_args text NOT NULL,
  expected_roles text[] NOT NULL,
  observed_roles text[] NOT NULL,
  change_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.permission_change_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pcl_admin_read ON public.permission_change_log;
CREATE POLICY pcl_admin_read ON public.permission_change_log FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));

-- 3) seed baseline
INSERT INTO public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note) VALUES
  ('_cron_security_self_audit','','{}','system_only','cron'),
  ('_cron_settle_package_daily','','{}','system_only','cron'),
  ('auto_freeze_critical_anomalies','','{}','system_only','cron'),
  ('detect_anomalies','','{}','system_only','cron'),
  ('handle_new_user','','{}','system_only','auth trigger'),
  ('block_withdrawal_when_frozen','','{}','system_only','row trigger'),
  ('log_cron_settle','_ok boolean, _settled_count integer, _duration_ms integer, _caller text, _error text, _metadata jsonb','{}','system_only','cron'),
  ('move_to_dlq','source_queue text, dlq_name text, message_id bigint, payload jsonb','{}','system_only','queue'),
  ('read_email_batch','queue_name text, batch_size integer, vt integer','{}','system_only','queue'),
  ('delete_email','queue_name text, message_id bigint','{}','system_only','queue'),
  ('enqueue_email','queue_name text, payload jsonb','{}','system_only','queue'),
  ('record_chaos_run','_total integer, _passed integer, _failed integer, _duration_ms integer, _results jsonb, _source text','{}','system_only','service_role'),
  ('record_chaos_run','_source text, _total integer, _passed integer, _failed integer, _duration_ms integer, _results jsonb','{}','system_only','service_role'),
  ('ingest_span_quality_alert','_reason text, _metrics jsonb','{}','system_only','service_role'),
  ('check_rls_integrity','','{}','system_only','audit'),
  ('distribute_profit_share','_pool_total bigint, _period_start timestamp with time zone, _period_end timestamp with time zone','{}','system_only','cron'),
  ('run_uptime_canary','','{}','system_only','cron'),
  ('admin_adjust_balance','_target uuid, _delta bigint, _reason text','{}','admin_only','admin RPC (revoked, internal has_role)'),
  ('admin_get_user_email','_user_id uuid','{}','admin_only','admin RPC'),
  ('admin_release_freeze','_freeze_id uuid, _note text','{}','admin_only','admin RPC'),
  ('admin_resolve_deposit','_request_id uuid, _action text, _reason text','{}','admin_only','admin RPC'),
  ('admin_resolve_package','_purchase_id uuid, _action text, _reason text','{}','admin_only','admin RPC'),
  ('admin_resolve_withdrawal','_request_id uuid, _action text, _reason text','{}','admin_only','admin RPC'),
  ('admin_set_tier','_target uuid, _tier user_tier','{}','admin_only','admin RPC'),
  ('acknowledge_anomaly','_id uuid, _note text','{}','admin_only','admin RPC'),
  ('bulk_acknowledge_anomalies','_ids uuid[], _note text','{}','admin_only','admin RPC'),
  ('redetect_anomaly','_id uuid','{}','admin_only','admin RPC'),
  ('get_admin_metrics','_days integer','{}','admin_only','admin RPC'),
  ('get_top_users','_limit integer','{}','admin_only','admin RPC'),
  ('get_error_stats','_hours integer','{}','admin_only','admin RPC'),
  ('get_recent_errors','_limit integer','{}','admin_only','admin RPC'),
  ('settle_mission','_mission_id text, _is_win boolean, _base_reward bigint','{authenticated}','user_callable','user RPC'),
  ('harvest_machine','_purchase_id uuid','{authenticated}','user_callable','user RPC'),
  ('apply_referral_code','_code text','{authenticated}','user_callable','user RPC'),
  ('equip_badge','_badge_key text, _slot integer','{authenticated}','user_callable','user RPC'),
  ('gacha_pull','','{authenticated}','user_callable','user RPC'),
  ('request_withdrawal','_amount bigint, _method withdrawal_method, _bank_name text, _bank_account text, _coin_address text, _coin_network text, _pin text','{authenticated}','user_callable','user RPC'),
  ('submit_package_purchase','_package_id text, _package_name text, _amount bigint, _daily_return bigint, _duration_days integer, _total_return bigint, _receipt_url text','{authenticated}','user_callable','user RPC'),
  ('claim_daily_attendance','user_id uuid','{authenticated}','user_callable','user RPC'),
  ('claim_quest','_quest_key text','{authenticated}','user_callable','user RPC'),
  ('claim_season_reward','_level integer, _track text','{authenticated}','user_callable','user RPC'),
  ('claim_ai_bot_run','_run_id uuid','{authenticated}','user_callable','user RPC'),
  ('purchase_season_pass','','{authenticated}','user_callable','user RPC'),
  ('finalize_ai_bot_run','_run_id uuid, _output_text text, _output_path text, _error text','{authenticated}','user_callable','user RPC'),
  ('log_client_error','_message text, _stack text, _url text, _user_agent text, _context jsonb, _level text','{authenticated}','user_callable','user RPC'),
  ('get_my_quests','','{authenticated}','user_callable','user read RPC'),
  ('my_active_freeze','','{authenticated}','user_callable','user read RPC'),
  ('is_account_frozen','_user_id uuid','{authenticated}','user_callable','user read RPC'),
  ('has_role','_user_id uuid, _role app_role','{authenticated}','user_callable','helper'),
  ('get_referral_stats','','{authenticated}','user_callable','user read RPC'),
  ('get_season_overview','','{authenticated}','user_callable','user read RPC'),
  ('get_ai_bot_stats','_days integer','{authenticated}','user_callable','user read RPC'),
  ('get_active_boost_count','','{authenticated}','user_callable','user read RPC'),
  ('get_empire_seats_remaining','','{authenticated}','user_callable','user read RPC'),
  ('get_next_empire_day','','{authenticated}','user_callable','user read RPC'),
  ('get_roulette_stats','','{authenticated}','user_callable','user read RPC'),
  ('get_referral_leaderboard','_limit integer','{authenticated}','user_callable','user read RPC'),
  ('get_tier_distribution','','{authenticated}','user_callable','user read RPC'),
  ('award_xp','_amount bigint, _source jsonb','{authenticated}','user_callable','PERFORMed'),
  ('bump_quest_metric','_metric text, _delta integer','{authenticated}','user_callable','PERFORMed'),
  ('bump_jackpot','_amount bigint','{authenticated}','user_callable','PERFORMed'),
  ('_credit_referral_commission','_invitee uuid, _base bigint, _source text','{authenticated}','user_callable','PERFORMed'),
  ('reset_withdraw_pin','_new_pin text, _method text','{authenticated}','user_callable','user RPC'),
  ('policy_assertions_status','','{authenticated}','user_callable','public read'),
  ('run_policy_assertions','','{authenticated}','user_callable','admin/service guarded internally')
ON CONFLICT (function_name, function_args) DO UPDATE
  SET allowed_roles = EXCLUDED.allowed_roles,
      category = EXCLUDED.category,
      note = EXCLUDED.note,
      updated_at = now();

-- 4) drift checker
CREATE OR REPLACE FUNCTION public.check_permission_drift()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; observed text[]; drift_count int := 0; drifts jsonb := '[]'::jsonb;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR auth.role() = 'service_role' OR auth.uid() IS NULL) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  FOR r IN SELECT * FROM public.function_permissions_baseline LOOP
    SELECT COALESCE(array_agg(DISTINCT grantee::text ORDER BY grantee::text), '{}'::text[])
      INTO observed
    FROM information_schema.routine_privileges
    WHERE routine_schema='public' AND routine_name=r.function_name
      AND privilege_type='EXECUTE'
      AND grantee::text IN ('anon','authenticated','PUBLIC');
    IF NOT (observed <@ r.allowed_roles AND r.allowed_roles <@ observed) THEN
      drift_count := drift_count + 1;
      drifts := drifts || jsonb_build_object('function',r.function_name,'args',r.function_args,'expected',r.allowed_roles,'observed',observed,'category',r.category);
      INSERT INTO public.permission_change_log(function_name,function_args,expected_roles,observed_roles,change_type,metadata)
      VALUES (r.function_name,r.function_args,r.allowed_roles,observed,'drift',jsonb_build_object('category',r.category));
      INSERT INTO public.anomaly_events(rule,severity,evidence,dedupe_key)
      VALUES ('permission_drift',
              CASE WHEN r.category IN ('admin_only','system_only') THEN 'critical' ELSE 'medium' END,
              jsonb_build_object('function',r.function_name,'expected',r.allowed_roles,'observed',observed,'category',r.category),
              'permdrift:'||r.function_name||':'||r.function_args||':'||to_char(now(),'YYYY-MM-DD-HH24'))
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok',drift_count=0,'drift_count',drift_count,'drifts',drifts,'checked_at',now());
END $$;
REVOKE EXECUTE ON FUNCTION public.check_permission_drift() FROM PUBLIC, anon;

-- 5) admin overview RPC
CREATE OR REPLACE FUNCTION public.get_function_permissions_overview()
RETURNS TABLE(function_name text, function_args text, category text, expected_roles text[], observed_roles text[], in_drift boolean, note text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; obs text[];
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  FOR r IN
    SELECT b.function_name AS fn, b.function_args AS fa, b.category AS cat, b.allowed_roles AS exp, b.note AS nt
    FROM public.function_permissions_baseline b
    ORDER BY CASE b.category WHEN 'admin_only' THEN 0 WHEN 'system_only' THEN 1 ELSE 2 END, b.function_name
  LOOP
    SELECT COALESCE(array_agg(DISTINCT grantee::text ORDER BY grantee::text), '{}'::text[]) INTO obs
    FROM information_schema.routine_privileges
    WHERE routine_schema='public' AND routine_name=r.fn AND privilege_type='EXECUTE'
      AND grantee::text IN ('anon','authenticated','PUBLIC');
    function_name := r.fn;
    function_args := r.fa;
    category := r.cat;
    expected_roles := r.exp;
    observed_roles := obs;
    in_drift := NOT (obs <@ r.exp AND r.exp <@ obs);
    note := r.nt;
    RETURN NEXT;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_function_permissions_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_function_permissions_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_audit_recent(_limit integer DEFAULT 100)
RETURNS TABLE(id uuid, created_at timestamptz, admin_id uuid, action text, target_type text, target_id uuid, metadata jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, created_at, admin_id, action, target_type, target_id, metadata
  FROM public.admin_audit_log
  WHERE has_role(auth.uid(),'admin')
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
$$;
REVOKE EXECUTE ON FUNCTION public.get_admin_audit_recent(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_recent(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_permission_change_log(_limit integer DEFAULT 100)
RETURNS SETOF public.permission_change_log
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.permission_change_log
  WHERE has_role(auth.uid(),'admin')
  ORDER BY detected_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
$$;
REVOKE EXECUTE ON FUNCTION public.get_permission_change_log(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_permission_change_log(integer) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.permission_change_log;