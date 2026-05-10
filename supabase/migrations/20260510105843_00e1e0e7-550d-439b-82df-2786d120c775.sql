
-- 1) tx_kind enum 확장
ALTER TYPE tx_kind ADD VALUE IF NOT EXISTS 'trade_open';
ALTER TYPE tx_kind ADD VALUE IF NOT EXISTS 'trade_fee';
ALTER TYPE tx_kind ADD VALUE IF NOT EXISTS 'trade_close_win';
ALTER TYPE tx_kind ADD VALUE IF NOT EXISTS 'trade_close_loss';
ALTER TYPE tx_kind ADD VALUE IF NOT EXISTS 'trade_liquidation';

-- 2) live_positions
CREATE TABLE IF NOT EXISTS public.live_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  side text NOT NULL CHECK (side IN ('long','short')),
  leverage int NOT NULL CHECK (leverage BETWEEN 1 AND 100),
  margin bigint NOT NULL CHECK (margin > 0),
  size numeric NOT NULL,
  entry numeric NOT NULL,
  liq_price numeric NOT NULL,
  fee_open bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','liquidated')),
  opened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lp_user_status ON public.live_positions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_lp_opened ON public.live_positions(opened_at DESC);
ALTER TABLE public.live_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY lp_self_select ON public.live_positions FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 3) live_trade_history
CREATE TABLE IF NOT EXISTS public.live_trade_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  side text NOT NULL,
  leverage int NOT NULL,
  margin bigint NOT NULL,
  size numeric NOT NULL,
  entry numeric NOT NULL,
  close_price numeric NOT NULL,
  pnl bigint NOT NULL,
  roi numeric NOT NULL,
  fee_open bigint NOT NULL DEFAULT 0,
  fee_close bigint NOT NULL DEFAULT 0,
  reason text NOT NULL CHECK (reason IN ('manual','liquidation','adl')),
  opened_at timestamptz NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lth_user_closed ON public.live_trade_history(user_id, closed_at DESC);
ALTER TABLE public.live_trade_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY lth_self_select ON public.live_trade_history FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 4) insurance_fund
CREATE TABLE IF NOT EXISTS public.insurance_fund (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  accumulated bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.insurance_fund(id, accumulated) VALUES (1,0) ON CONFLICT DO NOTHING;
ALTER TABLE public.insurance_fund ENABLE ROW LEVEL SECURITY;
CREATE POLICY if_admin_select ON public.insurance_fund FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role));

-- 5) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_positions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_trade_history;
