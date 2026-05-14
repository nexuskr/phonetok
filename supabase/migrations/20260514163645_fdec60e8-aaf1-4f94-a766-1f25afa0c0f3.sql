
-- ============================================================
-- PHASE 3.5: CONFIDENCE-WEIGHTED ORACLE (SHADOW MODE)
-- ============================================================

-- 1) Source weights (admin-editable)
CREATE TABLE IF NOT EXISTS public.oracle_source_weights (
  source text PRIMARY KEY,
  weight numeric NOT NULL CHECK (weight >= 0 AND weight <= 1),
  max_lag_ms int NOT NULL CHECK (max_lag_ms > 0),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.oracle_source_weights (source, weight, max_lag_ms, notes) VALUES
  ('bybit',    1.00, 2500, 'fast, slightly volatile'),
  ('binance',  1.00, 3000, 'baseline'),
  ('coinbase', 0.85, 6000, 'slow but stable; USDT mapped to USD')
ON CONFLICT (source) DO NOTHING;

ALTER TABLE public.oracle_source_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS osw_admin_all ON public.oracle_source_weights;
CREATE POLICY osw_admin_all ON public.oracle_source_weights
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS osw_auth_read ON public.oracle_source_weights;
CREATE POLICY osw_auth_read ON public.oracle_source_weights
  FOR SELECT TO authenticated USING (true);

-- 2) Source health (auto-degrade tracking)
CREATE TABLE IF NOT EXISTS public.oracle_source_health (
  source text PRIMARY KEY REFERENCES public.oracle_source_weights(source) ON DELETE CASCADE,
  degraded boolean NOT NULL DEFAULT false,
  degraded_since timestamptz,
  consec_low int NOT NULL DEFAULT 0,    -- consecutive ticks with effective_weight < 0.3
  consec_high int NOT NULL DEFAULT 0,   -- consecutive ticks with effective_weight >= 0.7
  last_eff_weight numeric,
  last_check timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.oracle_source_health (source) VALUES ('bybit'),('binance'),('coinbase')
ON CONFLICT (source) DO NOTHING;

ALTER TABLE public.oracle_source_health ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS osh_auth_read ON public.oracle_source_health;
CREATE POLICY osh_auth_read ON public.oracle_source_health
  FOR SELECT TO authenticated USING (true);

-- 3) Shadow drift log (live vs shadow per tick)
CREATE TABLE IF NOT EXISTS public.oracle_shadow_drift (
  id bigserial PRIMARY KEY,
  symbol text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  live_price numeric NOT NULL,
  shadow_price numeric NOT NULL,
  drift_bps int NOT NULL,
  quorum int NOT NULL,
  clamp_active boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_osd_ts ON public.oracle_shadow_drift (ts DESC);
CREATE INDEX IF NOT EXISTS idx_osd_symbol_ts ON public.oracle_shadow_drift (symbol, ts DESC);

ALTER TABLE public.oracle_shadow_drift ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS osd_admin_read ON public.oracle_shadow_drift;
CREATE POLICY osd_admin_read ON public.oracle_shadow_drift
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) oracle_prices new columns
ALTER TABLE public.oracle_prices
  ADD COLUMN IF NOT EXISTS shadow_consensus numeric,
  ADD COLUMN IF NOT EXISTS shadow_quorum int,
  ADD COLUMN IF NOT EXISTS shadow_clamp_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shadow_updated_at timestamptz;

