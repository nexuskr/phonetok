
CREATE TABLE IF NOT EXISTS public.pending_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  side text NOT NULL CHECK (side IN ('long','short')),
  kind text NOT NULL CHECK (kind IN ('limit','stop')),
  trigger_price numeric NOT NULL CHECK (trigger_price > 0),
  leverage int NOT NULL CHECK (leverage BETWEEN 1 AND 100),
  margin bigint NOT NULL CHECK (margin > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','filled','cancelled','expired')),
  filled_position_id uuid,
  fill_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  filled_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pending_orders_open ON public.pending_orders(status, symbol) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_pending_orders_user ON public.pending_orders(user_id, created_at DESC);

ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_pending" ON public.pending_orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users_insert_own_pending" ON public.pending_orders
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_cancel_own_pending" ON public.pending_orders
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'open')
  WITH CHECK (user_id = auth.uid() AND status IN ('open','cancelled'));

CREATE OR REPLACE FUNCTION public.fill_pending_order(p_order_id uuid, p_mark_price numeric)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_o public.pending_orders%ROWTYPE;
  v_pos_id uuid;
BEGIN
  SELECT * INTO v_o FROM public.pending_orders WHERE id = p_order_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not open'; END IF;

  -- impersonate user via setting auth.uid through has_role check is not available;
  -- live_open_position uses auth.uid() so we replicate the inserts here directly with v_o.user_id.
  -- Reuse calculation by raising via dynamic SQL would be complex; instead, perform the equivalent insert.
  DECLARE
    v_fee bigint := (v_o.margin * v_o.leverage * 0.001)::bigint;
    v_size numeric := (v_o.margin * v_o.leverage) / p_mark_price;
    v_liq numeric;
  BEGIN
    IF v_o.side = 'long' THEN
      v_liq := p_mark_price * (1 - 1.0 / v_o.leverage);
    ELSE
      v_liq := p_mark_price * (1 + 1.0 / v_o.leverage);
    END IF;

    INSERT INTO public.live_positions(
      user_id, symbol, side, leverage, margin, size, entry, liq_price, fee_open, status, opened_at, margin_mode
    ) VALUES (
      v_o.user_id, v_o.symbol, v_o.side, v_o.leverage, v_o.margin, v_size, p_mark_price, v_liq, v_fee, 'open', now(), 'isolated'
    ) RETURNING id INTO v_pos_id;
  END;

  UPDATE public.pending_orders
    SET status = 'filled', filled_at = now(), filled_position_id = v_pos_id
    WHERE id = p_order_id;
  RETURN v_pos_id;
EXCEPTION WHEN OTHERS THEN
  UPDATE public.pending_orders SET status = 'expired', fill_error = SQLERRM WHERE id = p_order_id;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.fill_pending_order(uuid, numeric) FROM public, anon, authenticated;
-- only service-role / cron can call

CREATE OR REPLACE FUNCTION public.cancel_pending_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.pending_orders
    SET status = 'cancelled', cancelled_at = now()
    WHERE id = p_order_id AND user_id = auth.uid() AND status = 'open';
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.cancel_pending_order(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_pending_order(uuid) TO authenticated;
