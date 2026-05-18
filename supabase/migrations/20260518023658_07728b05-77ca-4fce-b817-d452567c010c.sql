
-- IMPERIAL-SINGULARITY: Phase 3 Final - emergency freeze + telemetry + health dashboard

ALTER TABLE public.imperial_duel_rooms
  ADD COLUMN IF NOT EXISTS emergency_freeze_flag boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.imperial_duel_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id uuid NOT NULL,
  function_name text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warn','error')),
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_duel_telemetry_trace ON public.imperial_duel_telemetry(trace_id);
CREATE INDEX IF NOT EXISTS idx_duel_telemetry_created ON public.imperial_duel_telemetry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duel_telemetry_sev ON public.imperial_duel_telemetry(severity, created_at DESC);

ALTER TABLE public.imperial_duel_telemetry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "duel_telem_admin_read" ON public.imperial_duel_telemetry;
CREATE POLICY "duel_telem_admin_read" ON public.imperial_duel_telemetry
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.imperial_duel_alert_thresholds (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  house_edge_drift_bps integer NOT NULL DEFAULT 10,
  error_rate_bps integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.imperial_duel_alert_thresholds(id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.imperial_duel_alert_thresholds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "duel_thresh_admin_all" ON public.imperial_duel_alert_thresholds;
CREATE POLICY "duel_thresh_admin_all" ON public.imperial_duel_alert_thresholds
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Telemetry insert RPC (callable by anyone but content gated by severity validation)
CREATE OR REPLACE FUNCTION public.log_duel_telemetry(
  _trace uuid, _fn text, _sev text, _evt text, _payload jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _sev NOT IN ('info','warn','error') THEN RAISE EXCEPTION 'invalid_severity'; END IF;
  INSERT INTO imperial_duel_telemetry(trace_id, function_name, severity, event, payload)
  VALUES (_trace, COALESCE(_fn,'unknown'), _sev, COALESCE(_evt,'unknown'), COALESCE(_payload,'{}'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.log_duel_telemetry(uuid,text,text,text,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.log_duel_telemetry(uuid,text,text,text,jsonb) TO authenticated, service_role;

-- Admin: emergency freeze toggle (AAL2 enforced by frontend gate; double-check role)
CREATE OR REPLACE FUNCTION public.admin_set_duel_emergency_freeze(_room_id uuid, _on boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT has_role(v_uid,'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE imperial_duel_rooms SET emergency_freeze_flag = COALESCE(_on,false) WHERE id = _room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  INSERT INTO imperial_duel_telemetry(trace_id, function_name, severity, event, payload)
  VALUES (gen_random_uuid(),'admin_set_duel_emergency_freeze','warn','freeze_toggled',
          jsonb_build_object('room_id',_room_id,'on',_on,'by',v_uid));
  RETURN jsonb_build_object('ok',true,'room_id',_room_id,'frozen',_on);
END $$;
REVOKE ALL ON FUNCTION public.admin_set_duel_emergency_freeze(uuid,boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_duel_emergency_freeze(uuid,boolean) TO authenticated;

-- Admin: 24h health snapshot
CREATE OR REPLACE FUNCTION public.admin_get_duel_health_24h()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_bet_volume numeric;
  v_bet_count bigint;
  v_pot_in numeric;
  v_payout_out numeric;
  v_house_edge_actual numeric;
  v_error_count bigint;
  v_total_telem bigint;
  v_active_rooms bigint;
  v_p95_latency numeric;
  v_nm_buckets jsonb;
  v_thresh imperial_duel_alert_thresholds;
BEGIN
  IF v_uid IS NULL OR NOT has_role(v_uid,'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COALESCE(SUM(amount_phon),0), COUNT(*) INTO v_bet_volume, v_bet_count
    FROM imperial_duel_bets WHERE created_at > now() - interval '24 hours';

  SELECT COALESCE(SUM(amount_phon) FILTER (WHERE kind='pot_in'),0),
         COALESCE(SUM(amount_phon) FILTER (WHERE kind='payout_out'),0)
    INTO v_pot_in, v_payout_out
    FROM imperial_house_ledger WHERE created_at > now() - interval '24 hours';

  v_house_edge_actual := CASE WHEN v_pot_in > 0
    THEN ROUND(((v_pot_in - v_payout_out) / v_pot_in)::numeric * 10000, 2)
    ELSE NULL END;

  SELECT COUNT(*) FILTER (WHERE severity='error'), COUNT(*)
    INTO v_error_count, v_total_telem
    FROM imperial_duel_telemetry WHERE created_at > now() - interval '24 hours';

  SELECT COUNT(*) INTO v_active_rooms FROM imperial_duel_rooms
    WHERE status IN ('open','locked') AND created_at > now() - interval '24 hours';

  SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY (payload->>'latency_ms')::numeric)
    INTO v_p95_latency FROM imperial_duel_telemetry
    WHERE created_at > now() - interval '24 hours'
      AND function_name='imperial-bet-settle' AND payload ? 'latency_ms';

  SELECT jsonb_object_agg(bucket, n) INTO v_nm_buckets FROM (
    SELECT CASE
      WHEN (settle_meta->>'near_miss_intensity')::numeric >= 0.8 THEN 'climax'
      WHEN (settle_meta->>'near_miss_intensity')::numeric >= 0.4 THEN 'tense'
      ELSE 'calm' END AS bucket, COUNT(*) AS n
    FROM imperial_duel_rooms
    WHERE status='settled' AND settle_at > now() - interval '24 hours'
      AND settle_meta ? 'near_miss_intensity'
    GROUP BY 1
  ) t;

  SELECT * INTO v_thresh FROM imperial_duel_alert_thresholds WHERE id=1;

  RETURN jsonb_build_object(
    'bet_volume_24h', v_bet_volume,
    'bet_count_24h', v_bet_count,
    'pot_in_24h', v_pot_in,
    'payout_out_24h', v_payout_out,
    'house_edge_actual_bps', v_house_edge_actual,
    'house_edge_target_bps', 620,
    'house_edge_drift_bps', CASE WHEN v_house_edge_actual IS NOT NULL
                                 THEN ABS(v_house_edge_actual - 620) ELSE NULL END,
    'error_count_24h', v_error_count,
    'telem_count_24h', v_total_telem,
    'error_rate_bps', CASE WHEN v_total_telem > 0
                           THEN ROUND((v_error_count::numeric / v_total_telem) * 10000, 2) ELSE 0 END,
    'active_rooms', v_active_rooms,
    'p95_settle_latency_ms', v_p95_latency,
    'near_miss_buckets', COALESCE(v_nm_buckets,'{}'::jsonb),
    'thresholds', jsonb_build_object(
      'house_edge_drift_bps', v_thresh.house_edge_drift_bps,
      'error_rate_bps', v_thresh.error_rate_bps
    ),
    'generated_at', now()
  );
END $$;
REVOKE ALL ON FUNCTION public.admin_get_duel_health_24h() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_duel_health_24h() TO authenticated;

-- Inject freeze guard into existing place + settle RPCs.
-- IMPORTANT: money-flow blocks unchanged; only a top-level guard is added immediately
-- after FOR UPDATE lock. This satisfies the freeze policy without touching ledger writes.

CREATE OR REPLACE FUNCTION public.imperial_place_phon_bet(p_room_id uuid, p_side text, p_amount numeric, p_idem_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_house uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_room imperial_duel_rooms;
  v_bal numeric;
  v_kill boolean;
  v_existing imperial_duel_bets;
  v_new_house_bal numeric;
  v_bet_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE='42501'; END IF;
  IF p_side NOT IN ('left','right') THEN RAISE EXCEPTION 'invalid_side'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_idem_key IS NULL OR length(p_idem_key) < 8 THEN RAISE EXCEPTION 'invalid_idem_key'; END IF;

  SELECT enabled INTO v_kill FROM platform_kill_switches WHERE key='phon_betting_enabled';
  IF NOT COALESCE(v_kill,false) THEN RAISE EXCEPTION 'phon_betting_disabled'; END IF;

  SELECT * INTO v_existing FROM imperial_duel_bets WHERE user_id=v_uid AND idem_key=p_idem_key;
  IF FOUND THEN
    RETURN jsonb_build_object('ok',true,'idempotent_replay',true,'bet_id',v_existing.id);
  END IF;

  SELECT * INTO v_room FROM imperial_duel_rooms WHERE id=p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  -- IMPERIAL-SINGULARITY: emergency freeze guard (read-only check, no money-flow change)
  IF v_room.emergency_freeze_flag THEN RAISE EXCEPTION 'room_frozen'; END IF;
  IF v_room.status <> 'open' THEN RAISE EXCEPTION 'room_not_open'; END IF;
  IF now() >= v_room.lock_at THEN RAISE EXCEPTION 'room_locked'; END IF;
  IF p_amount < v_room.min_bet THEN RAISE EXCEPTION 'amount_below_min'; END IF;
  IF p_amount > v_room.max_bet THEN RAISE EXCEPTION 'amount_above_max'; END IF;

  SELECT balance INTO v_bal FROM phon_balances WHERE user_id=v_uid FOR UPDATE;
  IF v_bal IS NULL OR v_bal < p_amount THEN RAISE EXCEPTION 'insufficient_phon'; END IF;

  UPDATE phon_balances SET balance=balance-p_amount, updated_at=now() WHERE user_id=v_uid;
  UPDATE phon_balances SET balance=balance+p_amount, updated_at=now()
    WHERE user_id=v_house RETURNING balance INTO v_new_house_bal;

  INSERT INTO imperial_duel_bets(room_id,user_id,side,amount_phon,odds_at_place,idem_key)
  VALUES (p_room_id,v_uid,p_side,p_amount,2.0,p_idem_key)
  RETURNING id INTO v_bet_id;

  INSERT INTO imperial_house_ledger(room_id,kind,amount_phon,balance_after,operator_isolation_flag,meta)
  VALUES (p_room_id,'pot_in',p_amount,v_new_house_bal,true,
          jsonb_build_object('user_id',v_uid,'side',p_side,'bet_id',v_bet_id));

  INSERT INTO imperial_duel_audit(room_id,user_id,event,amount_phon,balance_before,balance_after,meta)
  VALUES (p_room_id,v_uid,'bet_placed',p_amount,v_bal,v_bal-p_amount,
          jsonb_build_object('side',p_side,'bet_id',v_bet_id,'idem_key',p_idem_key));

  RETURN jsonb_build_object('ok',true,'bet_id',v_bet_id,'balance_after',v_bal-p_amount);
END $function$;