-- 5) Weighted consensus (SHADOW only — does NOT touch last_price)
CREATE OR REPLACE FUNCTION public.compute_oracle_consensus_weighted(_symbol text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlier_bps   int := 30;
  v_clamp_bps     int := 100;       -- 1% spike threshold
  v_clamp_quorum  int := 3;         -- below this quorum during a spike → clamp
  v_now           timestamptz := now();
  v_prev_shadow   numeric;
  v_prev_clamped  boolean;
  r record;
  v_eff_total     numeric := 0;
  v_kept_n        int := 0;
  v_kept_prices   numeric[] := '{}';
  v_kept_weights  numeric[] := '{}';
  v_kept_sources  text[] := '{}';
  v_median        numeric;
  v_consensus     numeric;
  v_clamp_active  boolean := false;
  v_drift_bps     int := 0;
  v_age_ms        int;
  v_lag_pen       numeric;
  v_eff_w         numeric;
  v_live_price    numeric;
BEGIN
  -- previous shadow & live (for clamp & drift)
  SELECT shadow_consensus, shadow_clamp_active, last_price
    INTO v_prev_shadow, v_prev_clamped, v_live_price
    FROM public.oracle_prices WHERE symbol = _symbol;

  -- Pull all raw rows for symbol (no freshness gate here — lag_penalty handles age)
  FOR r IN
    SELECT opr.source, opr.last_price, opr.updated_at,
           COALESCE(w.weight, 0)::numeric AS weight,
           COALESCE(w.max_lag_ms, 5000)::int AS max_lag_ms
      FROM public.oracle_prices_raw opr
      LEFT JOIN public.oracle_source_weights w ON w.source = opr.source
     WHERE opr.symbol = _symbol
  LOOP
    v_age_ms := GREATEST(0, EXTRACT(EPOCH FROM (v_now - r.updated_at)) * 1000)::int;
    v_lag_pen := GREATEST(0, 1 - (v_age_ms::numeric / r.max_lag_ms));
    v_eff_w := r.weight * v_lag_pen;

    -- Update per-source health counters
    UPDATE public.oracle_source_health
       SET consec_low  = CASE WHEN v_eff_w < 0.3 THEN consec_low + 1 ELSE 0 END,
           consec_high = CASE WHEN v_eff_w >= 0.7 THEN consec_high + 1 ELSE 0 END,
           last_eff_weight = v_eff_w,
           last_check = v_now
     WHERE source = r.source;

    IF v_eff_w > 0 THEN
      v_kept_prices  := array_append(v_kept_prices, r.last_price);
      v_kept_weights := array_append(v_kept_weights, v_eff_w);
      v_kept_sources := array_append(v_kept_sources, r.source);
      v_eff_total := v_eff_total + v_eff_w;
      v_kept_n := v_kept_n + 1;
    END IF;
  END LOOP;

  -- Auto-degrade / recover (5 min ≈ 60 ticks at 5s) → use 60 consec
  UPDATE public.oracle_source_health
     SET degraded = true, degraded_since = COALESCE(degraded_since, v_now)
   WHERE consec_low >= 60 AND degraded = false;

  UPDATE public.oracle_source_health
     SET degraded = false, degraded_since = NULL
   WHERE consec_high >= 60 AND degraded = true;

  IF v_kept_n = 0 THEN
    RETURN jsonb_build_object('symbol', _symbol, 'shadow_quorum', 0, 'reason', 'no_weighted_sources');
  END IF;

  -- Outlier filter against unweighted median (price space)
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY p)
    INTO v_median FROM unnest(v_kept_prices) AS p;

  -- Re-build keep arrays after outlier filter
  DECLARE
    v2_prices numeric[] := '{}';
    v2_weights numeric[] := '{}';
    v2_sources text[] := '{}';
    v2_total numeric := 0;
    v_div_bps int;
  BEGIN
    FOR i IN 1 .. array_length(v_kept_prices, 1) LOOP
      v_div_bps := abs(round(((v_kept_prices[i] - v_median) / v_median) * 10000))::int;
      IF v_div_bps <= v_outlier_bps THEN
        v2_prices  := array_append(v2_prices, v_kept_prices[i]);
        v2_weights := array_append(v2_weights, v_kept_weights[i]);
        v2_sources := array_append(v2_sources, v_kept_sources[i]);
        v2_total := v2_total + v_kept_weights[i];
      END IF;
    END LOOP;
    v_kept_prices := v2_prices;
    v_kept_weights := v2_weights;
    v_kept_sources := v2_sources;
    v_eff_total := v2_total;
    v_kept_n := COALESCE(array_length(v2_prices, 1), 0);
  END;

  IF v_kept_n = 0 OR v_eff_total <= 0 THEN
    RETURN jsonb_build_object('symbol', _symbol, 'shadow_quorum', 0, 'reason', 'all_outliers_or_zero_weight');
  END IF;

  -- Weighted MEDIAN (sort by price, walk cumulative weight to half)
  DECLARE
    v_idx int[];
    v_cum numeric := 0;
    v_target numeric := v_eff_total / 2.0;
  BEGIN
    SELECT array_agg(ord) INTO v_idx
      FROM (
        SELECT row_number() OVER () AS orig_idx,
               row_number() OVER (ORDER BY p) AS ord
        FROM unnest(v_kept_prices) WITH ORDINALITY AS t(p, orig_idx)
      ) s
      ORDER BY ord;
    -- Easier: walk sorted (price, weight) pairs
    v_consensus := NULL;
    FOR r IN
      SELECT p, w
        FROM unnest(v_kept_prices, v_kept_weights) AS t(p, w)
       ORDER BY p
    LOOP
      v_cum := v_cum + r.w;
      IF v_cum >= v_target THEN
        v_consensus := r.p;
        EXIT;
      END IF;
    END LOOP;
    IF v_consensus IS NULL THEN
      v_consensus := v_kept_prices[v_kept_n];
    END IF;
  END;

  -- Spike clamp
  IF v_prev_shadow IS NOT NULL AND v_prev_shadow > 0 THEN
    IF abs(round(((v_consensus - v_prev_shadow) / v_prev_shadow) * 10000)) > v_clamp_bps
       AND v_kept_n < v_clamp_quorum THEN
      v_clamp_active := true;
      v_consensus := v_prev_shadow;  -- hold previous shadow value
    END IF;
  END IF;

  -- Persist on oracle_prices
  UPDATE public.oracle_prices
     SET shadow_consensus = v_consensus,
         shadow_quorum = v_kept_n,
         shadow_clamp_active = v_clamp_active,
         shadow_updated_at = v_now
   WHERE symbol = _symbol;

  -- Drift log (vs current live last_price)
  IF v_live_price IS NOT NULL AND v_live_price > 0 THEN
    v_drift_bps := abs(round(((v_consensus - v_live_price) / v_live_price) * 10000))::int;
    INSERT INTO public.oracle_shadow_drift (symbol, live_price, shadow_price, drift_bps, quorum, clamp_active)
    VALUES (_symbol, v_live_price, v_consensus, v_drift_bps, v_kept_n, v_clamp_active);
  END IF;

  -- Spike clamp anomaly event (rate-limited via dedupe_key day+symbol)
  IF v_clamp_active THEN
    BEGIN
      INSERT INTO public.anomaly_events (rule, severity, dedupe_key, ctx)
      VALUES (
        'oracle_spike_quarantine', 'warn',
        _symbol || ':' || to_char(v_now, 'YYYY-MM-DD"T"HH24:MI'),
        jsonb_build_object('symbol', _symbol, 'prev_shadow', v_prev_shadow,
                           'kept_n', v_kept_n, 'sources', v_kept_sources)
      ) ON CONFLICT DO NOTHING;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'symbol', _symbol,
    'shadow_consensus', v_consensus,
    'shadow_quorum', v_kept_n,
    'shadow_sources', v_kept_sources,
    'drift_bps', v_drift_bps,
    'clamp_active', v_clamp_active
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_oracle_consensus_weighted(text) FROM public, anon, authenticated;

