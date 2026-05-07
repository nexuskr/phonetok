CREATE OR REPLACE FUNCTION public.start_ai_bot_run(_kind public.ai_bot_kind, _prompt TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _tier public.user_tier;
  _limit INT;
  _used INT;
  _exp TIMESTAMPTZ;
  _seed NUMERIC;
  _id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT tier INTO _tier FROM public.profiles WHERE id=_uid;
  IF _tier IS NULL THEN _tier := 'normal'; END IF;

  _limit := public.ai_bot_daily_limit(_tier, _kind);

  SELECT COUNT(*) INTO _used FROM public.ai_bot_runs
   WHERE user_id=_uid AND kind=_kind
     AND created_at::date = CURRENT_DATE
     AND status <> 'failed'::public.ai_bot_status;

  IF _used >= _limit THEN
    RAISE EXCEPTION 'daily_limit:%', _limit;
  END IF;

  IF _kind = 'trading' THEN
    _exp := now() + interval '8 hours';
    _seed := random();
  END IF;

  INSERT INTO public.ai_bot_runs(user_id, kind, status, prompt, expires_at, trading_seed)
    VALUES (_uid, _kind, 'running'::public.ai_bot_status, _prompt, _exp, _seed)
    RETURNING id INTO _id;

  RETURN jsonb_build_object('ok',true,'id',_id,'used',_used+1,'limit',_limit,'expires_at',_exp);
END $$;

REVOKE EXECUTE ON FUNCTION public.start_ai_bot_run(public.ai_bot_kind, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_ai_bot_run(public.ai_bot_kind, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_ai_bot_run(
  _run_id UUID, _output_text TEXT, _output_path TEXT, _error TEXT
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE _row public.ai_bot_runs%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.ai_bot_runs WHERE id=_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _row.status NOT IN ('running'::public.ai_bot_status) THEN RAISE EXCEPTION 'invalid_state'; END IF;

  IF _error IS NOT NULL THEN
    UPDATE public.ai_bot_runs SET status='failed'::public.ai_bot_status, error=_error WHERE id=_run_id;
    RETURN jsonb_build_object('ok',false,'error',_error);
  END IF;

  IF _row.kind = 'trading' THEN
    UPDATE public.ai_bot_runs SET output_text=_output_text WHERE id=_run_id;
  ELSE
    UPDATE public.ai_bot_runs
       SET status='ready'::public.ai_bot_status, output_text=_output_text, output_path=_output_path, ready_at=now()
     WHERE id=_run_id;
  END IF;

  RETURN jsonb_build_object('ok',true);
END $$;

REVOKE EXECUTE ON FUNCTION public.finalize_ai_bot_run(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;