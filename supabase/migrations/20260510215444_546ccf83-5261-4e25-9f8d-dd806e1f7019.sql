CREATE OR REPLACE FUNCTION public._accrue_jackpot_internal(_user_id uuid, _deposit_amount bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _contrib bigint;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;
  IF _deposit_amount IS NULL OR _deposit_amount <= 0 THEN RETURN 0; END IF;
  _contrib := FLOOR(_deposit_amount * 0.08)::bigint;
  IF _contrib <= 0 THEN _contrib := 1; END IF;
  UPDATE public.jackpot_pool SET amount = amount + _contrib, updated_at = now() WHERE id = 1;
  INSERT INTO public.jackpot_contributions(user_id, deposit_amount, contribution_amount, contribution_pct)
  VALUES (_user_id, _deposit_amount, _contrib, 8.0);
  RETURN _contrib;
END $$;

REVOKE ALL ON FUNCTION public._accrue_jackpot_internal(uuid, bigint) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_deposit(_request_id uuid, _action text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _uid UUID := auth.uid();
  _row public.deposit_requests%ROWTYPE;
  _wallet public.wallet_balances%ROWTYPE;
  _credit bigint;
  _is_first_deposit boolean;
  _jp_contrib bigint;
BEGIN
  IF NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _row FROM public.deposit_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _row.status <> 'pending' THEN RAISE EXCEPTION 'invalid_state'; END IF;

  IF _action = 'approve' THEN
    _credit := _row.amount + COALESCE(_row.bonus_amount, 0);
    SELECT * INTO _wallet FROM public.wallet_balances WHERE user_id=_row.user_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.wallet_balances(user_id) VALUES (_row.user_id) RETURNING * INTO _wallet;
    END IF;
    UPDATE public.wallet_balances SET
      available_balance = available_balance + _credit,
      total_balance = total_balance + _credit,
      updated_at = now()
    WHERE user_id=_row.user_id;
    UPDATE public.deposit_requests SET status='approved', approved_at=now(), admin_id=_uid WHERE id=_request_id;

    IF _row.method::text = 'coin' THEN
      UPDATE public.profiles
        SET total_coin_deposits = total_coin_deposits + _row.amount,
            coin_master_unlocked = (total_coin_deposits + _row.amount) >= 500000
        WHERE id = _row.user_id;
    END IF;

    INSERT INTO public.transactions(user_id, kind, direction, amount, balance_after, available_after, ref_id, metadata)
      VALUES (_row.user_id,'deposit_credit','credit',_credit,
              _wallet.total_balance + _credit, _wallet.available_balance + _credit,
              _request_id::text,
              jsonb_build_object('method',_row.method,'package_id',_row.package_id,
                'principal',_row.amount,'bonus',_row.bonus_amount,
                'bonus_pct',_row.bonus_pct,'voucher_brand',_row.voucher_brand));

    SELECT NOT EXISTS(
      SELECT 1 FROM public.deposit_requests
      WHERE user_id = _row.user_id AND status='approved' AND id <> _request_id
    ) INTO _is_first_deposit;
    IF _is_first_deposit THEN
      PERFORM public._credit_referral_first_deposit(_row.user_id);
    END IF;
    PERFORM public._credit_referral_commission(_row.user_id, _row.amount, 'deposit');

    -- Phase 8: 입금 승인 시 입금액의 8% 자동 잭팟 적립
    _jp_contrib := public._accrue_jackpot_internal(_row.user_id, _row.amount);

    RETURN jsonb_build_object('ok',true,'action',_action,'jackpot_contribution',_jp_contrib);
  ELSIF _action = 'reject' THEN
    UPDATE public.deposit_requests SET status='rejected', rejected_reason=_reason, admin_id=_uid WHERE id=_request_id;
    RETURN jsonb_build_object('ok',true,'action',_action);
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
END $function$;

INSERT INTO public.function_permissions_baseline(function_name, function_args, allowed_roles, category, note) VALUES
  ('_accrue_jackpot_internal', '_user_id uuid, _deposit_amount bigint', ARRAY[]::text[], 'jackpot',
   'Phase 8 internal — 입금 승인 트리거에서만 호출. PUBLIC/anon/authenticated REVOKE 완료')
ON CONFLICT (function_name, function_args) DO UPDATE
  SET allowed_roles = EXCLUDED.allowed_roles, note = EXCLUDED.note, updated_at = now();