-- 6) Wire into existing trigger (compute live + shadow back-to-back)
CREATE OR REPLACE FUNCTION public.trg_recompute_consensus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.compute_oracle_consensus(NEW.symbol);
  PERFORM public.compute_oracle_consensus_weighted(NEW.symbol);
  RETURN NEW;
END;
$$;

-- Auto-degrade anomaly on transition (fired manually inside compute) — also handle here as safety net via NOTIFY-less event-triggered policy: rely on caller pattern only.

-- 7) Admin RPCs
CREATE OR REPLACE FUNCTION public.admin_set_source_weight(
  _source text, _weight numeric, _max_lag_ms int DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  IF _weight < 0 OR _weight > 1 THEN
    RAISE EXCEPTION 'weight_out_of_range';
  END IF;
  UPDATE public.oracle_source_weights
     SET weight = _weight,
         max_lag_ms = COALESCE(_max_lag_ms, max_lag_ms),
         updated_at = now()
   WHERE source = _source;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_source: %', _source;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_source_weight(text,numeric,int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_source_weight(text,numeric,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_oracle_swap_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_drift timestamptz;
  v_days_running numeric;
  v_med int;
  v_p99 int;
  v_clamp_rate numeric;
  v_fp_count int;
  v_total_drifts int;
  v_clamps int;
  v_gates jsonb;
  v_pass_count int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT min(ts), count(*) INTO v_first_drift, v_total_drifts
    FROM public.oracle_shadow_drift
   WHERE ts > now() - interval '30 days';

  v_days_running := COALESCE(EXTRACT(EPOCH FROM (now() - v_first_drift)) / 86400.0, 0);

  SELECT
    COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY drift_bps), 0)::int,
    COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY drift_bps), 0)::int
    INTO v_med, v_p99
    FROM public.oracle_shadow_drift
   WHERE ts > now() - interval '14 days';

  SELECT count(*) INTO v_clamps
    FROM public.oracle_shadow_drift
   WHERE ts > now() - interval '1 day' AND clamp_active = true;
  v_clamp_rate := CASE WHEN v_total_drifts > 0
                       THEN v_clamps::numeric / NULLIF(
                         (SELECT count(*) FROM public.oracle_shadow_drift WHERE ts > now() - interval '1 day'), 0)
                       ELSE 0 END;

  -- "false-positive degrade" = source degrade events in last 14d that recovered within < 5 min
  -- Approximation: count current degraded sources where degraded_since > now()-5min
  SELECT count(*) INTO v_fp_count
    FROM public.oracle_source_health
   WHERE degraded = true AND degraded_since > now() - interval '5 minutes';

  v_gates := jsonb_build_array(
    jsonb_build_object('id', 'days_running', 'label', '14일 연속 운영',
                       'value', round(v_days_running::numeric, 2), 'target', 14, 'pass', v_days_running >= 14),
    jsonb_build_object('id', 'drift_median', 'label', 'Drift 중앙값 < 5 bps',
                       'value', v_med, 'target', 5, 'pass', v_med < 5),
    jsonb_build_object('id', 'drift_p99', 'label', 'Drift p99 < 25 bps',
                       'value', v_p99, 'target', 25, 'pass', v_p99 < 25),
    jsonb_build_object('id', 'clamp_rate', 'label', 'Spike clamp < 0.1%/일',
                       'value', round(COALESCE(v_clamp_rate, 0) * 100, 3), 'target', 0.1, 'pass', COALESCE(v_clamp_rate, 0) < 0.001),
    jsonb_build_object('id', 'fp_degrade', 'label', 'auto-degrade FP 0건',
                       'value', v_fp_count, 'target', 0, 'pass', v_fp_count = 0)
  );

  SELECT count(*)::int INTO v_pass_count
    FROM jsonb_array_elements(v_gates) AS g
   WHERE (g->>'pass')::boolean;

  RETURN jsonb_build_object(
    'pass_count', v_pass_count,
    'total', 5,
    'eligible', v_pass_count = 5,
    'gates', v_gates,
    'samples_total', v_total_drifts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_oracle_swap_readiness() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_oracle_swap_readiness() TO authenticated;

-- 8) admin_get_oracle_health: extend with weights & shadow snapshot
CREATE OR REPLACE FUNCTION public.admin_get_oracle_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matrix jsonb;
  v_summary jsonb;
  v_weights jsonb;
  v_health jsonb;
  v_drift_24h jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT jsonb_agg(
           jsonb_build_object(
             'symbol', op.symbol,
             'consensus', op.last_price,
             'quorum', op.quorum_count,
             'divergence_bps', op.divergence_bps,
             'sources', op.participating_sources,
             'consensus_age_s', extract(epoch FROM (now() - op.updated_at))::int,
             'shadow_consensus', op.shadow_consensus,
             'shadow_quorum', op.shadow_quorum,
             'shadow_clamp_active', op.shadow_clamp_active,
             'shadow_drift_bps', CASE
               WHEN op.shadow_consensus IS NOT NULL AND op.last_price > 0
               THEN abs(round(((op.shadow_consensus - op.last_price) / op.last_price) * 10000))::int
               ELSE NULL END,
             'raw', (
               SELECT jsonb_agg(jsonb_build_object(
                 'source', r.source,
                 'price', r.last_price,
                 'age_s', extract(epoch FROM (now() - r.updated_at))::int
               ) ORDER BY r.source)
               FROM public.oracle_prices_raw r WHERE r.symbol = op.symbol
             )
           ) ORDER BY op.symbol
         )
    INTO v_matrix
    FROM public.oracle_prices op;

  SELECT jsonb_build_object(
           'healthy', count(*) FILTER (WHERE quorum_count >= 2),
           'degraded', count(*) FILTER (WHERE quorum_count = 1),
           'down', count(*) FILTER (WHERE quorum_count = 0),
           'total', count(*)
         )
    INTO v_summary FROM public.oracle_prices;

  SELECT jsonb_agg(jsonb_build_object(
           'source', source, 'weight', weight, 'max_lag_ms', max_lag_ms
         ) ORDER BY source) INTO v_weights FROM public.oracle_source_weights;

  SELECT jsonb_agg(jsonb_build_object(
           'source', source, 'degraded', degraded, 'degraded_since', degraded_since,
           'last_eff_weight', last_eff_weight
         ) ORDER BY source) INTO v_health FROM public.oracle_source_health;

  -- Last 24h drift sparkline (avg per hour)
  SELECT jsonb_agg(jsonb_build_object(
           'h', h, 'avg_bps', round(avg_bps)::int, 'p99_bps', p99_bps, 'samples', n
         ) ORDER BY h)
    INTO v_drift_24h
    FROM (
      SELECT date_trunc('hour', ts) AS h,
             avg(drift_bps) AS avg_bps,
             percentile_cont(0.99) WITHIN GROUP (ORDER BY drift_bps)::int AS p99_bps,
             count(*) AS n
        FROM public.oracle_shadow_drift
       WHERE ts > now() - interval '24 hours'
       GROUP BY 1
    ) s;

  RETURN jsonb_build_object(
    'summary', v_summary,
    'matrix', COALESCE(v_matrix, '[]'::jsonb),
    'weights', COALESCE(v_weights, '[]'::jsonb),
    'health', COALESCE(v_health, '[]'::jsonb),
    'drift_24h', COALESCE(v_drift_24h, '[]'::jsonb)
  );
END;
$$;

-- (existing GRANT preserved from Phase 3 migration; re-grant for safety)
REVOKE ALL ON FUNCTION public.admin_get_oracle_health() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_oracle_health() TO authenticated;

-- 9) Cleanup cron: trim drift older than 30d (hourly)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='oracle-shadow-drift-trim') THEN
    PERFORM cron.unschedule('oracle-shadow-drift-trim');
  END IF;
END $$;

SELECT cron.schedule(
  'oracle-shadow-drift-trim',
  '17 * * * *',
  $$DELETE FROM public.oracle_shadow_drift WHERE ts < now() - interval '30 days';$$
);
