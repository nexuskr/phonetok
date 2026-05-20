CREATE OR REPLACE FUNCTION public.apex_place_bet_v2(
  _game_code text,
  _bet_phon numeric,
  _bet_usdt numeric,
  _params jsonb,
  _idem_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_existing record;
  v_result jsonb;
  v_roll_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','not_authenticated');
  END IF;
  IF _idem_key IS NULL OR length(_idem_key) < 8 OR length(_idem_key) > 128 THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_idem_key');
  END IF;

  -- Fast path: return cached roll for this idem key
  SELECT id, multiplier, payout_phon, payout_usdt, result_json, server_seed_hash, client_seed, nonce
    INTO v_existing
    FROM public.apex_game_rolls
   WHERE user_id = v_user AND idempotency_key = _idem_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'cached', true, 'roll_id', v_existing.id,
      'multiplier', v_existing.multiplier,
      'payout_phon', v_existing.payout_phon,
      'payout_usdt', v_existing.payout_usdt,
      'result', v_existing.result_json,
      'server_seed_hash', v_existing.server_seed_hash,
      'client_seed', v_existing.client_seed,
      'nonce', v_existing.nonce
    );
  END IF;

  -- Serialize concurrent calls with same idem key
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || _idem_key, 0));

  -- Recheck after lock
  SELECT id, multiplier, payout_phon, payout_usdt, result_json, server_seed_hash, client_seed, nonce
    INTO v_existing
    FROM public.apex_game_rolls
   WHERE user_id = v_user AND idempotency_key = _idem_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'cached', true, 'roll_id', v_existing.id,
      'multiplier', v_existing.multiplier,
      'payout_phon', v_existing.payout_phon,
      'payout_usdt', v_existing.payout_usdt,
      'result', v_existing.result_json,
      'server_seed_hash', v_existing.server_seed_hash,
      'client_seed', v_existing.client_seed,
      'nonce', v_existing.nonce
    );
  END IF;

  -- Delegate to existing money-flow RPC (body untouched).
  v_result := public.apex_play_mock_game(_game_code, _bet_phon, _bet_usdt, _params);
  IF COALESCE((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_result;
  END IF;

  v_roll_id := (v_result->>'roll_id')::uuid;
  IF v_roll_id IS NOT NULL THEN
    UPDATE public.apex_game_rolls
       SET idempotency_key = _idem_key
     WHERE id = v_roll_id AND user_id = v_user AND idempotency_key IS NULL;
  END IF;

  INSERT INTO public.apex_daily_cap(user_id, ymd, count)
  VALUES (v_user, (now() AT TIME ZONE 'Asia/Seoul')::date, 1)
  ON CONFLICT (user_id, ymd) DO UPDATE
    SET count = public.apex_daily_cap.count + 1;

  RETURN v_result || jsonb_build_object('cached', false);
END
$function$;

REVOKE ALL ON FUNCTION public.apex_place_bet_v2(text,numeric,numeric,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apex_place_bet_v2(text,numeric,numeric,jsonb,text) TO authenticated;