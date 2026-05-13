-- Fix: jsonb_object_keys_count() does not exist — replace with proper count.
CREATE OR REPLACE FUNCTION public.progress_daily_combo(_step TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
  _row RECORD;
  _steps JSONB;
  _completed_count INT;
  _reward INT := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _step NOT IN ('attendance','paper_win','ai_mission','sns_share') THEN
    RAISE EXCEPTION 'invalid_step';
  END IF;

  INSERT INTO public.daily_combo_progress (user_id, date, steps)
  VALUES (_uid, _today, jsonb_build_object(_step, now()))
  ON CONFLICT (user_id, date) DO UPDATE
    SET steps = public.daily_combo_progress.steps || jsonb_build_object(_step, now())
  RETURNING * INTO _row;

  _steps := _row.steps;
  -- Count distinct completed step keys
  SELECT count(*)::int INTO _completed_count
  FROM jsonb_object_keys(_steps);

  IF _completed_count >= 4 AND _row.rewarded_at IS NULL THEN
    _reward := 10000;
    UPDATE public.daily_combo_progress SET rewarded_at = now() WHERE user_id = _uid AND date = _today;
    UPDATE public.wallet_balances
       SET available_balance = COALESCE(available_balance,0) + _reward,
           today_earned = COALESCE(today_earned,0) + _reward
     WHERE user_id = _uid;
  END IF;

  RETURN jsonb_build_object('completed', _completed_count, 'total', 4, 'reward', _reward, 'steps', _steps);
END;
$$;