
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS first_deposit_bonus_paid boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public._credit_referral_first_deposit(_invitee uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ref public.referrals%ROWTYPE;
  _wallet_inv public.wallet_balances%ROWTYPE;
  _wallet_invitee public.wallet_balances%ROWTYPE;
  _bonus_inviter bigint := 20000;
  _bonus_invitee bigint := 10000;
BEGIN
  SELECT * INTO _ref FROM public.referrals WHERE invitee_id = _invitee FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF _ref.first_deposit_bonus_paid THEN RETURN; END IF;

  SELECT * INTO _wallet_inv FROM public.wallet_balances WHERE user_id = _ref.inviter_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.wallet_balances(user_id) VALUES (_ref.inviter_id) RETURNING * INTO _wallet_inv;
  END IF;
  UPDATE public.wallet_balances SET
    available_balance = available_balance + _bonus_inviter,
    total_balance = total_balance + _bonus_inviter,
    updated_at = now()
  WHERE user_id = _ref.inviter_id;
  INSERT INTO public.transactions(user_id, kind, direction, amount, balance_after, available_after, metadata)
    VALUES (_ref.inviter_id,'profit_share','credit',_bonus_inviter,
            _wallet_inv.total_balance + _bonus_inviter, _wallet_inv.available_balance + _bonus_inviter,
            jsonb_build_object('source','referral_first_deposit_inviter','invitee',_invitee));

  SELECT * INTO _wallet_invitee FROM public.wallet_balances WHERE user_id = _invitee FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.wallet_balances(user_id) VALUES (_invitee) RETURNING * INTO _wallet_invitee;
  END IF;
  UPDATE public.wallet_balances SET
    available_balance = available_balance + _bonus_invitee,
    total_balance = total_balance + _bonus_invitee,
    updated_at = now()
  WHERE user_id = _invitee;
  INSERT INTO public.transactions(user_id, kind, direction, amount, balance_after, available_after, metadata)
    VALUES (_invitee,'profit_share','credit',_bonus_invitee,
            _wallet_invitee.total_balance + _bonus_invitee, _wallet_invitee.available_balance + _bonus_invitee,
            jsonb_build_object('source','referral_first_deposit_invitee','inviter',_ref.inviter_id));

  UPDATE public.referrals
    SET first_deposit_bonus_paid = true,
        total_commission = total_commission + _bonus_inviter
  WHERE id = _ref.id;
  INSERT INTO public.referral_earnings(inviter_id, invitee_id, source, base_amount, commission)
    VALUES (_ref.inviter_id, _invitee, 'first_deposit_bonus', 0, _bonus_inviter);
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_deposit(_request_id uuid, _action text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _uid UUID := auth.uid();
  _row public.deposit_requests%ROWTYPE;
  _wallet public.wallet_balances%ROWTYPE;
  _credit bigint;
  _is_first_deposit boolean;
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
  ELSIF _action = 'reject' THEN
    UPDATE public.deposit_requests SET status='rejected', rejected_reason=_reason, admin_id=_uid WHERE id=_request_id;
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
  RETURN jsonb_build_object('ok',true,'action',_action);
END $function$;

CREATE OR REPLACE VIEW public.weekly_referral_leaderboard AS
SELECT
  r.inviter_id,
  COALESCE(p.nickname, '익명') AS nickname,
  p.tier,
  COUNT(DISTINCT r.invitee_id)::bigint AS invited_7d,
  COALESCE(SUM(re.commission), 0)::bigint AS commission_7d,
  RANK() OVER (
    ORDER BY COUNT(DISTINCT r.invitee_id) DESC,
             COALESCE(SUM(re.commission),0) DESC
  ) AS rank
FROM public.referrals r
LEFT JOIN public.referral_earnings re
  ON re.inviter_id = r.inviter_id
 AND re.created_at > now() - interval '7 days'
LEFT JOIN public.profiles p ON p.id = r.inviter_id
WHERE r.created_at > now() - interval '7 days'
GROUP BY r.inviter_id, p.nickname, p.tier;

REVOKE ALL ON public.weekly_referral_leaderboard FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_weekly_referral_leaderboard(_limit int DEFAULT 10)
RETURNS TABLE(inviter_id uuid, nickname text, tier user_tier, invited_7d bigint, commission_7d bigint, rank bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT inviter_id, nickname, tier, invited_7d, commission_7d, rank
  FROM public.weekly_referral_leaderboard
  ORDER BY rank ASC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit,10), 100));
$$;

CREATE OR REPLACE FUNCTION public.get_my_weekly_referral_rank()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT to_jsonb(v) FROM public.weekly_referral_leaderboard v WHERE v.inviter_id = auth.uid()),
    jsonb_build_object('inviter_id', auth.uid(), 'invited_7d', 0, 'commission_7d', 0, 'rank', null)
  );
