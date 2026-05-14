
CREATE OR REPLACE FUNCTION public.accept_dynasty_link(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link dynasty_links%ROWTYPE;
  v_email text;
  v_kyc_ok boolean;
  v_birth date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  SELECT * INTO v_link FROM dynasty_links WHERE invite_token = _token AND status = 'pending' FOR UPDATE;
  IF v_link.id IS NULL THEN RAISE EXCEPTION 'invalid_or_used_token'; END IF;
  IF v_link.parent_id = v_uid THEN RAISE EXCEPTION 'cannot_accept_own_invite'; END IF;
  IF lower(v_email) <> v_link.child_email THEN RAISE EXCEPTION 'email_mismatch'; END IF;
  SELECT EXISTS(SELECT 1 FROM aml_verifications WHERE user_id = v_uid AND level >= 2 AND status = 'approved') INTO v_kyc_ok;
  IF NOT v_kyc_ok THEN RAISE EXCEPTION 'kyc_required'; END IF;
  SELECT birth_date INTO v_birth FROM profiles WHERE user_id = v_uid;
  IF v_birth IS NULL OR (now()::date - v_birth) < 19*365 THEN RAISE EXCEPTION 'adult_required'; END IF;
  UPDATE dynasty_links SET child_id = v_uid, status = 'active', accepted_at = now() WHERE id = v_link.id;
  RETURN jsonb_build_object('ok',true,'link_id',v_link.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.request_bequest(_link_id uuid, _asset_kind text, _phon_amount numeric DEFAULT NULL, _nft_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link dynasty_links%ROWTYPE;
  v_bal numeric;
  v_nft nft_collection%ROWTYPE;
  v_req_id uuid;
  v_cooldown timestamptz := now() + interval '48 hours';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF (auth.jwt() ->> 'aal') <> 'aal2' THEN RAISE EXCEPTION 'aal2_required'; END IF;
  SELECT * INTO v_link FROM dynasty_links WHERE id = _link_id AND parent_id = v_uid AND status = 'active';
  IF v_link.id IS NULL THEN RAISE EXCEPTION 'invalid_link'; END IF;
  IF _asset_kind = 'phon' THEN
    IF _phon_amount IS NULL OR _phon_amount <= 0 THEN RAISE EXCEPTION 'invalid_phon_amount'; END IF;
    SELECT balance INTO v_bal FROM phon_balances WHERE user_id = v_uid FOR UPDATE;
    IF COALESCE(v_bal,0) < _phon_amount THEN RAISE EXCEPTION 'insufficient_phon'; END IF;
    UPDATE phon_balances SET balance = balance - _phon_amount, updated_at = now() WHERE user_id = v_uid;
    INSERT INTO phon_transactions(user_id, amount, kind, ref, meta)
      VALUES (v_uid, -_phon_amount, 'bequest_out', 'escrow', jsonb_build_object('link_id',_link_id,'status','escrow'));
    INSERT INTO bequest_requests(link_id, parent_id, child_id, asset_kind, phon_amount, cooldown_until)
      VALUES (_link_id, v_uid, v_link.child_id, 'phon', _phon_amount, v_cooldown) RETURNING id INTO v_req_id;
  ELSIF _asset_kind = 'nft' THEN
    IF _nft_id IS NULL THEN RAISE EXCEPTION 'invalid_nft_id'; END IF;
    SELECT * INTO v_nft FROM nft_collection WHERE id = _nft_id AND user_id = v_uid FOR UPDATE;
    IF v_nft.id IS NULL THEN RAISE EXCEPTION 'nft_not_owned'; END IF;
    IF v_nft.locked_for_migration THEN RAISE EXCEPTION 'nft_locked'; END IF;
    UPDATE nft_collection SET locked_for_migration = true WHERE id = _nft_id;
    INSERT INTO bequest_requests(link_id, parent_id, child_id, asset_kind, nft_id, cooldown_until)
      VALUES (_link_id, v_uid, v_link.child_id, 'nft', _nft_id, v_cooldown) RETURNING id INTO v_req_id;
  ELSE
    RAISE EXCEPTION 'invalid_asset_kind';
  END IF;
  RETURN jsonb_build_object('ok',true,'request_id',v_req_id,'cooldown_until',v_cooldown);
END;
$$;
