-- ═══════════════════════════════════════════════════════════════
-- Migration 2 — live_open_position v3.2 kernel
-- Lease ownership (predicate machine) + server-side oracle entry
-- Backward compatible: 13 params unchanged, p_client_request_id added as 14th
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.live_open_position(
  p_symbol            text,
  p_side              text,
  p_leverage          integer,
  p_margin            bigint,
  p_mark_price        numeric,
  p_tp_pct            numeric DEFAULT NULL,
  p_sl_pct            numeric DEFAULT NULL,
  p_trailing_pct      numeric DEFAULT NULL,
  p_margin_mode       text    DEFAULT 'isolated',
  p_allocated_margin  bigint  DEFAULT NULL,
  p_tp_price          numeric DEFAULT NULL,
  p_sl_price          numeric DEFAULT NULL,
  p_trailing_offset   numeric DEFAULT NULL,
  p_client_request_id uuid    DEFAULT NULL  -- v3.2: optional idempotency key
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_open_count int;
  v_avail bigint;
  v_fee bigint;
  v_entry numeric;
  v_size numeric;
  v_liq numeric;
  v_pos_id uuid;
  v_frozen boolean;
  v_rl int;
  v_trailing_active boolean := (
    (p_trailing_pct IS NOT NULL AND p_trailing_pct > 0) OR
    (p_trailing_offset IS NOT NULL AND p_trailing_offset > 0)
  );
  v_mode text := COALESCE(p_margin_mode,'isolated');

  -- v3.2 lease state
  v_my_lease_token uuid := gen_random_uuid();
  v_now            timestamptz := clock_timestamp();
  v_lease_ttl      interval := interval '15 seconds';
  v_params_hash    text;
  v_claimed_crid   uuid;
  v_completed_crid uuid;
  v_existing       record;

  -- v3.2 oracle
  v_oracle_price  numeric;
  v_oracle_src    text;
  v_oracle_at     timestamptz;
  v_oracle_age_ms int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_side NOT IN ('long','short') THEN RAISE EXCEPTION 'invalid side'; END IF;
  IF p_leverage < 1 OR p_leverage > 100 THEN RAISE EXCEPTION 'leverage out of range'; END IF;
  IF p_margin <= 0 THEN RAISE EXCEPTION 'margin must be positive'; END IF;
  IF p_mark_price <= 0 THEN RAISE EXCEPTION 'invalid price'; END IF;
  IF v_mode NOT IN ('isolated','cross') THEN RAISE EXCEPTION 'invalid margin_mode'; END IF;
  IF p_tp_pct IS NOT NULL AND (p_tp_pct <= 0 OR p_tp_pct > 100000) THEN RAISE EXCEPTION 'invalid tp_pct'; END IF;
  IF p_sl_pct IS NOT NULL AND (p_sl_pct <= 0 OR p_sl_pct > 100) THEN RAISE EXCEPTION 'invalid sl_pct'; END IF;
  IF p_trailing_pct IS NOT NULL AND (p_trailing_pct <= 0 OR p_trailing_pct > 100) THEN RAISE EXCEPTION 'invalid trailing_pct'; END IF;
  IF p_tp_price IS NOT NULL AND p_tp_price <= 0 THEN RAISE EXCEPTION 'invalid tp_price'; END IF;
  IF p_sl_price IS NOT NULL AND p_sl_price <= 0 THEN RAISE EXCEPTION 'invalid sl_price'; END IF;
  IF p_trailing_offset IS NOT NULL AND p_trailing_offset <= 0 THEN RAISE EXCEPTION 'invalid trailing_offset'; END IF;
  IF p_allocated_margin IS NOT NULL AND p_allocated_margin < 0 THEN RAISE EXCEPTION 'invalid allocated_margin'; END IF;

  -- ═══════════════════════════════════════════════════════════
  -- v3.2 STEP A: Idempotency lease ownership claim
  -- ownership = INSERT/UPDATE RETURNING row existence (single truth)
  -- ═══════════════════════════════════════════════════════════
  IF p_client_request_id IS NOT NULL THEN
    v_params_hash := md5(concat_ws('|',
      v_uid::text, p_symbol, p_side, p_leverage::text, p_margin::text,
      COALESCE(p_tp_pct::text,''), COALESCE(p_sl_pct::text,''),
      COALESCE(p_trailing_pct::text,''), v_mode,
      COALESCE(p_allocated_margin::text,''),
      COALESCE(p_tp_price::text,''), COALESCE(p_sl_price::text,''),
      COALESCE(p_trailing_offset::text,'')
    ));

    INSERT INTO live_position_idempotency
      (client_request_id, user_id, params_hash, status, lease_owner, lease_until)
    VALUES
      (p_client_request_id, v_uid, v_params_hash,
       'reserved', v_my_lease_token, v_now + v_lease_ttl)
    ON CONFLICT (client_request_id) DO UPDATE
      SET lease_owner = v_my_lease_token,
          lease_until = v_now + v_lease_ttl
      WHERE live_position_idempotency.status = 'reserved'
        AND live_position_idempotency.lease_until < v_now
    RETURNING client_request_id INTO v_claimed_crid;

    IF v_claimed_crid IS NULL THEN
      -- Failed to claim → inspect existing row state
      SELECT * INTO v_existing
        FROM live_position_idempotency
        WHERE client_request_id = p_client_request_id;

      IF v_existing.client_request_id IS NULL THEN
        RAISE EXCEPTION 'lpi_claim_race' USING ERRCODE = 'P0001';
      END IF;

      IF v_existing.user_id <> v_uid THEN
        RAISE EXCEPTION 'crid_user_mismatch' USING ERRCODE = 'P0001';
      END IF;

      IF v_existing.params_hash <> v_params_hash THEN
        RAISE EXCEPTION 'crid_param_mismatch' USING ERRCODE = 'P0001';
      END IF;

      IF v_existing.status = 'completed' THEN
        -- Replay: return previously stored position_id
        RETURN (v_existing.result->>'position_id')::uuid;
      ELSIF v_existing.status = 'failed' THEN
        RAISE EXCEPTION '%', COALESCE(v_existing.error_code,'previously_failed')
          USING ERRCODE = 'P0001';
      ELSE
        -- reserved + lease still alive
        RAISE EXCEPTION 'duplicate_in_flight' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  -- ═══════════════════════════════════════════════════════════
  -- STEP B: Pre-flight safeguards (existing)
  -- ═══════════════════════════════════════════════════════════
  SELECT rl_open_per_min INTO v_rl FROM trading_safeguards_config WHERE id=1;
  PERFORM enforce_rate_limit('trade_open', COALESCE(v_rl,10));
  PERFORM assert_trading_price(p_symbol, p_mark_price);
  PERFORM assert_trading_limits(p_margin);

  SELECT EXISTS(SELECT 1 FROM account_freezes WHERE user_id=v_uid AND released_at IS NULL AND expires_at>now())
    INTO v_frozen;
  IF v_frozen THEN
    RAISE EXCEPTION '계정이 일시 동결되었습니다. 잠시 후 다시 시도해 주세요.' USING ERRCODE='54000';
  END IF;

  SELECT count(*) INTO v_open_count FROM live_positions WHERE user_id=v_uid AND status='open';
  IF v_open_count >= 5 THEN RAISE EXCEPTION 'max 5 open positions'; END IF;

  -- ═══════════════════════════════════════════════════════════
  -- STEP C: Per-user advisory lock (serialize same-user concurrent orders)
  -- ═══════════════════════════════════════════════════════════
  PERFORM pg_advisory_xact_lock(hashtext('live_open_position:' || v_uid::text));

  -- ═══════════════════════════════════════════════════════════
  -- STEP D: Server-side oracle (5s freshness + ±0.5% sanity)
  -- entry price = server-derived only; client p_mark_price is sanity input
  -- ═══════════════════════════════════════════════════════════
  SELECT last_price, source, updated_at
    INTO v_oracle_price, v_oracle_src, v_oracle_at
    FROM oracle_prices
    WHERE symbol = p_symbol;

  IF v_oracle_price IS NULL OR v_oracle_price <= 0 THEN
    RAISE EXCEPTION 'oracle_unavailable' USING ERRCODE = 'P0001';
  END IF;

  v_oracle_age_ms := GREATEST(0,
    EXTRACT(EPOCH FROM (clock_timestamp() - v_oracle_at)) * 1000
  )::int;

  IF v_oracle_age_ms > 5000 THEN
    RAISE EXCEPTION 'oracle_stale' USING ERRCODE = 'P0001';
  END IF;

  IF abs(p_mark_price - v_oracle_price) / v_oracle_price > 0.005 THEN
    RAISE EXCEPTION 'price_moved_resync' USING ERRCODE = 'P0001';
  END IF;

  -- entry derived from SERVER oracle, with side-spread (0.06%)
  v_entry := CASE WHEN p_side='long'
                  THEN v_oracle_price * 1.0006
                  ELSE v_oracle_price * 0.9994 END;
  v_size := (p_margin::numeric * p_leverage) / v_entry;
  v_liq := CASE WHEN p_side='long'
    THEN GREATEST(0, v_entry - v_entry / p_leverage)
    ELSE v_entry + v_entry / p_leverage END;
  v_fee := FLOOR(p_margin::numeric * p_leverage * 0.001)::bigint;

  -- ═══════════════════════════════════════════════════════════
  -- STEP E: Balance lock + debit
  -- ═══════════════════════════════════════════════════════════
  SELECT available_balance INTO v_avail
    FROM wallet_balances WHERE user_id=v_uid FOR UPDATE;
  IF v_avail IS NULL OR v_avail < (p_margin + v_fee) THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE wallet_balances
    SET available_balance = available_balance - (p_margin + v_fee),
        locked_balance    = locked_balance + p_margin,
        total_balance     = total_balance - v_fee,
        updated_at = now()
    WHERE user_id=v_uid;

  UPDATE insurance_fund
    SET accumulated = accumulated + FLOOR(v_fee*0.25)::bigint, updated_at=now()
    WHERE id=1;

  -- ═══════════════════════════════════════════════════════════
  -- STEP F: Position INSERT
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO live_positions(
    user_id, symbol, side, leverage, margin, size, entry, liq_price, fee_open, status,
    tp_pct, sl_pct, trailing_pct, trailing_active, trailing_peak_roi_pct,
    margin_mode, allocated_margin, tp_price, sl_price, trailing_offset, trailing_peak
  ) VALUES(
    v_uid, p_symbol, p_side, p_leverage, p_margin, v_size, v_entry, v_liq, v_fee, 'open',
    p_tp_pct, p_sl_pct, p_trailing_pct, v_trailing_active, NULL,
    v_mode,
    CASE WHEN v_mode='isolated' THEN COALESCE(p_allocated_margin, p_margin) ELSE NULL END,
    p_tp_price, p_sl_price, p_trailing_offset, NULL
  )
  RETURNING id INTO v_pos_id;

  INSERT INTO transactions(user_id,kind,direction,amount,balance_after,available_after,ref_id,metadata)
  SELECT v_uid,'trade_open','debit',p_margin,total_balance,available_balance,v_pos_id::text,
         jsonb_build_object('symbol',p_symbol,'side',p_side,'leverage',p_leverage,'entry',v_entry,'liq',v_liq,
                            'tp_pct',p_tp_pct,'sl_pct',p_sl_pct,'trailing_pct',p_trailing_pct,
                            'margin_mode',v_mode,'allocated_margin',p_allocated_margin,
                            'tp_price',p_tp_price,'sl_price',p_sl_price,'trailing_offset',p_trailing_offset,
                            'oracle_price',v_oracle_price,'oracle_age_ms',v_oracle_age_ms,
                            'oracle_source',v_oracle_src,'crid',p_client_request_id)
  FROM wallet_balances WHERE user_id=v_uid;

  INSERT INTO transactions(user_id,kind,direction,amount,balance_after,available_after,ref_id,metadata)
  SELECT v_uid,'trade_fee','debit',v_fee,total_balance,available_balance,v_pos_id::text,
         jsonb_build_object('phase','open')
  FROM wallet_balances WHERE user_id=v_uid;

  -- ═══════════════════════════════════════════════════════════
  -- STEP G: Idempotency completion (ownership = WHERE + RETURNING)
  -- ═══════════════════════════════════════════════════════════
  IF p_client_request_id IS NOT NULL THEN
    UPDATE live_position_idempotency
      SET status       = 'completed',
          completed_at = now(),
          result       = jsonb_build_object(
            'position_id',   v_pos_id,
            'entry_price',   v_entry,
            'oracle_price',  v_oracle_price,
            'oracle_age_ms', v_oracle_age_ms,
            'oracle_source', v_oracle_src
          )
      WHERE client_request_id = p_client_request_id
        AND lease_owner       = v_my_lease_token   -- ownership check
        AND status            = 'reserved'
    RETURNING client_request_id INTO v_completed_crid;

    IF v_completed_crid IS NULL THEN
      -- We lost the lease mid-execution → entire tx rolls back
      RAISE EXCEPTION 'lease_lost_during_execution' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN v_pos_id;

  -- Note: no EXCEPTION block. Any RAISE bubbles up → entire transaction
  -- (including idempotency INSERT/UPDATE) atomically rolls back.
  -- 'failed' status is intentionally never marked here — next call with
  -- same crid will reclaim the expired lease and retry cleanly.
END
$function$;

COMMENT ON FUNCTION public.live_open_position(
  text,text,integer,bigint,numeric,numeric,numeric,numeric,text,bigint,
  numeric,numeric,numeric,uuid
) IS
  'v3.2 kernel: lease ownership (predicate machine) + server-side oracle entry. p_client_request_id is optional; when provided, ownership = INSERT/UPDATE WHERE+RETURNING single truth. Single transaction; RAISE = full rollback. Single-primary DB assumption.';