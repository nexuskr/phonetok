CREATE OR REPLACE FUNCTION public.admin_resolve_package(_purchase_id uuid, _action text, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.package_purchases%ROWTYPE;
  _wallet public.wallet_balances%ROWTYPE;
  _boost_mult numeric;
  _seat_no int;
BEGIN
  IF NOT public.has_role(_uid, 'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _row FROM public.package_purchases WHERE id=_purchase_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  IF _action = 'approve' THEN
    IF _row.status NOT IN ('pending') THEN RAISE EXCEPTION 'invalid_state'; END IF;

    -- v5.1: Easy 150 boost reduced to +20% for margin recovery
    _boost_mult := CASE
      WHEN _row.package_id = 'empire' THEN 1.5
      WHEN _row.package_id = 'easy_150' THEN 1.2
      WHEN _row.package_id IN ('easy_starter','easy_50') THEN 1.3
      ELSE 1.0
    END;

    UPDATE public.package_purchases
      SET status='active',
          approved_at=now(),
          admin_id=_uid,
          next_settle_at = now() + interval '1 day',
          boost_until = now() + interval '3 days',
          boost_multiplier = _boost_mult
      WHERE id=_purchase_id;

    IF _row.package_id = 'empire' THEN
      SELECT * INTO _wallet FROM public.wallet_balances WHERE user_id=_row.user_id FOR UPDATE;
      IF NOT FOUND THEN
        INSERT INTO public.wallet_balances(user_id) VALUES (_row.user_id) RETURNING * INTO _wallet;
      END IF;

      -- Instant 300k withdrawable bonus (idempotent)
      IF NOT _row.instant_300k_paid THEN
        UPDATE public.wallet_balances
          SET available_balance = available_balance + 300000,
              total_balance = total_balance + 300000,
              updated_at = now()
          WHERE user_id = _row.user_id;
        UPDATE public.package_purchases SET instant_300k_paid = true WHERE id=_purchase_id;
        INSERT INTO public.transactions(user_id, kind, direction, amount, balance_after, available_after, ref_id, metadata)
          VALUES (_row.user_id, 'bonus', 'in', 300000, 0, 0, _purchase_id::text, jsonb_build_object('type','empire_instant_300k'));
      END IF;

      -- Founding seat allocation (first 30)
      SELECT seat_no INTO _seat_no FROM public.empire_founding_seats
        WHERE claimed_by IS NULL ORDER BY seat_no FOR UPDATE SKIP LOCKED LIMIT 1;
      IF _seat_no IS NOT NULL AND NOT _row.founding_bonus_paid THEN
        UPDATE public.empire_founding_seats
          SET claimed_by = _row.user_id, claimed_at = now(), purchase_id = _purchase_id
          WHERE seat_no = _seat_no;
        UPDATE public.package_purchases
          SET is_empire_founding_member = true,
              founding_seat_no = _seat_no,
              founding_bonus_paid = true
          WHERE id = _purchase_id;
        UPDATE public.wallet_balances
          SET available_balance = available_balance + 500000,
              total_balance = total_balance + 500000,
              updated_at = now()
          WHERE user_id = _row.user_id;
        INSERT INTO public.transactions(user_id, kind, direction, amount, balance_after, available_after, ref_id, metadata)
          VALUES (_row.user_id, 'bonus', 'in', 500000, 0, 0, _purchase_id::text, jsonb_build_object('type','empire_founding_500k','seat_no',_seat_no));
      END IF;
    END IF;

    RETURN jsonb_build_object('ok', true, 'boost_multiplier', _boost_mult);
  ELSIF _action = 'reject' THEN
    IF _row.status NOT IN ('pending') THEN RAISE EXCEPTION 'invalid_state'; END IF;
    UPDATE public.package_purchases
      SET status='rejected', admin_id=_uid, rejected_reason=_reason, updated_at=now()
      WHERE id=_purchase_id;
    RETURN jsonb_build_object('ok', true);
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
END;
$$;