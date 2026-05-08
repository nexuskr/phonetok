
-- ============ 1. RANK SNAPSHOTS ============
CREATE TABLE IF NOT EXISTS public.weekly_leaderboard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_week text NOT NULL,
  user_id uuid NOT NULL,
  rank int NOT NULL,
  score bigint NOT NULL DEFAULT 0,
  taken_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(iso_week, user_id, taken_at)
);
CREATE INDEX IF NOT EXISTS idx_wls_lookup ON public.weekly_leaderboard_snapshots(iso_week, user_id, taken_at DESC);
ALTER TABLE public.weekly_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wls_self_select ON public.weekly_leaderboard_snapshots;
CREATE POLICY wls_self_select ON public.weekly_leaderboard_snapshots FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Detect rank changes and emit notifications
CREATE OR REPLACE FUNCTION public.tick_weekly_leaderboard_ranks()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _wk text := to_char(now(),'IYYY-IW');
  _r record;
  _prev int;
  _changed int := 0;
BEGIN
  FOR _r IN
    SELECT inviter_id AS user_id,
           COALESCE(SUM(commission),0) AS score,
           ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(commission),0) DESC, COUNT(*) DESC) AS rank
    FROM public.referral_earnings
    WHERE created_at >= date_trunc('week', now())
    GROUP BY inviter_id
    LIMIT 20
  LOOP
    SELECT rank INTO _prev
      FROM public.weekly_leaderboard_snapshots
      WHERE iso_week=_wk AND user_id=_r.user_id
      ORDER BY taken_at DESC LIMIT 1;

    IF _prev IS NULL OR _prev <> _r.rank THEN
      INSERT INTO public.weekly_leaderboard_snapshots(iso_week,user_id,rank,score)
        VALUES(_wk,_r.user_id,_r.rank,_r.score);
      _changed := _changed + 1;

      IF _prev IS NULL AND _r.rank <= 10 THEN
        PERFORM public.notify_user(_r.user_id,'rank_change',
          '🎯 리더보드 진입 · ' || _r.rank || '위',
          '주간 추천 TOP 10 진입! 보상권 안에 있어요.',
          jsonb_build_object('rank',_r.rank,'prev',NULL,'iso_week',_wk));
      ELSIF _prev IS NOT NULL AND _r.rank < _prev THEN
        PERFORM public.notify_user(_r.user_id,'rank_change',
          '⬆️ 순위 상승 ' || _prev || '→' || _r.rank,
          CASE WHEN _r.rank<=3 THEN '상위 3위 진입! 자동 정산 대기열에 등록됨.'
               WHEN _r.rank<=10 THEN '상위 10위 진입!' ELSE '순위 상승 중' END,
          jsonb_build_object('rank',_r.rank,'prev',_prev,'iso_week',_wk));
      ELSIF _prev IS NOT NULL AND _r.rank > _prev AND _prev <= 3 AND _r.rank > 3 THEN
        PERFORM public.notify_user(_r.user_id,'rank_change',
          '⚠️ TOP 3 이탈 · 현재 ' || _r.rank || '위',
          '주간 마감까지 회복하세요!',
          jsonb_build_object('rank',_r.rank,'prev',_prev,'iso_week',_wk));
      END IF;
    END IF;
  END LOOP;

  -- prune old (>14 days)
  DELETE FROM public.weekly_leaderboard_snapshots WHERE taken_at < now() - interval '14 days';
  RETURN jsonb_build_object('ok',true,'changed',_changed,'iso_week',_wk);
END $$;
REVOKE ALL ON FUNCTION public.tick_weekly_leaderboard_ranks() FROM public, anon, authenticated;

-- ============ 2. WEEKLY PASS FINALIZE ============
CREATE OR REPLACE FUNCTION public.finalize_weekly_pass()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _last_wk text := to_char(now() - interval '1 day','IYYY-IW');
  _r record; _notified int := 0;
BEGIN
  FOR _r IN
    SELECT wpp.user_id, wpp.level, wpp.claimed_levels
    FROM public.weekly_pass_progress wpp
    WHERE wpp.iso_week = _last_wk
  LOOP
    PERFORM public.notify_user(_r.user_id,'weekly_pass_end',
      '⏰ 주간패스 마감',
      '도달 Lv ' || _r.level || ' · 다음 주가 시작됩니다.',
      jsonb_build_object('iso_week',_last_wk,'final_level',_r.level));
    _notified := _notified + 1;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'notified',_notified,'iso_week',_last_wk);
END $$;
REVOKE ALL ON FUNCTION public.finalize_weekly_pass() FROM public, anon, authenticated;

-- ============ 3. AI MISSION PARTIAL APPROVE ============
CREATE OR REPLACE FUNCTION public.admin_resolve_ai_mission(_id uuid, _action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _row public.ai_generated_missions%ROWTYPE; _new_credit bigint;
BEGIN
  IF NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _action NOT IN ('approve','reject','partial') THEN RAISE EXCEPTION 'invalid_action'; END IF;
  SELECT * INTO _row FROM public.ai_generated_missions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  IF _action='reject' THEN
    UPDATE public.ai_generated_missions SET status='rejected', approved_by_admin=_uid WHERE id=_id;
    RETURN jsonb_build_object('ok',true,'action','reject');
  END IF;

  _new_credit := CASE WHEN _action='partial' THEN (_row.reward_credit / 2) ELSE _row.reward_credit END;
  UPDATE public.ai_generated_missions
    SET status='approved', approved_by_admin=_uid, reward_credit=_new_credit
    WHERE id=_id;
  PERFORM public.notify_user(_row.user_id,'ai_mission_approved',
    CASE WHEN _action='partial' THEN '✓ 부분 승인 (50%)' ELSE '✓ 미션 승인' END,
    '보상 ₩' || _new_credit::text || ' · 청구 가능',
    jsonb_build_object('mission_id',_id,'partial', _action='partial'));
  RETURN jsonb_build_object('ok',true,'action',_action,'credit',_new_credit);
END $$;
REVOKE ALL ON FUNCTION public.admin_resolve_ai_mission(uuid,text) FROM public, anon, authenticated;

-- ============ 4. PERMISSION BASELINE ============
INSERT INTO public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note) VALUES
  ('tick_weekly_leaderboard_ranks','','{}','referral','cron only — emits rank-change notifications'),
  ('finalize_weekly_pass','','{}','weekly_pass','cron only — Monday 00:05')
ON CONFLICT (function_name, function_args) DO UPDATE SET
  allowed_roles=EXCLUDED.allowed_roles, category=EXCLUDED.category, note=EXCLUDED.note, updated_at=now();

-- ============ 5. CRON SCHEDULES ============
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- safe re-schedule helper
DO $$
DECLARE _jobs text[] := ARRAY['weekly-leaderboard-payout','weekly-pass-finalize','leaderboard-rank-tick'];
        _j text;
BEGIN
  FOREACH _j IN ARRAY _jobs LOOP
    PERFORM cron.unschedule(_j) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname=_j);
  END LOOP;
END $$;

SELECT cron.schedule(
  'weekly-leaderboard-payout', '0 0 * * 1',
  $$ SELECT public.pay_weekly_leaderboard(); $$
);

SELECT cron.schedule(
  'weekly-pass-finalize', '5 0 * * 1',
  $$ SELECT public.finalize_weekly_pass(); $$
);

SELECT cron.schedule(
  'leaderboard-rank-tick', '*/5 * * * *',
  $$ SELECT public.tick_weekly_leaderboard_ranks(); $$
);
