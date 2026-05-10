CREATE TABLE public.jackpot_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  deposit_amount BIGINT NOT NULL CHECK (deposit_amount > 0),
  contribution_amount BIGINT NOT NULL CHECK (contribution_amount > 0),
  contribution_pct NUMERIC NOT NULL DEFAULT 8.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.jackpot_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jc_self_read" ON public.jackpot_contributions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "jc_admin_read" ON public.jackpot_contributions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_jc_user ON public.jackpot_contributions(user_id, created_at DESC);

CREATE TABLE public.jackpot_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_id UUID NOT NULL,
  winner_nickname TEXT,
  total_pool BIGINT NOT NULL CHECK (total_pool > 0),
  winner_payout BIGINT NOT NULL,
  operator_retain BIGINT NOT NULL,
  winner_pct NUMERIC NOT NULL DEFAULT 55.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.jackpot_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "js_public_read" ON public.jackpot_settlements FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_js_created ON public.jackpot_settlements(created_at DESC);

CREATE OR REPLACE FUNCTION public.accrue_jackpot(p_deposit_amount BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _contrib BIGINT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_deposit_amount IS NULL OR p_deposit_amount <= 0 OR p_deposit_amount > 1000000000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  _contrib := FLOOR(p_deposit_amount * 0.08)::BIGINT;
  IF _contrib <= 0 THEN _contrib := 1; END IF;
  UPDATE public.jackpot_pool SET amount = amount + _contrib, updated_at = now() WHERE id = 1;
  INSERT INTO public.jackpot_contributions(user_id, deposit_amount, contribution_amount, contribution_pct)
  VALUES (_uid, p_deposit_amount, _contrib, 8.0);
  RETURN jsonb_build_object('ok', true, 'contribution', _contrib);
END $$;

CREATE OR REPLACE FUNCTION public.settle_jackpot(p_winner_id UUID, p_nickname TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _caller UUID := auth.uid(); _pool BIGINT; _payout BIGINT; _retain BIGINT;
BEGIN
  IF _caller IS NULL OR NOT public.has_role(_caller, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_winner_id IS NULL THEN RAISE EXCEPTION 'winner_required'; END IF;
  SELECT amount INTO _pool FROM public.jackpot_pool WHERE id = 1 FOR UPDATE;
  IF _pool IS NULL OR _pool <= 0 THEN RAISE EXCEPTION 'empty_pool'; END IF;
  _payout := FLOOR(_pool * 0.55)::BIGINT;
  _retain := _pool - _payout;
  INSERT INTO public.wallet_balances(user_id, balance) VALUES (p_winner_id, _payout)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.wallet_balances.balance + _payout, updated_at = now();
  UPDATE public.jackpot_pool SET amount = _retain, last_winner = p_winner_id, last_winner_nickname = p_nickname,
    last_won_amount = _payout, last_won_at = now(), updated_at = now() WHERE id = 1;
  INSERT INTO public.jackpot_settlements(winner_id, winner_nickname, total_pool, winner_payout, operator_retain, winner_pct)
  VALUES (p_winner_id, p_nickname, _pool, _payout, _retain, 55.0);
  RETURN jsonb_build_object('ok', true, 'pool', _pool, 'payout', _payout, 'retain', _retain);
END $$;

INSERT INTO public.function_permissions_baseline(function_name, function_args, allowed_roles, category, note) VALUES
  ('accrue_jackpot', 'p_deposit_amount bigint', ARRAY['authenticated']::text[], 'jackpot', 'Phase 8: 입금액의 8% 잭팟 풀 자동 적립'),
  ('settle_jackpot', 'p_winner_id uuid, p_nickname text', ARRAY['authenticated']::text[], 'jackpot', 'Phase 8: 잭팟 정산 — 55% 당첨자 / 45% 운영자 마진 (내부 has_role 가드)')
ON CONFLICT (function_name, function_args) DO UPDATE
  SET allowed_roles = EXCLUDED.allowed_roles, note = EXCLUDED.note, updated_at = now();