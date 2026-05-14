
-- 1) Relax oracle freshness limit to 60s
UPDATE public.trading_safeguards_config SET oracle_max_age_seconds = 60, updated_at = now() WHERE id = 1;

-- 2) Self-healing assert_trading_price
CREATE OR REPLACE FUNCTION public.assert_trading_price(p_symbol text, p_price numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_oracle numeric;
  v_age int;
  v_dev_limit numeric;
  v_max_age int;
  v_enabled boolean;
  v_dev numeric;
  v_soft_dev numeric := 5.0; -- ±5% self-heal window when oracle is stale
BEGIN
  SELECT enabled, price_deviation_pct, oracle_max_age_seconds
    INTO v_enabled, v_dev_limit, v_max_age
  FROM trading_safeguards_config WHERE id=1;
  IF v_enabled IS DISTINCT FROM true THEN RETURN; END IF;
  IF p_price <= 0 THEN RAISE EXCEPTION 'invalid price' USING ERRCODE='22023'; END IF;

  SELECT last_price, EXTRACT(EPOCH FROM (now()-updated_at))::int
    INTO v_oracle, v_age
  FROM oracle_prices WHERE symbol = p_symbol;

  IF v_oracle IS NULL THEN
    INSERT INTO anomaly_events(rule, severity, user_id, evidence, dedupe_key)
    VALUES ('oracle_missing','low', v_uid,
      jsonb_build_object('symbol',p_symbol,'price',p_price),
      'oracle_missing:'||p_symbol||':'||to_char(now(),'YYYYMMDDHH24MI'))
    ON CONFLICT DO NOTHING;
    RETURN;
  END IF;

  v_dev := abs(p_price - v_oracle) / v_oracle * 100.0;

  IF v_age > v_max_age THEN
    -- Stale oracle: self-heal only if user price is within soft window
    IF v_dev <= v_soft_dev THEN
      INSERT INTO anomaly_events(rule, severity, user_id, evidence, dedupe_key)
      VALUES ('oracle_stale_softpass','low', v_uid,
        jsonb_build_object('symbol',p_symbol,'age_s',v_age,'dev_pct',v_dev),
        'oracle_softpass:'||p_symbol||':'||to_char(now(),'YYYYMMDDHH24MI'))
      ON CONFLICT DO NOTHING;
      RETURN;
    END IF;
    INSERT INTO anomaly_events(rule, severity, user_id, evidence, dedupe_key)
    VALUES ('oracle_stale','medium', v_uid,
      jsonb_build_object('symbol',p_symbol,'age_s',v_age,'max',v_max_age,'dev_pct',v_dev),
      'oracle_stale:'||p_symbol||':'||to_char(now(),'YYYYMMDDHH24MI'))
    ON CONFLICT DO NOTHING;
    RAISE EXCEPTION '시장가 동기화가 지연되었고 입력 가격이 시장가와 차이가 큽니다. 잠시 후 재시도해 주세요.' USING ERRCODE='54000';
  END IF;

  IF v_dev > v_dev_limit THEN
    INSERT INTO anomaly_events(rule, severity, user_id, evidence, dedupe_key)
    VALUES ('price_deviation','high', v_uid,
      jsonb_build_object('symbol',p_symbol,'submitted',p_price,'oracle',v_oracle,'dev_pct',v_dev,'limit_pct',v_dev_limit),
      'pricedev:'||v_uid::text||':'||p_symbol||':'||to_char(now(),'YYYYMMDDHH24MISS'));
    RAISE EXCEPTION '시장가와 차이가 너무 큽니다. 다시 시도해 주세요.' USING ERRCODE='22023';
  END IF;
END;
$function$;

-- 3) Adjust isolated margin (add or reduce). Owner-only. Rejects cross positions.
CREATE OR REPLACE FUNCTION public.live_adjust_isolated_margin(
  p_position_id uuid,
  p_delta_margin numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pos record;
  v_new_alloc numeric;
  v_bal numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF p_delta_margin = 0 THEN RAISE EXCEPTION 'delta_zero' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_pos FROM live_positions
   WHERE id = p_position_id AND user_id = v_uid AND status = 'open'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'position not found' USING ERRCODE='42704'; END IF;
  IF COALESCE(v_pos.margin_mode,'isolated') <> 'isolated' THEN
    RAISE EXCEPTION 'cross_position_not_adjustable' USING ERRCODE='22023';
  END IF;

  v_new_alloc := COALESCE(v_pos.allocated_margin, v_pos.margin) + p_delta_margin;
  IF v_new_alloc < v_pos.margin * 0.1 THEN
    RAISE EXCEPTION 'allocated_below_minimum' USING ERRCODE='22023';
  END IF;

  IF p_delta_margin > 0 THEN
    SELECT balance INTO v_bal FROM phon_balances WHERE user_id = v_uid FOR UPDATE;
    IF COALESCE(v_bal,0) < p_delta_margin THEN
      RAISE EXCEPTION 'insufficient_balance' USING ERRCODE='22023';
    END IF;
    UPDATE phon_balances SET balance = balance - p_delta_margin, updated_at = now() WHERE user_id = v_uid;
  ELSE
    UPDATE phon_balances SET balance = balance + abs(p_delta_margin), updated_at = now() WHERE user_id = v_uid;
  END IF;

  UPDATE live_positions
     SET allocated_margin = v_new_alloc,
         updated_at = now()
   WHERE id = p_position_id;

  RETURN jsonb_build_object(
    'ok', true,
    'position_id', p_position_id,
    'allocated_margin', v_new_alloc,
    'delta', p_delta_margin
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.live_adjust_isolated_margin(uuid,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.live_adjust_isolated_margin(uuid,numeric) TO authenticated;

-- 4) Cross summary
CREATE OR REPLACE FUNCTION public.live_get_cross_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_balance numeric := 0;
  v_used numeric := 0;
  v_count int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(balance,0) INTO v_balance FROM phon_balances WHERE user_id = v_uid;

  SELECT COALESCE(SUM(margin),0), COUNT(*)::int
    INTO v_used, v_count
    FROM live_positions
   WHERE user_id = v_uid AND status='open' AND COALESCE(margin_mode,'isolated') = 'cross';

  RETURN jsonb_build_object(
    'balance', v_balance,
    'used_margin', v_used,
    'available', GREATEST(v_balance - 0, 0),
    'cross_position_count', v_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.live_get_cross_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.live_get_cross_summary() TO authenticated;

-- 5) pg_cron: refresh oracle every 10s via edge function
DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- Skip if cron not available
  PERFORM 1 FROM pg_extension WHERE extname='pg_cron';
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM cron.unschedule('oracle-refresh-10s')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='oracle-refresh-10s');
EXCEPTION WHEN others THEN NULL;
END $$;

SELECT cron.schedule(
  'oracle-refresh-10s',
  '10 seconds',
  $cron$
    SELECT net.http_post(
      url := 'https://ketlqzfaplppmupaiwft.supabase.co/functions/v1/oracle-refresh',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 8000
    );
  $cron$
)
WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron')
  AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='oracle-refresh-10s');
