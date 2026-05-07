CREATE OR REPLACE FUNCTION public.harvest_machine(_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.package_purchases%ROWTYPE;
  _wallet public.wallet_balances%ROWTYPE;
  _today date := CURRENT_DATE;
  _month text := to_char(CURRENT_DATE,'YYYY-MM');
  _base bigint;
  _amount bigint;
  _bonus_amount bigint := 0;
  _multiplier numeric := 1.0;
  _completed boolean := false;
  _new_streak int;
  _empire_day_mult numeric;
  _seven_day_bonus boolean := false;
  _in_boost_window boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  -- Lock the purchase row
  SELECT * INTO _row FROM public.package_purchases WHERE id=_purchase_id FOR UPDATE;
  IF NOT FOUND OR _row.user_id <> _uid THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _row.status <> 'active' THEN RAISE EXCEPTION 'not_active'; END IF;
  IF _row.last_harvest_date = _today THEN RAISE EXCEPTION 'already_harvested_today'; END IF;
  IF _row.settled_count >= _row.duration_days THEN RAISE EXCEPTION 'machine_completed'; END IF;

  _base := _row.daily_return;

  -- Boost layer 1: Day 1~3 onboarding boost (pre-announced fixed schedule)
  IF _row.boost_until IS NOT NULL AND now() < _row.boost_until AND _row.boost_multiplier > 1.0 THEN
    _multiplier := _row.boost_multiplier;
    _in_boost_window := true;
  END IF;

  -- Boost layer 2: Empire Day — Empire holders, ONLY AFTER Day 1~3 boost ends (no stacking)
  IF _row.package_id = 'empire' AND NOT _in_boost_window THEN
    SELECT multiplier INTO _empire_day_mult
      FROM public.boost_schedule
      WHERE schedule_date = _today;
    IF _empire_day_mult IS NOT NULL AND _empire_day_mult > _multiplier THEN
      _multiplier := _empire_day_mult;
    END IF;
  END IF;

  _amount := (_base * _multiplier)::bigint;

  -- 7-day consecutive harvest bonus (one-time, idempotent via flag)
  _new_streak := COALESCE(_row.harvest_streak, 0);
  IF _row.last_harvest_date IS NOT NULL AND _row.last_harvest_date = _today - 1 THEN
    _new_streak := _new_streak + 1;
  ELSE
    _new_streak := 1;
  END IF;

  IF _new_streak >= 7 AND NOT _row.seven_day_bonus_paid THEN
    _bonus_amount := _base;
    _seven_day_bonus := true;
  END IF;

  -- Wallet upsert with race guard
  INSERT INTO public.wallet_balances(user_id) VALUES (_uid)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO _wallet FROM public.wallet_balances WHERE user_id=_uid FOR UPDATE;

  IF _wallet.last_reset_date <> _today THEN
    _wallet.today_earned := 0; _wallet.last_reset_date := _today;
  END IF;
  IF _wallet.last_reset_month <> _month THEN
    _wallet.monthly_earned := 0; _wallet.last_reset_month := _month;
  END IF;

  UPDATE public.wallet_balances SET
    available_balance = available_balance + _amount + _bonus_amount,
    total_balance = total_balance + _amount + _bonus_amount,
    today_earned = _wallet.today_earned + _amount + _bonus_amount,
    monthly_earned = _wallet.monthly_earned + _amount + _bonus_amount,
    last_reset_date = _today,
    last_reset_month = _month,
    updated_at = now()
  WHERE user_id=_uid;

  IF _row.settled_count + 1 >= _row.duration_days THEN
    _completed := true;
    UPDATE public.package_purchases SET
      settled_count = settled_count + 1,
      total_settled = total_settled + _amount + _bonus_amount,
      last_harvest_date = _today,
      harvest_streak = _new_streak,
      seven_day_bonus_paid = _row.seven_day_bonus_paid OR _seven_day_bonus,
      status = 'completed',
      completed_at = now(),
      next_settle_at = NULL,
      updated_at = now()
    WHERE id=_purchase_id;
  ELSE
    UPDATE public.package_purchases SET
      settled_count = settled_count + 1,
      total_settled = total_settled + _amount + _bonus_amount,
      last_harvest_date = _today,
      harvest_streak = _new_streak,
      seven_day_bonus_paid = _row.seven_day_bonus_paid OR _seven_day_bonus,
      next_settle_at = (now() + interval '1 day'),
      updated_at = now()
    WHERE id=_purchase_id;
  END IF;

  INSERT INTO public.transactions(user_id, kind, direction, amount, balance_after, available_after, ref_id, metadata)
    VALUES (_uid,'package_settle','credit',_amount,
            _wallet.total_balance + _amount,
            _wallet.available_balance + _amount,
            _purchase_id::text,
            jsonb_build_object(
              'source','machine_harvest',
              'package_id',_row.package_id,
              'streak',_new_streak,
              'multiplier',_multiplier,
              'boost_window', _in_boost_window
            ));

  IF _seven_day_bonus THEN
    INSERT INTO public.transactions(user_id, kind, direction, amount, balance_after, available_after, ref_id, metadata)
      VALUES (_uid,'package_settle','credit',_bonus_amount,
              _wallet.total_balance + _amount + _bonus_amount,
              _wallet.available_balance + _amount + _bonus_amount,
              _purchase_id::text,
              jsonb_build_object('source','seven_day_bonus','package_id',_row.package_id));
  END IF;

  RETURN jsonb_build_object(
    'ok',true,
    'amount',_amount,
    'bonus',_bonus_amount,
    'multiplier',_multiplier,
    'boost_window',_in_boost_window,
    'streak',_new_streak,
    'seven_day_bonus',_seven_day_bonus,
    'completed',_completed,
    'new_balance',_wallet.available_balance + _amount + _bonus_amount,
    'days_left', GREATEST(0, _row.duration_days - (_row.settled_count + 1))
  );
END $$;

REVOKE ALL ON FUNCTION public.harvest_machine(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.harvest_machine(uuid) TO authenticated;