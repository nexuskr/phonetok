CREATE OR REPLACE FUNCTION public.get_my_journey_progress()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _phon numeric := 0;
  _empire_level int := 1;
  _has_profile boolean := false;
  _approved_pkg int := 0;
  _cosmos_pkg int := 0;
  _trade_count int := 0;
  _spin_count int := 0;
  _mission_count int := 0;
  _attendance int := 0;
  _nft_count int := 0;
  _has_seat boolean := false;
  _step1 int := 0; _step2 int := 0; _step3 int := 0; _step4 int := 0; _step5 int := 0;
  _current_act int := 1;
  _act_name text := '지구';
  _act_emoji text := '🌍';
  _next_title text := '시작하기';
  _next_sub text := '회원가입을 완료하세요';
  _next_cta_label text := '시작';
  _next_cta_href text := '/auth';
  _next_icon text := 'rocket';
  _next_progress text := NULL;
  _total int;
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  SELECT TRUE, COALESCE(empire_level, 1), COALESCE(attendance_streak, 0)
    INTO _has_profile, _empire_level, _attendance
    FROM profiles WHERE id = _uid;

  SELECT COALESCE(balance, 0) INTO _phon FROM phon_balances WHERE user_id = _uid;

  SELECT COUNT(*) INTO _approved_pkg FROM package_purchases
    WHERE user_id = _uid AND status IN ('approved', 'completed');
  SELECT COUNT(*) INTO _cosmos_pkg FROM package_purchases
    WHERE user_id = _uid AND status IN ('approved', 'completed')
      AND package_id LIKE 'cosmos_%';

  SELECT COUNT(*) INTO _trade_count FROM live_trade_history WHERE user_id = _uid;
  SELECT COUNT(*) INTO _spin_count FROM roulette_spins WHERE user_id = _uid;
  SELECT COUNT(*) INTO _mission_count FROM mission_history WHERE user_id = _uid;
  SELECT COUNT(*) INTO _nft_count FROM nft_collection WHERE user_id = _uid;
  SELECT EXISTS(SELECT 1 FROM founding_season_seats WHERE claimed_by = _uid) INTO _has_seat;

  _step1 := LEAST(10,
      (CASE WHEN _has_profile THEN 1 ELSE 0 END)
    + (CASE WHEN _approved_pkg >= 1 THEN 5 ELSE 0 END)
    + LEAST(4, FLOOR(_phon / 25))::int
  );
  _step2 := LEAST(15, _trade_count);
  _step3 := LEAST(20,
      LEAST(8, _spin_count)
    + LEAST(7, _mission_count)
    + LEAST(5, _attendance)
  );
  _step4 := LEAST(15,
      LEAST(5, _nft_count * 2)
    + LEAST(5, GREATEST(0, _empire_level - 1))
    + (CASE WHEN _phon >= 500 THEN 5 WHEN _phon >= 100 THEN 2 ELSE 0 END)
  );
  _step5 := LEAST(15, _cosmos_pkg * 5);
  _total := _step1 + _step2 + _step3 + _step4 + _step5;

  IF _step1 < 10 THEN
    _current_act := 1; _act_name := '지구'; _act_emoji := '🌍';
    IF _approved_pkg = 0 THEN
      _next_title := '첫 입금으로 항해 시작';
      _next_sub := 'Cosmos 패키지로 PHON +10% 보너스 즉시 지급';
      _next_cta_label := '지금 입금하기';
      _next_cta_href := '/packages?focus=cosmos_earth';
      _next_icon := 'rocket';
    ELSE
      _next_title := 'PHON 모으기';
      _next_sub := 'PHON 100 도달 시 지구 단계 완성';
      _next_progress := 'PHON ' || GREATEST(0, 100 - FLOOR(_phon)::int)::text || ' 남음';
      _next_cta_label := 'PHON 가이드';
      _next_cta_href := '/guide/phon';
      _next_icon := 'coin';
    END IF;
  ELSIF _step2 < 15 THEN
    _current_act := 2; _act_name := '대기권'; _act_emoji := '🚀';
    _next_title := '트레이딩 ' || GREATEST(0, 15 - _trade_count)::text || '회 더';
    _next_sub := 'BTCUSDT Long/Short 베팅으로 대기권 돌파';
    _next_progress := '거래 ' || GREATEST(0, 15 - _trade_count)::text || '회 남음';
    _next_cta_label := '베팅 시작';
    _next_cta_href := '/dashboard?focus=bet';
    _next_icon := 'trade';
  ELSIF _step3 < 20 THEN
    _current_act := 3; _act_name := '궤도 진입'; _act_emoji := '🛰️';
    IF _spin_count < 8 THEN
      _next_title := '룰렛 ' || (8 - _spin_count)::text || '회 더';
      _next_sub := '오늘의 행운을 시험하세요';
      _next_progress := '스핀 ' || (8 - _spin_count)::text || '회 남음';
      _next_cta_label := '룰렛 돌리기';
      _next_cta_href := '/roulette';
      _next_icon := 'sparkles';
    ELSIF _attendance < 5 THEN
      _next_title := '출석 ' || (5 - _attendance)::text || '일 더';
      _next_sub := '연속 출석으로 궤도에 안착';
      _next_progress := '출석 ' || (5 - _attendance)::text || '일 남음';
      _next_cta_label := '오늘 출석';
      _next_cta_href := '/missions';
      _next_icon := 'flame';
    ELSE
      _next_title := '미션 ' || GREATEST(0, 7 - _mission_count)::text || '개 더';
      _next_sub := '데일리 미션으로 보상 수확';
      _next_progress := '미션 ' || GREATEST(0, 7 - _mission_count)::text || '개 남음';
      _next_cta_label := '미션 보기';
      _next_cta_href := '/missions';
      _next_icon := 'check';
    END IF;
  ELSIF _step4 < 15 THEN
    _current_act := 4; _act_name := '달'; _act_emoji := '🌙';
    IF _nft_count = 0 THEN
      _next_title := '첫 NFT 획득';
      _next_sub := '입금 누적 시 Bronze Crown 자동 발급';
      _next_cta_label := 'NFT 컬렉션 보기';
      _next_cta_href := '/empire/collection';
      _next_icon := 'crown';
    ELSE
      _next_title := 'Empire Tier 상승';
      _next_sub := 'Crown을 모아 다음 등급으로 도약';
      _next_progress := 'Tier ' || _empire_level::text || ' / 10';
      _next_cta_label := '제국 보기';
      _next_cta_href := '/empire';
      _next_icon := 'crown';
    END IF;
  ELSIF _step5 < 15 THEN
    _current_act := 5; _act_name := '화성'; _act_emoji := '🪐';
    _next_title := 'Cosmos 패키지 활성';
    _next_sub := 'Mars Colony로 레버리지 25× 잠금해제';
    _next_cta_label := '패키지 보기';
    _next_cta_href := '/packages?focus=cosmos_mars';
    _next_icon := 'rocket';
  ELSIF _empire_level < 7 THEN
    _current_act := 6; _act_name := '태양계'; _act_emoji := '☀️';
    _next_title := 'Baron(Empire 7) 도달';
    _next_sub := '태양계 잠금해제까지 Crown 누적 필요';
    _next_progress := 'Tier ' || _empire_level::text || ' → 7';
    _next_cta_label := '제국 보기';
    _next_cta_href := '/empire';
    _next_icon := 'sun';
  ELSIF NOT _has_seat THEN
    _current_act := 7; _act_name := '우주 황제'; _act_emoji := '👑';
    _next_title := 'Founding Seat 획득';
    _next_sub := '시즌 좌석으로 영구 황제 등극';
    _next_cta_label := '좌석 보기';
    _next_cta_href := '/empire';
    _next_icon := 'crown';
  ELSE
    _current_act := 7; _act_name := '우주 황제'; _act_emoji := '👑';
    _next_title := '✨ 황제 등극 완료';
    _next_sub := '제국은 이미 너의 것이다';
    _next_cta_label := '제국 보기';
    _next_cta_href := '/empire';
    _next_icon := 'crown';
  END IF;

  _result := jsonb_build_object(
    'current_step', _total + (CASE WHEN _empire_level >= 7 THEN 15 ELSE 0 END) + (CASE WHEN _has_seat THEN 10 ELSE 0 END),
    'total_steps', 100,
    'current_act', _current_act,
    'act_name', _act_name,
    'act_emoji', _act_emoji,
    'next_action', jsonb_build_object(
      'title', _next_title,
      'sub', _next_sub,
      'cta_label', _next_cta_label,
      'cta_href', _next_cta_href,
      'icon_key', _next_icon,
      'progress_hint', _next_progress
    ),
    'acts', jsonb_build_array(
      jsonb_build_object('id',1,'name','지구','emoji','🌍','locked',false,'completed_steps',_step1,'total_steps',10),
      jsonb_build_object('id',2,'name','대기권','emoji','🚀','locked',false,'completed_steps',_step2,'total_steps',15),
      jsonb_build_object('id',3,'name','궤도','emoji','🛰️','locked',false,'completed_steps',_step3,'total_steps',20),
      jsonb_build_object('id',4,'name','달','emoji','🌙','locked',false,'completed_steps',_step4,'total_steps',15),
      jsonb_build_object('id',5,'name','화성','emoji','🪐','locked',false,'completed_steps',_step5,'total_steps',15),
      jsonb_build_object('id',6,'name','태양계','emoji','☀️','locked',_empire_level < 7,'unlock_hint','Baron(Empire 7) 도달 시 잠금해제','completed_steps',CASE WHEN _empire_level >= 7 THEN 15 ELSE 0 END,'total_steps',15),
      jsonb_build_object('id',7,'name','우주 황제','emoji','👑','locked',NOT _has_seat,'unlock_hint','Founding Seat 보유 시 잠금해제','completed_steps',CASE WHEN _has_seat THEN 10 ELSE 0 END,'total_steps',10)
    )
  );

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_journey_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_journey_progress() TO authenticated;

INSERT INTO public.function_permissions_baseline(function_name, function_args, allowed_roles, category, note)
VALUES ('get_my_journey_progress', '', ARRAY['authenticated']::text[], 'journey', 'Imperial Journey Map — read-only progress aggregator')
ON CONFLICT (function_name, function_args) DO UPDATE
  SET allowed_roles = EXCLUDED.allowed_roles,
      category = EXCLUDED.category,
      note = EXCLUDED.note,
      updated_at = now();