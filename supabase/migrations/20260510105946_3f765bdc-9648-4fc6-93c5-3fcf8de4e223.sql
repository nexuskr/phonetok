
-- live_open_position
CREATE OR REPLACE FUNCTION public.live_open_position(
  p_symbol text, p_side text, p_leverage int, p_margin bigint, p_mark_price numeric
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_side NOT IN ('long','short') THEN RAISE EXCEPTION 'invalid side'; END IF;
  IF p_leverage < 1 OR p_leverage > 100 THEN RAISE EXCEPTION 'leverage out of range'; END IF;
  IF p_margin <= 0 THEN RAISE EXCEPTION 'margin must be positive'; END IF;
  IF p_mark_price <= 0 THEN RAISE EXCEPTION 'invalid price'; END IF;

  -- account freeze guard
  SELECT EXISTS(SELECT 1 FROM account_freezes WHERE user_id=v_uid AND released_at IS NULL AND expires_at>now())
    INTO v_frozen;
  IF v_frozen THEN RAISE EXCEPTION 'account frozen'; END IF;

  -- max 5 open positions
  SELECT count(*) INTO v_open_count FROM live_positions WHERE user_id=v_uid AND status='open';
  IF v_open_count >= 5 THEN RAISE EXCEPTION 'max 5 open positions'; END IF;

  -- slippage 0.06% unfavorable
  v_entry := CASE WHEN p_side='long' THEN p_mark_price * 1.0006 ELSE p_mark_price * 0.9994 END;
  v_size := (p_margin::numeric * p_leverage) / v_entry;
  v_liq := CASE WHEN p_side='long'
    THEN GREATEST(0, v_entry - v_entry / p_leverage)
    ELSE v_entry + v_entry / p_leverage END;
  v_fee := FLOOR(p_margin::numeric * p_leverage * 0.001)::bigint;

  -- balance check + lock
  SELECT available_balance INTO v_avail FROM wallet_balances WHERE user_id=v_uid FOR UPDATE;
  IF v_avail IS NULL OR v_avail < (p_margin + v_fee) THEN RAISE EXCEPTION 'insufficient balance'; END IF;

  UPDATE wallet_balances
    SET available_balance = available_balance - (p_margin + v_fee),
        locked_balance    = locked_balance + p_margin,
        total_balance     = total_balance - v_fee,
        updated_at = now()
    WHERE user_id=v_uid;

  UPDATE insurance_fund SET accumulated = accumulated + FLOOR(v_fee*0.25)::bigint, updated_at=now() WHERE id=1;

  INSERT INTO live_positions(user_id,symbol,side,leverage,margin,size,entry,liq_price,fee_open,status)
    VALUES(v_uid,p_symbol,p_side,p_leverage,p_margin,v_size,v_entry,v_liq,v_fee,'open')
    RETURNING id INTO v_pos_id;

  -- transactions log
  INSERT INTO transactions(user_id,kind,direction,amount,balance_after,available_after,ref_id,metadata)
  SELECT v_uid,'trade_open','out',p_margin,total_balance,available_balance,v_pos_id::text,
         jsonb_build_object('symbol',p_symbol,'side',p_side,'leverage',p_leverage,'entry',v_entry,'liq',v_liq)
  FROM wallet_balances WHERE user_id=v_uid;

  INSERT INTO transactions(user_id,kind,direction,amount,balance_after,available_after,ref_id,metadata)
  SELECT v_uid,'trade_fee','out',v_fee,total_balance,available_balance,v_pos_id::text,
         jsonb_build_object('phase','open')
  FROM wallet_balances WHERE user_id=v_uid;

  RETURN v_pos_id;
END $$;

-- live_close_position
CREATE OR REPLACE FUNCTION public.live_close_position(
  p_position_id uuid, p_mark_price numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  p record;
  v_exit numeric;
  v_pnl bigint;
  v_fee_close bigint;
  v_roi numeric;
  v_credit bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_mark_price <= 0 THEN RAISE EXCEPTION 'invalid price'; END IF;

  SELECT * INTO p FROM live_positions WHERE id=p_position_id AND user_id=v_uid AND status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'position not found'; END IF;

  v_exit := CASE WHEN p.side='long' THEN p_mark_price * 0.9994 ELSE p_mark_price * 1.0006 END;
  v_pnl := FLOOR(((v_exit - p.entry) * p.size) * (CASE WHEN p.side='long' THEN 1 ELSE -1 END))::bigint;
  v_fee_close := FLOOR(v_exit * p.size * 0.001)::bigint;
  v_roi := v_pnl::numeric / NULLIF(p.margin,0);

  -- credit back: max(0, margin + pnl - fee)
  v_credit := GREATEST(0, p.margin + v_pnl - v_fee_close);

  UPDATE wallet_balances
    SET locked_balance    = GREATEST(0, locked_balance - p.margin),
        available_balance = available_balance + v_credit,
        total_balance     = total_balance + v_credit - p.margin - v_fee_close,
        updated_at = now()
    WHERE user_id=v_uid;

  UPDATE insurance_fund SET accumulated = accumulated + FLOOR(v_fee_close*0.25)::bigint, updated_at=now() WHERE id=1;

  UPDATE live_positions SET status='closed' WHERE id=p.id;

  INSERT INTO live_trade_history(user_id,symbol,side,leverage,margin,size,entry,close_price,pnl,roi,fee_open,fee_close,reason,opened_at)
    VALUES(v_uid,p.symbol,p.side,p.leverage,p.margin,p.size,p.entry,v_exit,v_pnl,v_roi,p.fee_open,v_fee_close,'manual',p.opened_at);

  INSERT INTO transactions(user_id,kind,direction,amount,balance_after,available_after,ref_id,metadata)
  SELECT v_uid,
    CASE WHEN v_pnl>=0 THEN 'trade_close_win'::tx_kind ELSE 'trade_close_loss'::tx_kind END,
    CASE WHEN v_pnl>=0 THEN 'in' ELSE 'out' END,
    ABS(v_pnl), total_balance, available_balance, p.id::text,
    jsonb_build_object('symbol',p.symbol,'side',p.side,'leverage',p.leverage,'pnl',v_pnl,'roi',v_roi,'exit',v_exit,'reason','manual')
  FROM wallet_balances WHERE user_id=v_uid;

  INSERT INTO transactions(user_id,kind,direction,amount,balance_after,available_after,ref_id,metadata)
  SELECT v_uid,'trade_fee','out',v_fee_close,total_balance,available_balance,p.id::text,jsonb_build_object('phase','close')
  FROM wallet_balances WHERE user_id=v_uid;

  RETURN jsonb_build_object('pnl',v_pnl,'roi',v_roi,'exit',v_exit,'fee',v_fee_close,'credit',v_credit);
END $$;

-- live_liquidate_position (self-callable when ROI<=-1)
CREATE OR REPLACE FUNCTION public.live_liquidate_position(
  p_position_id uuid, p_mark_price numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  p record;
  v_pnl numeric;
  v_roi numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO p FROM live_positions WHERE id=p_position_id AND user_id=v_uid AND status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'position not found'; END IF;

  v_pnl := (p_mark_price - p.entry) * p.size * (CASE WHEN p.side='long' THEN 1 ELSE -1 END);
  v_roi := v_pnl / NULLIF(p.margin,0);
  IF v_roi > -0.99 THEN RAISE EXCEPTION 'not liquidatable'; END IF;

  UPDATE wallet_balances
    SET locked_balance = GREATEST(0, locked_balance - p.margin),
        total_balance  = GREATEST(0, total_balance - p.margin),
        updated_at = now()
    WHERE user_id=v_uid;

  UPDATE insurance_fund SET accumulated = accumulated + p.margin, updated_at=now() WHERE id=1;
  UPDATE live_positions SET status='liquidated' WHERE id=p.id;

  INSERT INTO live_trade_history(user_id,symbol,side,leverage,margin,size,entry,close_price,pnl,roi,fee_open,fee_close,reason,opened_at)
    VALUES(v_uid,p.symbol,p.side,p.leverage,p.margin,p.size,p.entry,p_mark_price,-p.margin,-1,p.fee_open,0,'liquidation',p.opened_at);

  INSERT INTO transactions(user_id,kind,direction,amount,balance_after,available_after,ref_id,metadata)
  SELECT v_uid,'trade_liquidation','out',p.margin,total_balance,available_balance,p.id::text,
    jsonb_build_object('symbol',p.symbol,'side',p.side,'leverage',p.leverage,'mark',p_mark_price)
  FROM wallet_balances WHERE user_id=v_uid;

  RETURN jsonb_build_object('liquidated',true,'margin_lost',p.margin);
END $$;

-- read helpers
CREATE OR REPLACE FUNCTION public.live_get_open_positions()
RETURNS SETOF live_positions
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM live_positions WHERE user_id = auth.uid() AND status='open' ORDER BY opened_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.live_get_history(p_limit int DEFAULT 50)
RETURNS SETOF live_trade_history
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM live_trade_history WHERE user_id = auth.uid()
  ORDER BY closed_at DESC LIMIT LEAST(GREATEST(p_limit,1),200);
$$;

-- baseline registry
INSERT INTO function_permissions_baseline(function_name, function_args, allowed_roles, category, note)
VALUES
 ('live_open_position','text, text, integer, bigint, numeric','{authenticated}','trading','Open leveraged position with internal auth.uid guard'),
 ('live_close_position','uuid, numeric','{authenticated}','trading','Manual close of own position'),
 ('live_liquidate_position','uuid, numeric','{authenticated}','trading','Self-liquidation when ROI<=-99%'),
 ('live_get_open_positions','','{authenticated}','trading','Read own open positions'),
 ('live_get_history','integer','{authenticated}','trading','Read own trade history')
ON CONFLICT DO NOTHING;
