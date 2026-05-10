
-- 1) user_risk_limits ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_risk_limits (
  user_id uuid PRIMARY KEY,
  max_leverage integer NOT NULL DEFAULT 100 CHECK (max_leverage BETWEEN 1 AND 125),
  max_margin_per_trade bigint NOT NULL DEFAULT 50000000 CHECK (max_margin_per_trade > 0),
  daily_loss_cap bigint NOT NULL DEFAULT 10000000 CHECK (daily_loss_cap > 0),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_risk_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS url_self_select ON public.user_risk_limits;
CREATE POLICY url_self_select ON public.user_risk_limits FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS url_self_upsert ON public.user_risk_limits;
CREATE POLICY url_self_upsert ON public.user_risk_limits FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS url_self_update ON public.user_risk_limits;
CREATE POLICY url_self_update ON public.user_risk_limits FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RPC: upsert own risk limits
CREATE OR REPLACE FUNCTION public.set_user_risk_limits(
  p_max_leverage integer,
  p_max_margin_per_trade bigint,
  p_daily_loss_cap bigint,
  p_enabled boolean DEFAULT true
) RETURNS public.user_risk_limits
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.user_risk_limits;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_max_leverage < 1 OR p_max_leverage > 125 THEN RAISE EXCEPTION 'invalid leverage'; END IF;
  IF p_max_margin_per_trade < 1000 THEN RAISE EXCEPTION 'invalid margin cap'; END IF;
  IF p_daily_loss_cap < 1000 THEN RAISE EXCEPTION 'invalid loss cap'; END IF;

  INSERT INTO public.user_risk_limits(user_id, max_leverage, max_margin_per_trade, daily_loss_cap, enabled)
    VALUES (v_uid, p_max_leverage, p_max_margin_per_trade, p_daily_loss_cap, p_enabled)
  ON CONFLICT (user_id) DO UPDATE SET
    max_leverage = EXCLUDED.max_leverage,
    max_margin_per_trade = EXCLUDED.max_margin_per_trade,
    daily_loss_cap = EXCLUDED.daily_loss_cap,
    enabled = EXCLUDED.enabled,
    updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- BEFORE INSERT trigger on live_positions to enforce risk limits
CREATE OR REPLACE FUNCTION public.enforce_user_risk_limits()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_lim public.user_risk_limits;
  v_today_loss bigint;
BEGIN
  SELECT * INTO v_lim FROM public.user_risk_limits WHERE user_id = NEW.user_id;
  IF NOT FOUND OR NOT v_lim.enabled THEN RETURN NEW; END IF;

  IF NEW.leverage > v_lim.max_leverage THEN
    RAISE EXCEPTION '레버리지 한도 초과: 최대 %x', v_lim.max_leverage USING ERRCODE='22023';
  END IF;
  IF NEW.margin > v_lim.max_margin_per_trade THEN
    RAISE EXCEPTION '1회 최대 증거금 한도 초과' USING ERRCODE='22023';
  END IF;

  SELECT COALESCE(SUM(-pnl), 0)::bigint INTO v_today_loss
    FROM public.live_trade_history
    WHERE user_id = NEW.user_id AND pnl < 0 AND closed_at::date = CURRENT_DATE;
  IF v_today_loss >= v_lim.daily_loss_cap THEN
    RAISE EXCEPTION '일일 손실 한도 도달: 오늘은 더 이상 진입할 수 없습니다.' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_user_risk_limits ON public.live_positions;
CREATE TRIGGER trg_enforce_user_risk_limits
  BEFORE INSERT ON public.live_positions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_risk_limits();

-- 2) insurance_fund_log -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insurance_fund_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  delta bigint NOT NULL,
  balance_after bigint NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.insurance_fund_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ifl_admin_read ON public.insurance_fund_log;
CREATE POLICY ifl_admin_read ON public.insurance_fund_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS ifl_public_read ON public.insurance_fund_log;
CREATE POLICY ifl_public_read ON public.insurance_fund_log FOR SELECT TO authenticated
  USING (true); -- 펀드 기여는 공개로 간주 (사용자 식별자 미포함)

CREATE OR REPLACE FUNCTION public.tg_insurance_fund_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_delta bigint := COALESCE(NEW.accumulated,0) - COALESCE(OLD.accumulated,0);
BEGIN
  IF v_delta = 0 THEN RETURN NEW; END IF;
  INSERT INTO public.insurance_fund_log(delta, balance_after, metadata)
    VALUES (v_delta, NEW.accumulated, jsonb_build_object('updated_at', NEW.updated_at));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_insurance_fund_audit ON public.insurance_fund;