$$;

INSERT INTO public.achievements_catalog (key, name, description, category, ap, reward_credit, badge_tier, sort_order) VALUES
  ('coin_master',         '코인 마스터',     '코인 누적 입금 50만원 달성',         'deposit',   80, 50000,  'gold',   200),
  ('golden_hand',         '황금손',          '누적 입금 100만원 달성',              'deposit',  120, 80000,  'gold',   201),
  ('diamond_hand',        '다이아몬드 핸드', '잔고 30일간 미출금 유지',             'hold',     150, 120000, 'platinum', 202),
  ('legend_referrer',     '레전드 추천왕',   '활성 추천 50명 달성',                 'referral', 400, 500000, 'legend', 203),
  ('weekly_top1',         '주간 추천왕',     '주간 리더보드 1위',                   'referral', 200, 300000, 'platinum', 204),
  ('jackpot_hunter',      '잭팟 헌터',       '룰렛/가챠 잭팟 3회 적중',             'luck',     150, 100000, 'gold',   205),
  ('voucher_king',        '상품권 킹',       '상품권 입금 5회 승인',                'deposit',   60, 30000,  'silver', 206),
  ('speed_runner',        '스피드 러너',     '가입 24시간 내 패키지 구매',          'onboard',   80, 40000,  'gold',   207),
  ('night_owl',           '심야의 사냥꾼',   '0시~6시 미션 7회 클리어',             'mission',   40, 15000,  'silver', 208),
  ('streak_50',           '불멸의 50연승',   '연속 미션 50승',                      'mission',  300, 400000, 'legend', 209),
  ('empire_founder',      '제국 창립 멤버',  'Empire 창립 멤버 좌석 확보',          'tier',     500, 1000000,'legend', 210),
  ('season_pass_premium', '프리미엄 황제',   '시즌 패스 프리미엄 구매',             'season',    50, 20000,  'silver', 211),
  ('handbook_master',     '핸드북 마스터',   '핸드북 + 첫 출금 + 첫 추천 달성',     'onboard',   60, 30000,  'gold',   212)
ON CONFLICT (key) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, category=EXCLUDED.category,
  ap=EXCLUDED.ap, reward_credit=EXCLUDED.reward_credit, badge_tier=EXCLUDED.badge_tier,
  sort_order=EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  SELECT EXISTS(SELECT 1 FROM public.withdrawal_requests WHERE user_id=_uid AND status IN ('approved','completed','paid','done')) INTO _has_first_withdraw;
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
END $$;

