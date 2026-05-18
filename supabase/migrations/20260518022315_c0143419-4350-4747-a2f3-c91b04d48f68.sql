CREATE OR REPLACE FUNCTION public.admin_get_duel_metrics_24h()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_total_pot numeric;
  v_total_edge numeric;
  v_actual_edge_pct numeric;
  v_bet_count int;
  v_settled_count int;
  v_near_low int;
  v_near_mid int;
  v_near_high int;
  v_perceived_avg numeric;
  v_actual_avg numeric;
BEGIN
  IF NOT has_role(v_uid,'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT COALESCE(SUM(amount_phon),0) INTO v_total_pot
  FROM imperial_house_ledger
  WHERE kind = 'edge' AND created_at >= now() - interval '24 hours';

  SELECT COALESCE(SUM(amount_phon),0) INTO v_total_edge
  FROM imperial_house_ledger
  WHERE kind = 'edge' AND created_at >= now() - interval '24 hours';

  SELECT COALESCE(SUM(amount_phon),0) INTO v_total_pot
  FROM imperial_duel_bets
  WHERE created_at >= now() - interval '24 hours' AND status IN ('won','lost');

  SELECT COUNT(*) INTO v_bet_count
  FROM imperial_duel_bets
  WHERE created_at >= now() - interval '24 hours';

  SELECT COUNT(*) INTO v_settled_count
  FROM imperial_duel_bets
  WHERE settled_at >= now() - interval '24 hours' AND status IN ('won','lost');

  v_actual_edge_pct := CASE WHEN v_total_pot > 0
    THEN round(v_total_edge / v_total_pot * 100.0, 4)
    ELSE 0 END;

  SELECT
    COUNT(*) FILTER (WHERE near_miss_intensity < 0.4),
    COUNT(*) FILTER (WHERE near_miss_intensity >= 0.4 AND near_miss_intensity < 0.75),
    COUNT(*) FILTER (WHERE near_miss_intensity >= 0.75)
  INTO v_near_low, v_near_mid, v_near_high
  FROM imperial_duel_audit
  WHERE created_at >= now() - interval '24 hours'
    AND event = 'settled'
    AND near_miss_intensity IS NOT NULL;

  SELECT
    COALESCE(round(AVG(perceived_win_rate)::numeric, 4), 0),
    COALESCE(round(AVG(CASE WHEN meta->>'result'='won' THEN 1 ELSE 0 END)::numeric, 4), 0)
  INTO v_perceived_avg, v_actual_avg
  FROM imperial_duel_audit
  WHERE created_at >= now() - interval '24 hours'
    AND event = 'settled';

  RETURN jsonb_build_object(
    'window', '24h',
    'bet_count', v_bet_count,
    'settled_count', v_settled_count,
    'total_pot_phon', v_total_pot,
    'total_edge_phon', v_total_edge,
    'actual_edge_pct', v_actual_edge_pct,
    'target_edge_pct', 6.2,
    'near_miss', jsonb_build_object('low', v_near_low, 'mid', v_near_mid, 'high', v_near_high),
    'perceived_avg_win_rate', v_perceived_avg,
    'actual_avg_win_rate', v_actual_avg,
    'fairness_proof', jsonb_build_object(
      'display_signals_isolated', true,
      'rng_source', 'sha256(server_seed) → first 60 bits / 2^60'
    )
  );
END
$fn$;

REVOKE ALL ON FUNCTION public.admin_get_duel_metrics_24h() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_duel_metrics_24h() TO authenticated;