-- TABLE: refund_requests
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  amount_krw numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
  admin_memo text,
  admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT refund_one_per_user UNIQUE (user_id)
);
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rr_self_select" ON public.refund_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "rr_self_insert" ON public.refund_requests FOR INSERT WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "rr_admin_all" ON public.refund_requests FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- TABLE: loss_protection_claims
CREATE TABLE IF NOT EXISTS public.loss_protection_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  godmode_id uuid NOT NULL REFERENCES public.first_deposit_godmode(id) ON DELETE CASCADE,
  deposit_amount_krw numeric NOT NULL,
  remaining_phon_at_claim numeric NOT NULL,
  net_loss_krw numeric NOT NULL,
  refunded_phon numeric NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loss_protection_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lpc_self_select" ON public.loss_protection_claims FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "lpc_admin_all" ON public.loss_protection_claims FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- RPC: get_recent_payouts_100 (PUBLIC)
CREATE OR REPLACE FUNCTION public.get_recent_payouts_100()
RETURNS TABLE (
  masked_nick text,
  amount_krw bigint,
  completed_at timestamptz,
  minutes_to_complete int,
  tier user_tier
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(
      LEFT(COALESCE(p.nickname, 'Emperor'), 1)
        || repeat('*', GREATEST(2, LENGTH(COALESCE(p.nickname, 'Emperor')) - 2))
        || RIGHT(COALESCE(p.nickname, 'Emperor'), 1),
      '익명'
    ) AS masked_nick,
    w.amount AS amount_krw,
    w.completed_at,
    GREATEST(1, EXTRACT(EPOCH FROM (w.completed_at - w.created_at))::int / 60) AS minutes_to_complete,
    w.tier_at_request AS tier
  FROM public.withdrawal_requests w
  LEFT JOIN public.profiles p ON p.id = w.user_id
  WHERE w.status = 'completed'
    AND w.completed_at IS NOT NULL
    AND w.completed_at > now() - interval '30 days'
  ORDER BY w.completed_at DESC
  LIMIT 100;
$$;
GRANT EXECUTE ON FUNCTION public.get_recent_payouts_100() TO anon, authenticated;

-- RPC: request_refund
CREATE OR REPLACE FUNCTION public.request_refund(_reason text)
RETURNS public.refund_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_god public.first_deposit_godmode;
  v_existing_pending int;
  v_row public.refund_requests;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN RAISE EXCEPTION 'reason_too_short'; END IF;

  SELECT * INTO v_god FROM public.first_deposit_godmode WHERE user_id = v_uid;
  IF v_god.id IS NULL THEN RAISE EXCEPTION 'no_first_deposit'; END IF;
  IF v_god.claimed_at < now() - interval '7 days' THEN RAISE EXCEPTION 'refund_window_expired'; END IF;

  SELECT count(*) INTO v_existing_pending
  FROM public.withdrawal_requests
  WHERE user_id = v_uid AND status IN ('pending','approved','completed');
  IF v_existing_pending > 0 THEN RAISE EXCEPTION 'withdrawal_exists'; END IF;

  INSERT INTO public.refund_requests(user_id, reason, amount_krw, status)
  VALUES (v_uid, trim(_reason), v_god.deposit_amount_krw, 'pending')
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.request_refund(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_refund(text) TO authenticated;

-- RPC: claim_loss_protection
CREATE OR REPLACE FUNCTION public.claim_loss_protection()
RETURNS public.loss_protection_claims
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_god public.first_deposit_godmode;
  v_existing public.loss_protection_claims;
  v_balance numeric := 0;
  v_net_loss_krw numeric;
  v_refund_phon numeric;
  v_row public.loss_protection_claims;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_god FROM public.first_deposit_godmode WHERE user_id = v_uid;
  IF v_god.id IS NULL THEN RAISE EXCEPTION 'no_godmode'; END IF;
  IF v_god.loss_protection_until < now() THEN RAISE EXCEPTION 'protection_expired'; END IF;

  SELECT * INTO v_existing FROM public.loss_protection_claims WHERE user_id = v_uid;
  IF v_existing.id IS NOT NULL THEN RAISE EXCEPTION 'already_claimed'; END IF;

  SELECT COALESCE(balance, 0) INTO v_balance FROM public.phon_balances WHERE user_id = v_uid;
  v_net_loss_krw := GREATEST(0, v_god.deposit_amount_krw - v_balance);
  IF v_net_loss_krw <= 0 THEN RAISE EXCEPTION 'no_loss_to_protect'; END IF;

  v_refund_phon := ROUND(v_net_loss_krw * 0.70, 2);

  INSERT INTO public.phon_balances(user_id, balance) VALUES (v_uid, v_refund_phon)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.phon_balances.balance + v_refund_phon;

  INSERT INTO public.phon_transactions(user_id, amount, kind, ref, meta)
  VALUES (v_uid, v_refund_phon, 'loss_protection', v_god.id::text,
          jsonb_build_object('net_loss_krw', v_net_loss_krw, 'rate', 0.70));

  INSERT INTO public.loss_protection_claims(
    user_id, godmode_id, deposit_amount_krw, remaining_phon_at_claim,
    net_loss_krw, refunded_phon
  ) VALUES (
    v_uid, v_god.id, v_god.deposit_amount_krw, v_balance,
    v_net_loss_krw, v_refund_phon
  ) RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_loss_protection() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_loss_protection() TO authenticated;

-- RPC: admin_resolve_refund
CREATE OR REPLACE FUNCTION public.admin_resolve_refund(_id uuid, _approve boolean, _memo text)
RETURNS public.refund_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.refund_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'admin_only'; END IF;
  UPDATE public.refund_requests
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      admin_memo = _memo, admin_id = auth.uid(), resolved_at = now()
  WHERE id = _id AND status = 'pending'
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found_or_resolved'; END IF;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_resolve_refund(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_refund(uuid, boolean, text) TO authenticated;