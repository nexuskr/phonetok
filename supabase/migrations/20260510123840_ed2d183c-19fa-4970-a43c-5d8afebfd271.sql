-- ============================================================
-- Server-side SL / TP / Trailing-Stop for live_positions
-- ============================================================

ALTER TABLE public.live_positions
  ADD COLUMN IF NOT EXISTS tp_pct numeric,
  ADD COLUMN IF NOT EXISTS sl_pct numeric,
  ADD COLUMN IF NOT EXISTS trailing_pct numeric,
  ADD COLUMN IF NOT EXISTS trailing_peak_roi_pct numeric,
  ADD COLUMN IF NOT EXISTS trailing_active boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_live_positions_open_triggers
  ON public.live_positions (status)
  WHERE status = 'open';

-- ------------------------------------------------------------
-- Refactor live_open_position to accept optional triggers
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.live_open_position(text, text, integer, bigint, numeric);

CREATE OR REPLACE FUNCTION public.live_open_position(
  p_symbol text,
  p_side text,
  p_leverage int,
  p_margin bigint,
  p_mark_price numeric,
  p_tp_pct numeric DEFAULT NULL,
  p_sl_pct numeric DEFAULT NULL,
  p_trailing_pct numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  v_trailing_active boolean := (p_trailing_pct IS NOT NULL AND p_trailing_pct > 0);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_side NOT IN ('long','short') THEN RAISE EXCEPTION 'invalid side'; END IF;
  IF p_leverage < 1 OR p_leverage > 100 THEN RAISE EXCEPTION 'leverage out of range'; END IF;
  IF p_margin <= 0 THEN RAISE EXCEPTION 'margin must be positive'; END IF;
  IF p_mark_price <= 0 THEN RAISE EXCEPTION 'invalid price'; END IF;
  IF p_tp_pct IS NOT NULL AND (p_tp_pct <= 0 OR p_tp_pct > 100000) THEN RAISE EXCEPTION 'invalid tp_pct'; END IF;
  IF p_sl_pct IS NOT NULL AND (p_sl_pct <= 0 OR p_sl_pct > 100) THEN RAISE EXCEPTION 'invalid sl_pct'; END IF;
  IF p_trailing_pct IS NOT NULL AND (p_trailing_pct <= 0 OR p_trailing_pct > 100) THEN RAISE EXCEPTION 'invalid trailing_pct'; END IF;

  SELECT EXISTS(SELECT 1 FROM account_freezes WHERE user_id=v_uid AND released_at IS NULL AND expires_at>now())
    INTO v_frozen;
  IF v_frozen THEN RAISE EXCEPTION 'account frozen'; END IF;

  SELECT count(*) INTO v_open_count FROM live_positions WHERE user_id=v_uid AND status='open';
  IF v_open_count >= 5 THEN RAISE EXCEPTION 'max 5 open positions'; END IF;

  v_entry := CASE WHEN p_side='long' THEN p_mark_price * 1.0006 ELSE p_mark_price * 0.9994 END;
  v_size := (p_margin::numeric * p_leverage) / v_entry;
  v_liq := CASE WHEN p_side='long'
    THEN GREATEST(0, v_entry - v_entry / p_leverage)
    ELSE v_entry + v_entry / p_leverage END;
  v_fee := FLOOR(p_margin::numeric * p_leverage * 0.001)::bigint;

  SELECT available_balance INTO v_avail FROM wallet_balances WHERE user_id=v_uid FOR UPDATE;
  IF v_avail IS NULL OR v_avail < (p_margin + v_fee) THEN RAISE EXCEPTION 'insufficient balance'; END IF;

  UPDATE wallet_balances
    SET available_balance = available_balance - (p_margin + v_fee),
        locked_balance    = locked_balance + p_margin,
        total_balance     = total_balance - v_fee,
        updated_at = now()
    WHERE user_id=v_uid;

  UPDATE insurance_fund SET accumulated = accumulated + FLOOR(v_fee*0.25)::bigint, updated_at=now() WHERE id=1;

  INSERT INTO live_positions(
    user_id, symbol, side, leverage, margin, size, entry, liq_price, fee_open, status,
    tp_pct, sl_pct, trailing_pct, trailing_active, trailing_peak_roi_pct
  )
    VALUES(
      v_uid, p_symbol, p_side, p_leverage, p_margin, v_size, v_entry, v_liq, v_fee, 'open',
      p_tp_pct, p_sl_pct, p_trailing_pct, v_trailing_active, NULL
    )
    RETURNING id INTO v_pos_id;

  INSERT INTO transactions(user_id,kind,direction,amount,balance_after,available_after,ref_id,metadata)
  SELECT v_uid,'trade_open','out',p_margin,total_balance,available_balance,v_pos_id::text,
         jsonb_build_object('symbol',p_symbol,'side',p_side,'leverage',p_leverage,'entry',v_entry,'liq',v_liq,
                            'tp_pct',p_tp_pct,'sl_pct',p_sl_pct,'trailing_pct',p_trailing_pct)
  FROM wallet_balances WHERE user_id=v_uid;

  INSERT INTO transactions(user_id,kind,direction,amount,balance_after,available_after,ref_id,metadata)
  SELECT v_uid,'trade_fee','out',v_fee,total_balance,available_balance,v_pos_id::text,
         jsonb_build_object('phase','open')
  FROM wallet_balances WHERE user_id=v_uid;

  RETURN v_pos_id;
END $$;

-- ------------------------------------------------------------
-- live_set_position_triggers (own-position only)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.live_set_position_triggers(
  p_position_id uuid,
  p_tp_pct numeric,
  p_sl_pct numeric,
  p_trailing_pct numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trailing_active boolean := (p_trailing_pct IS NOT NULL AND p_trailing_pct > 0);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_tp_pct IS NOT NULL AND (p_tp_pct <= 0 OR p_tp_pct > 100000) THEN RAISE EXCEPTION 'invalid tp_pct'; END IF;
  IF p_sl_pct IS NOT NULL AND (p_sl_pct <= 0 OR p_sl_pct > 100) THEN RAISE EXCEPTION 'invalid sl_pct'; END IF;
  IF p_trailing_pct IS NOT NULL AND (p_trailing_pct <= 0 OR p_trailing_pct > 100) THEN RAISE EXCEPTION 'invalid trailing_pct'; END IF;

  UPDATE live_positions
    SET tp_pct = p_tp_pct,
        sl_pct = p_sl_pct,
        trailing_pct = p_trailing_pct,
        trailing_active = v_trailing_active,
        trailing_peak_roi_pct = CASE WHEN v_trailing_active THEN trailing_peak_roi_pct ELSE NULL END
    WHERE id = p_position_id AND user_id = v_uid AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'position not found'; END IF;
END $$;

-- ------------------------------------------------------------
-- admin_force_close_position (cron / admin) — TP/SL/Trailing close
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_force_close_position(
  p_position_id uuid,
  p_mark_price numeric,
  p_reason text DEFAULT 'tp'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p record;
  v_exit numeric;
  v_pnl bigint;
  v_fee_close bigint;
  v_roi numeric;
  v_credit bigint;
BEGIN
  IF NOT (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_mark_price <= 0 THEN RAISE EXCEPTION 'invalid price'; END IF;
  IF p_reason NOT IN ('tp','sl','trailing','manual','liquidation','admin') THEN
    RAISE EXCEPTION 'invalid reason';
  END IF;

  SELECT * INTO p FROM live_positions WHERE id=p_position_id AND status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'position not found'; END IF;

  v_exit := CASE WHEN p.side='long' THEN p_mark_price * 0.9994 ELSE p_mark_price * 1.0006 END;
  v_pnl := FLOOR(((v_exit - p.entry) * p.size) * (CASE WHEN p.side='long' THEN 1 ELSE -1 END))::bigint;
  v_fee_close := FLOOR(v_exit * p.size * 0.001)::bigint;
  v_roi := v_pnl::numeric / NULLIF(p.margin,0);
  v_credit := GREATEST(0, p.margin + v_pnl - v_fee_close);

  UPDATE wallet_balances
    SET locked_balance    = GREATEST(0, locked_balance - p.margin),
        available_balance = available_balance + v_credit,
        total_balance     = total_balance + v_credit - p.margin - v_fee_close,
        updated_at = now()
    WHERE user_id=p.user_id;

  UPDATE insurance_fund SET accumulated = accumulated + FLOOR(v_fee_close*0.25)::bigint, updated_at=now() WHERE id=1;
  UPDATE live_positions SET status='closed' WHERE id=p.id;

  INSERT INTO live_trade_history(user_id,symbol,side,leverage,margin,size,entry,close_price,pnl,roi,fee_open,fee_close,reason,opened_at)
    VALUES(p.user_id,p.symbol,p.side,p.leverage,p.margin,p.size,p.entry,v_exit,v_pnl,v_roi,p.fee_open,v_fee_close,p_reason,p.opened_at);

  INSERT INTO transactions(user_id,kind,direction,amount,balance_after,available_after,ref_id,metadata)
  SELECT p.user_id,
    CASE WHEN v_pnl>=0 THEN 'trade_close_win'::tx_kind ELSE 'trade_close_loss'::tx_kind END,
    CASE WHEN v_pnl>=0 THEN 'in' ELSE 'out' END,
    ABS(v_pnl), total_balance, available_balance, p.id::text,
    jsonb_build_object('symbol',p.symbol,'side',p.side,'leverage',p.leverage,'pnl',v_pnl,'roi',v_roi,'exit',v_exit,'reason',p_reason)
  FROM wallet_balances WHERE user_id=p.user_id;

  INSERT INTO transactions(user_id,kind,direction,amount,balance_after,available_after,ref_id,metadata)
  SELECT p.user_id,'trade_fee','out',v_fee_close,total_balance,available_balance,p.id::text,
         jsonb_build_object('phase','close','reason',p_reason)
  FROM wallet_balances WHERE user_id=p.user_id;

  RETURN jsonb_build_object('pnl',v_pnl,'roi',v_roi,'exit',v_exit,'fee',v_fee_close,'credit',v_credit,'reason',p_reason);
END $$;

-- ------------------------------------------------------------
-- admin_update_trailing_peak (cron only) — track peak ROI
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_trailing_peak(
  p_position_id uuid,
  p_peak_roi_pct numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE live_positions
    SET trailing_peak_roi_pct = p_peak_roi_pct
    WHERE id = p_position_id AND status='open' AND trailing_active = true
      AND (trailing_peak_roi_pct IS NULL OR p_peak_roi_pct > trailing_peak_roi_pct);
END $$;

-- ------------------------------------------------------------
-- Update permission baseline registry
-- ------------------------------------------------------------
UPDATE public.function_permissions_baseline
  SET function_args = 'text, text, integer, bigint, numeric, numeric, numeric, numeric'
  WHERE function_name = 'live_open_position';

INSERT INTO public.function_permissions_baseline(function_name, function_args, allowed_roles, category, note)
VALUES
 ('live_set_position_triggers','uuid, numeric, numeric, numeric','{authenticated}','trading','Set TP/SL/Trailing on own open position'),
 ('admin_force_close_position','uuid, numeric, text','{service_role}','trading','Server-side force close on TP/SL/Trailing trigger (cron-only)'),
 ('admin_update_trailing_peak','uuid, numeric','{service_role}','trading','Update trailing peak ROI from cron worker')
ON CONFLICT DO NOTHING;