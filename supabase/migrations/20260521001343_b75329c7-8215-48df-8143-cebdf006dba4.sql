-- 1) live_positions 청산 트리거가 존재하지 않는 컬럼 NEW.realized_pnl 을 참조하던 버그 수정
CREATE OR REPLACE FUNCTION public._achv_on_position_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'closed' AND COALESCE(OLD.status,'') <> 'closed'
     AND NEW.user_id IS NOT NULL THEN
    PERFORM public._achv_increment(NEW.user_id, 'trade_first', 1);
    PERFORM public._achv_increment(NEW.user_id, 'trade_10',   1);
    PERFORM public._achv_increment(NEW.user_id, 'trade_100',  1);
    PERFORM public._achv_increment(NEW.user_id, 'trade_1000', 1);
    -- realized_pnl 의존 증분(phon_first_win / phon_profit_100k / lev_*x_win)
    -- 은 live_positions 에 컬럼이 없으므로 close_position_phon RPC 본문에서 직접 처리하도록 이전 예정
  END IF;
  RETURN NEW;
END
$function$;

-- 2) check_achievements: withdrawal_status enum 에 없는 'done' 리터럴 제거 (101 라인 부근)
CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := COALESCE(_user_id, auth.uid());
  _profile public.profiles%ROWTYPE;
  _wallet public.wallet_balances%ROWTYPE;
  _approved_deposits bigint;
  _voucher_count bigint;
  _active_refs bigint;
  _jackpot_count bigint;
  _last_withdraw timestamptz;
  _has_pkg boolean;
  _has_first_withdraw boolean;
  _has_first_ref bigint;
  _has_handbook boolean;
  _unlocked text[] := ARRAY[]::text[];
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','no_user'); END IF;
  IF _user_id IS NOT NULL AND _user_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _profile FROM public.profiles WHERE id = _uid;
  SELECT * INTO _wallet FROM public.wallet_balances WHERE user_id = _uid;

  IF _profile.coin_master_unlocked
     AND NOT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id=_uid AND achievement_key='coin_master') THEN
    INSERT INTO public.user_achievements(user_id, achievement_key) VALUES (_uid,'coin_master') ON CONFLICT DO NOTHING;
    _unlocked := array_append(_unlocked,'coin_master');
  END IF;

  SELECT COALESCE(SUM(amount),0) INTO _approved_deposits
    FROM public.deposit_requests WHERE user_id=_uid AND status='approved';
  IF _approved_deposits >= 1000000
     AND NOT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id=_uid AND achievement_key='golden_hand') THEN
    INSERT INTO public.user_achievements(user_id, achievement_key) VALUES (_uid,'golden_hand') ON CONFLICT DO NOTHING;
    _unlocked := array_append(_unlocked,'golden_hand');
  END IF;

  SELECT COUNT(*) INTO _voucher_count
    FROM public.deposit_requests WHERE user_id=_uid AND status='approved' AND method::text='voucher';
  IF _voucher_count >= 5
     AND NOT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id=_uid AND achievement_key='voucher_king') THEN
    INSERT INTO public.user_achievements(user_id, achievement_key) VALUES (_uid,'voucher_king') ON CONFLICT DO NOTHING;
    _unlocked := array_append(_unlocked,'voucher_king');
  END IF;

  SELECT COUNT(*) INTO _active_refs
    FROM public.referrals WHERE inviter_id=_uid AND first_deposit_bonus_paid=true;
  IF _active_refs >= 50
     AND NOT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id=_uid AND achievement_key='legend_referrer') THEN
    INSERT INTO public.user_achievements(user_id, achievement_key) VALUES (_uid,'legend_referrer') ON CONFLICT DO NOTHING;
    _unlocked := array_append(_unlocked,'legend_referrer');
  END IF;

  SELECT COUNT(*) INTO _jackpot_count FROM public.roulette_spins
    WHERE user_id=_uid AND lower(prize_label) LIKE '%잭팟%';
  IF _jackpot_count >= 3
     AND NOT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id=_uid AND achievement_key='jackpot_hunter') THEN
    INSERT INTO public.user_achievements(user_id, achievement_key) VALUES (_uid,'jackpot_hunter') ON CONFLICT DO NOTHING;
    _unlocked := array_append(_unlocked,'jackpot_hunter');
  END IF;

  SELECT MAX(created_at) INTO _last_withdraw FROM public.withdrawal_requests
    WHERE user_id=_uid AND status <> 'rejected';
  IF _profile.created_at < now() - interval '30 days'
     AND COALESCE(_wallet.total_balance,0) > 0
     AND (_last_withdraw IS NULL OR _last_withdraw < now() - interval '30 days')
     AND NOT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id=_uid AND achievement_key='diamond_hand') THEN
    INSERT INTO public.user_achievements(user_id, achievement_key) VALUES (_uid,'diamond_hand') ON CONFLICT DO NOTHING;
    _unlocked := array_append(_unlocked,'diamond_hand');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.package_purchases pp
    WHERE pp.user_id=_uid AND pp.created_at < _profile.created_at + interval '24 hours'
  ) INTO _has_pkg;
  IF _has_pkg
     AND NOT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id=_uid AND achievement_key='speed_runner') THEN
    INSERT INTO public.user_achievements(user_id, achievement_key) VALUES (_uid,'speed_runner') ON CONFLICT DO NOTHING;
    _unlocked := array_append(_unlocked,'speed_runner');
  END IF;

  IF EXISTS(SELECT 1 FROM public.package_purchases WHERE user_id=_uid AND is_empire_founding_member=true)
     AND NOT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id=_uid AND achievement_key='empire_founder') THEN
    INSERT INTO public.user_achievements(user_id, achievement_key) VALUES (_uid,'empire_founder') ON CONFLICT DO NOTHING;
    _unlocked := array_append(_unlocked,'empire_founder');
  END IF;

  IF EXISTS(SELECT 1 FROM public.season_pass_progress WHERE user_id=_uid AND premium=true)
     AND NOT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id=_uid AND achievement_key='season_pass_premium') THEN
    INSERT INTO public.user_achievements(user_id, achievement_key) VALUES (_uid,'season_pass_premium') ON CONFLICT DO NOTHING;
    _unlocked := array_append(_unlocked,'season_pass_premium');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.handbook_progress WHERE user_id=_uid AND bonus_paid=true) INTO _has_handbook;
  -- enum withdrawal_status: pending/approved/processing/completed/rejected/cancelled/paid
  -- 'done' 은 enum 에 없으므로 제거 (22P02 오류 차단)
  SELECT EXISTS(
    SELECT 1 FROM public.withdrawal_requests
    WHERE user_id=_uid AND status IN ('approved','completed','paid')
  ) INTO _has_first_withdraw;
  SELECT COUNT(*) INTO _has_first_ref FROM public.referrals WHERE inviter_id=_uid;
  IF _has_handbook AND _has_first_withdraw AND _has_first_ref >= 1
     AND NOT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id=_uid AND achievement_key='handbook_master') THEN
    INSERT INTO public.user_achievements(user_id, achievement_key) VALUES (_uid,'handbook_master') ON CONFLICT DO NOTHING;
    _unlocked := array_append(_unlocked,'handbook_master');
  END IF;

  IF EXISTS(SELECT 1 FROM public.weekly_referral_leaderboard WHERE inviter_id=_uid AND rank=1)
     AND NOT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id=_uid AND achievement_key='weekly_top1') THEN
    INSERT INTO public.user_achievements(user_id, achievement_key) VALUES (_uid,'weekly_top1') ON CONFLICT DO NOTHING;
    _unlocked := array_append(_unlocked,'weekly_top1');
  END IF;

  IF EXISTS(SELECT 1 FROM public.daily_stats WHERE user_id=_uid AND best_streak >= 50)
     AND NOT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id=_uid AND achievement_key='streak_50') THEN
    INSERT INTO public.user_achievements(user_id, achievement_key) VALUES (_uid,'streak_50') ON CONFLICT DO NOTHING;
    _unlocked := array_append(_unlocked,'streak_50');
  END IF;

  IF (SELECT COUNT(*) FROM public.mission_history
      WHERE user_id=_uid AND is_win=true
        AND EXTRACT(hour FROM created_at AT TIME ZONE 'Asia/Seoul') BETWEEN 0 AND 5) >= 7
     AND NOT EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id=_uid AND achievement_key='night_owl') THEN
    INSERT INTO public.user_achievements(user_id, achievement_key) VALUES (_uid,'night_owl') ON CONFLICT DO NOTHING;
    _unlocked := array_append(_unlocked,'night_owl');
  END IF;

  RETURN jsonb_build_object('ok',true,'unlocked',_unlocked);
END
$function$;

-- 3) 오라클 최대 허용 지연 상향 (54000 "시장가 동기화 지연" 오픈 실패 완화)
UPDATE public.trading_safeguards_config
SET oracle_max_age_seconds = GREATEST(COALESCE(oracle_max_age_seconds, 0), 90)
WHERE id = 1;