CREATE OR REPLACE FUNCTION public.submit_aml_verification(
  _level int, _selfie_path text DEFAULT NULL,
  _doc_signed boolean DEFAULT false, _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _level NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'invalid_level'; END IF;
  IF _level >= 2 AND _selfie_path IS NULL THEN RAISE EXCEPTION 'selfie_required'; END IF;
  IF _level = 3 AND NOT _doc_signed THEN RAISE EXCEPTION 'doc_required'; END IF;

  IF EXISTS(SELECT 1 FROM public.aml_verifications WHERE user_id=_uid AND level=_level AND status='approved') THEN
    RETURN jsonb_build_object('ok',true,'already',true);
  END IF;

  INSERT INTO public.aml_verifications(user_id, level, status, selfie_path, doc_signed_at, metadata)
    VALUES (_uid, _level, 'pending', _selfie_path,
            CASE WHEN _doc_signed THEN now() ELSE NULL END,
            COALESCE(_metadata,'{}'::jsonb))
  RETURNING id INTO _id;

  IF _level = 1 THEN
    UPDATE public.aml_verifications SET status='approved', approved_at=now() WHERE id=_id;
  END IF;
  RETURN jsonb_build_object('ok',true,'id',_id,'auto_approved', _level=1);
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_aml(_id uuid, _action text, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _action NOT IN ('approve','reject') THEN RAISE EXCEPTION 'invalid_action'; END IF;
  UPDATE public.aml_verifications
    SET status = CASE WHEN _action='approve' THEN 'approved' ELSE 'rejected' END,
        approved_at = CASE WHEN _action='approve' THEN now() ELSE NULL END,
        approved_by = _uid,
        rejected_reason = CASE WHEN _action='reject' THEN _reason ELSE NULL END
    WHERE id = _id;
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _amount bigint, _method withdrawal_method,
  _bank_name text, _bank_account text,
  _coin_address text, _coin_network text, _pin text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _uid UUID := auth.uid();
  _tier public.user_tier;
  _pin_hash TEXT;
  _wallet public.wallet_balances%ROWTYPE;
  _today DATE := CURRENT_DATE;
  _wd_count INT;
  _min BIGINT;
  _process_by TIMESTAMPTZ;
  _tx_code TEXT;
  _gate jsonb;
  _required int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _pin IS NULL OR length(_pin) <> 6 THEN RAISE EXCEPTION 'invalid pin'; END IF;

  SELECT tier, withdraw_pin_hash INTO _tier, _pin_hash FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _pin_hash IS NULL THEN
    UPDATE public.profiles SET withdraw_pin_hash = encode(digest(_pin || _uid::text,'sha256'),'hex') WHERE id=_uid;
  ELSIF _pin_hash <> encode(digest(_pin || _uid::text,'sha256'),'hex') THEN
    RAISE EXCEPTION 'pin mismatch';
  END IF;

  _gate := public.aml_required_level(_uid, _amount);
  _required := (_gate->>'required_level')::int;
  IF (_gate->>'gate_passed')::boolean = false THEN
    RAISE EXCEPTION 'aml_required:%', _required;
  END IF;

  _min := public.tier_withdraw_min(_tier);
  IF _amount < _min THEN RAISE EXCEPTION 'below_min:%', _min; END IF;

  IF _tier = 'normal' THEN
    SELECT COUNT(*) INTO _wd_count FROM public.withdrawal_requests
      WHERE user_id=_uid AND created_at::date=_today AND status<>'rejected' AND status<>'cancelled';
    IF _wd_count >= 3 THEN RAISE EXCEPTION 'daily_withdraw_limit'; END IF;
  END IF;

  SELECT * INTO _wallet FROM public.wallet_balances WHERE user_id=_uid FOR UPDATE;
  IF _wallet.available_balance < _amount THEN RAISE EXCEPTION 'insufficient_funds'; END IF;

  UPDATE public.wallet_balances SET
    available_balance = available_balance - _amount,
    locked_balance = locked_balance + _amount,
    updated_at = now()
  WHERE user_id=_uid;

  UPDATE public.profiles
    SET total_withdrawn = COALESCE(total_withdrawn,0) + _amount,
        updated_at = now()
  WHERE id = _uid;

  _process_by := now() + (public.tier_process_minutes(_tier) || ' minutes')::interval;
  _tx_code := 'PM-' || upper(substr(md5(random()::text||_uid::text||now()::text),1,10));

  INSERT INTO public.withdrawal_requests(
    user_id, amount, method, bank_name, bank_account, coin_address, coin_network,
    tx_code, status, process_by
  ) VALUES (
    _uid, _amount, _method, _bank_name, _bank_account, _coin_address, _coin_network,
    _tx_code, 'pending', _process_by
  );

  RETURN jsonb_build_object('ok',true,'tx_code',_tx_code,'process_by',_process_by);
END $function$;

INSERT INTO public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note) VALUES
  ('_credit_referral_first_deposit','_invitee uuid','{}','referral','internal helper'),
  ('aml_required_level','_user_id uuid, _amount bigint','{authenticated}','aml','client preview'),
  ('deposit_bonus_pct','_method deposit_method','{authenticated}','deposit','pure helper'),
  ('submit_aml_verification','_level integer, _selfie_path text, _doc_signed boolean, _metadata jsonb','{authenticated}','aml','self-submit'),
  ('admin_resolve_aml','_id uuid, _action text, _reason text','{}','aml','admin only'),
  ('check_achievements','_user_id uuid','{authenticated}','achievement','self-scan'),
  ('get_weekly_referral_leaderboard','_limit integer','{authenticated}','referral','leaderboard'),
  ('get_my_weekly_referral_rank','','{authenticated}','referral','self rank')
ON CONFLICT DO NOTHING;

REVOKE ALL ON FUNCTION public._credit_referral_first_deposit(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_aml_verification(integer, text, boolean, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_resolve_aml(uuid, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_achievements(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.get_weekly_referral_leaderboard(integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.get_my_weekly_referral_rank() FROM public, anon;

GRANT EXECUTE ON FUNCTION public.submit_aml_verification(integer, text, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_achievements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_referral_leaderboard(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_weekly_referral_rank() TO authenticated;

INSERT INTO storage.buckets (id, name, public) VALUES ('aml','aml',false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='aml_self_upload') THEN
    EXECUTE $p$CREATE POLICY aml_self_upload ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id='aml' AND (storage.foldername(name))[1] = auth.uid()::text)$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='aml_self_select') THEN
    EXECUTE $p$CREATE POLICY aml_self_select ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id='aml' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')))$p$;
  END IF;
END $$;