CREATE TRIGGER trg_insurance_fund_audit
  AFTER UPDATE OF accumulated ON public.insurance_fund
  FOR EACH ROW EXECUTE FUNCTION public.tg_insurance_fund_audit();

-- 3) Trade notifications -----------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_live_trade_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_title text;
  v_kind text;
  v_emoji text;
BEGIN
  CASE NEW.reason
    WHEN 'liquidation' THEN v_kind := 'trade_liquidation'; v_title := '강제 청산'; v_emoji := '🔥';
    WHEN 'tp' THEN v_kind := 'trade_tp'; v_title := '익절(TP) 자동 청산'; v_emoji := '✅';
    WHEN 'sl' THEN v_kind := 'trade_sl'; v_title := '손절(SL) 자동 청산'; v_emoji := '🛑';
    WHEN 'trailing' THEN v_kind := 'trade_trailing'; v_title := '트레일링 스탑 자동 청산'; v_emoji := '🎯';
    ELSE v_kind := 'trade_close'; v_title := '포지션 청산 완료'; v_emoji := '📤';
  END CASE;

  INSERT INTO public.notifications(user_id, kind, title, body, payload)
  VALUES (
    NEW.user_id, v_kind, v_emoji || ' ' || v_title,
    NEW.symbol || ' ' || upper(NEW.side) || ' ' || NEW.leverage || '× · PnL ' ||
      CASE WHEN NEW.pnl >= 0 THEN '+' ELSE '' END || NEW.pnl::text,
    jsonb_build_object(
      'position_id', NEW.id, 'symbol', NEW.symbol, 'side', NEW.side,
      'leverage', NEW.leverage, 'entry', NEW.entry, 'exit', NEW.close_price,
      'pnl', NEW.pnl, 'roi', NEW.roi, 'reason', NEW.reason,
      'fee_open', NEW.fee_open, 'fee_close', NEW.fee_close, 'margin', NEW.margin
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_live_trade_notify ON public.live_trade_history;
CREATE TRIGGER trg_live_trade_notify
  AFTER INSERT ON public.live_trade_history
  FOR EACH ROW EXECUTE FUNCTION public.tg_live_trade_notify();

-- 4) Withdrawal notifications -----------------------------------------
CREATE OR REPLACE FUNCTION public.tg_withdrawal_status_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_title text; v_body text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  CASE NEW.status::text
    WHEN 'reviewing' THEN v_title := '🔍 출금 검수 중';      v_body := '출금 신청이 검수 단계로 이동했습니다.';
    WHEN 'approved'  THEN v_title := '✅ 출금 승인';         v_body := '출금이 승인되어 곧 지급됩니다.';
    WHEN 'completed' THEN v_title := '💸 출금 지급 완료';     v_body := '요청하신 금액이 정상적으로 지급되었습니다.';
    WHEN 'rejected'  THEN v_title := '⛔ 출금 거절';         v_body := COALESCE('사유: '||NEW.rejected_reason, '관리자 검수에서 거절되었습니다.');
    WHEN 'cancelled' THEN v_title := '🚫 출금 취소';         v_body := '출금 요청이 취소되었습니다.';
    ELSE RETURN NEW;
  END CASE;
  INSERT INTO public.notifications(user_id, kind, title, body, payload)
  VALUES (NEW.user_id, 'withdrawal_'||NEW.status::text, v_title, v_body,
    jsonb_build_object('request_id', NEW.id, 'amount', NEW.amount, 'status', NEW.status));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_withdrawal_status_notify ON public.withdrawal_requests;
CREATE TRIGGER trg_withdrawal_status_notify
  AFTER UPDATE OF status ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_withdrawal_status_notify();

-- 5) View for insurance fund 24h contribution
CREATE OR REPLACE VIEW public.insurance_fund_24h AS
  SELECT
    COALESCE(SUM(delta) FILTER (WHERE delta > 0 AND ts > now() - interval '24 hours'), 0)::bigint AS contributed_24h,
    COALESCE(SUM(-delta) FILTER (WHERE delta < 0 AND ts > now() - interval '24 hours'), 0)::bigint AS paid_24h,
    COUNT(*) FILTER (WHERE ts > now() - interval '24 hours') AS events_24h
  FROM public.insurance_fund_log;
GRANT SELECT ON public.insurance_fund_24h TO authenticated;
