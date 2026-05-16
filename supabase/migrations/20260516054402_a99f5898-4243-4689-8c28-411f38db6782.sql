
CREATE TABLE IF NOT EXISTS public.crash_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed text NOT NULL,
  seed_hash text NOT NULL,
  seed_revealed boolean NOT NULL DEFAULT false,
  crash_multiplier numeric(8,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  pending_until timestamptz NOT NULL DEFAULT now() + interval '5 seconds',
  started_at timestamptz,
  crashed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crash_rounds_status ON public.crash_rounds(status);
CREATE INDEX IF NOT EXISTS idx_crash_rounds_created ON public.crash_rounds(created_at DESC);

CREATE TABLE IF NOT EXISTS public.crash_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.crash_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  bet_phon numeric NOT NULL CHECK (bet_phon > 0),
  auto_cashout numeric(8,2),
  cashed_out_at_multiplier numeric(8,2),
  payout_phon numeric NOT NULL DEFAULT 0,
  won boolean,
  bonus_mult numeric(4,2) NOT NULL DEFAULT 1.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_crash_bets_user ON public.crash_bets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crash_bets_round ON public.crash_bets(round_id);

CREATE TABLE IF NOT EXISTS public.crash_hot_streaks (
  user_id uuid PRIMARY KEY,
  streak int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crash_mission_claims (
  user_id uuid NOT NULL,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Seoul')::date,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.crash_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crash_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crash_hot_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crash_mission_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY crash_rounds_public_read ON public.crash_rounds FOR SELECT USING (true);
CREATE POLICY crash_rounds_admin_all ON public.crash_rounds FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY crash_bets_own_read ON public.crash_bets FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY crash_bets_admin_all ON public.crash_bets FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY crash_streaks_own_read ON public.crash_hot_streaks FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY crash_streaks_admin_all ON public.crash_hot_streaks FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY crash_mc_own_read ON public.crash_mission_claims FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY crash_mc_admin_all ON public.crash_mission_claims FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE OR REPLACE FUNCTION public._crash_vip_limits(_uid uuid)
RETURNS TABLE(tier text, max_bet numeric, bonus_mult numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_tier text := 'silver'; v_active boolean := false;
BEGIN
  SELECT (vp.active AND vp.expires_at > now()), vp.tier INTO v_active, v_tier
    FROM public.vip_passes vp WHERE vp.user_id = _uid;
  IF NOT COALESCE(v_active,false) THEN v_tier := 'silver'; END IF;
  RETURN QUERY SELECT
    v_tier,
    CASE v_tier WHEN 'diamond' THEN 2000000 WHEN 'platinum' THEN 500000 WHEN 'gold' THEN 200000 ELSE 50000 END::numeric,
    CASE v_tier WHEN 'diamond' THEN 1.10 WHEN 'platinum' THEN 1.05 WHEN 'gold' THEN 1.02 ELSE 1.00 END::numeric;
END;$$;

CREATE OR REPLACE FUNCTION public._crash_compute_multiplier(_seed text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_hash bytea := digest(_seed, 'sha256');
  v_int bigint;
  v_r numeric;
  v_m numeric;
BEGIN
  v_int := ('x' || substr(encode(v_hash,'hex'),1,13))::bit(52)::bigint;
  v_r := v_int::numeric / 4503599627370496.0;
  IF v_r < 0.03 THEN RETURN 1.00; END IF;
  v_m := floor((100.0 * 99.0) / (1.0 - v_r)) / 100.0;
  IF v_m < 1.01 THEN v_m := 1.01; END IF;
  IF v_m > 1000.0 THEN v_m := 1000.0; END IF;
  RETURN v_m;
END;$$;

CREATE OR REPLACE FUNCTION public.crash_tick_round()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_cur record; v_seed text; v_hash text; v_mult numeric; v_now timestamptz := now();
  v_elapsed_ms int; v_target_ms int; v_b record; v_payout numeric;
BEGIN
  SELECT * INTO v_cur FROM public.crash_rounds WHERE status <> 'crashed' ORDER BY created_at DESC LIMIT 1;
  IF v_cur.id IS NULL THEN
    v_seed := encode(gen_random_bytes(32), 'hex');
    v_hash := encode(digest(v_seed,'sha256'),'hex');
    v_mult := public._crash_compute_multiplier(v_seed);
    INSERT INTO public.crash_rounds(seed, seed_hash, crash_multiplier, status, pending_until)
      VALUES (v_seed, v_hash, v_mult, 'pending', v_now + interval '6 seconds');
    RETURN jsonb_build_object('action','created_pending');
  END IF;
  IF v_cur.status = 'pending' THEN
    IF v_cur.pending_until <= v_now THEN
      UPDATE public.crash_rounds SET status='running', started_at=v_now WHERE id=v_cur.id;
      RETURN jsonb_build_object('action','started','round',v_cur.id);
    END IF;
    RETURN jsonb_build_object('action','wait_pending');
  END IF;
  IF v_cur.status = 'running' THEN
    v_target_ms := (ln(v_cur.crash_multiplier)::numeric / 0.06 * 1000)::int;
    v_elapsed_ms := EXTRACT(EPOCH FROM (v_now - v_cur.started_at))::numeric * 1000;
    FOR v_b IN
      SELECT b.* FROM public.crash_bets b
      WHERE b.round_id = v_cur.id AND b.cashed_out_at_multiplier IS NULL AND b.auto_cashout IS NOT NULL
        AND b.auto_cashout <= LEAST(v_cur.crash_multiplier, exp(0.06 * v_elapsed_ms/1000.0))
    LOOP
      v_payout := round(v_b.bet_phon * v_b.auto_cashout * v_b.bonus_mult, 2);
      UPDATE public.crash_bets SET cashed_out_at_multiplier = v_b.auto_cashout, payout_phon = v_payout, won = true WHERE id = v_b.id;
      UPDATE public.phon_balances SET balance = balance + v_payout, updated_at = now() WHERE user_id = v_b.user_id;
      INSERT INTO public.phon_transactions(user_id, amount, kind, ref, meta)
        VALUES (v_b.user_id, v_payout, 'crash_cashout', v_cur.id::text,
                jsonb_build_object('mult', v_b.auto_cashout, 'bonus', v_b.bonus_mult, 'auto', true));
      INSERT INTO public.crash_hot_streaks(user_id, streak, updated_at) VALUES (v_b.user_id, 1, now())
        ON CONFLICT (user_id) DO UPDATE SET streak = crash_hot_streaks.streak + 1, updated_at = now();
    END LOOP;
    IF v_elapsed_ms >= v_target_ms THEN
      UPDATE public.crash_rounds SET status='crashed', crashed_at = v_now, seed_revealed = true WHERE id = v_cur.id;
      UPDATE public.crash_bets SET won = false WHERE round_id = v_cur.id AND cashed_out_at_multiplier IS NULL;
      UPDATE public.crash_hot_streaks SET streak = 0, updated_at = now()
        WHERE user_id IN (SELECT user_id FROM public.crash_bets WHERE round_id = v_cur.id AND won = false);
      RETURN jsonb_build_object('action','crashed','round',v_cur.id,'mult',v_cur.crash_multiplier);
    END IF;
    RETURN jsonb_build_object('action','running','elapsed_ms',v_elapsed_ms,'target_ms',v_target_ms);
  END IF;
  RETURN jsonb_build_object('action','noop');
END;$$;

CREATE OR REPLACE FUNCTION public.crash_place_bet(_bet_phon numeric, _auto_cashout numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_cur record; v_bal numeric; v_lim record;
  v_streak int := 0; v_streak_bonus numeric := 1.00; v_bonus numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _bet_phon IS NULL OR _bet_phon < 100 THEN RAISE EXCEPTION 'bet_too_small'; END IF;
  IF _auto_cashout IS NOT NULL AND _auto_cashout < 1.01 THEN RAISE EXCEPTION 'auto_cashout_invalid'; END IF;
  SELECT * INTO v_cur FROM public.crash_rounds WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1;
  IF v_cur.id IS NULL THEN RAISE EXCEPTION 'no_open_round'; END IF;
  SELECT * INTO v_lim FROM public._crash_vip_limits(v_uid);
  IF _bet_phon > v_lim.max_bet THEN RAISE EXCEPTION 'over_max_bet'; END IF;
  SELECT COALESCE(streak,0) INTO v_streak FROM public.crash_hot_streaks WHERE user_id = v_uid;
  IF v_streak >= 3 THEN v_streak_bonus := 1.05; END IF;
  v_bonus := round(v_lim.bonus_mult * v_streak_bonus, 2);
  SELECT balance INTO v_bal FROM public.phon_balances WHERE user_id = v_uid FOR UPDATE;
  IF COALESCE(v_bal,0) < _bet_phon THEN RAISE EXCEPTION 'insufficient_phon'; END IF;
  UPDATE public.phon_balances SET balance = balance - _bet_phon, updated_at = now() WHERE user_id = v_uid;
  INSERT INTO public.phon_transactions(user_id, amount, kind, ref, meta)
    VALUES (v_uid, -_bet_phon, 'crash_bet', v_cur.id::text, jsonb_build_object('auto', _auto_cashout, 'bonus', v_bonus));
  INSERT INTO public.crash_bets(round_id, user_id, bet_phon, auto_cashout, bonus_mult)
    VALUES (v_cur.id, v_uid, _bet_phon, _auto_cashout, v_bonus);
  RETURN jsonb_build_object('ok',true,'round_id',v_cur.id,'bonus_mult',v_bonus,'tier',v_lim.tier,'streak',v_streak);
END;$$;

CREATE OR REPLACE FUNCTION public.crash_cashout(_round_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_b record; v_r record;
  v_elapsed_ms int; v_now_mult numeric; v_effective numeric; v_payout numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO v_r FROM public.crash_rounds WHERE id = _round_id;
  IF v_r.id IS NULL OR v_r.status <> 'running' THEN RAISE EXCEPTION 'round_not_live'; END IF;
  SELECT * INTO v_b FROM public.crash_bets WHERE round_id = _round_id AND user_id = v_uid FOR UPDATE;
  IF v_b.id IS NULL THEN RAISE EXCEPTION 'no_bet'; END IF;
  IF v_b.cashed_out_at_multiplier IS NOT NULL THEN RAISE EXCEPTION 'already_cashed_out'; END IF;
  v_elapsed_ms := EXTRACT(EPOCH FROM (now() - v_r.started_at))::numeric * 1000;
  v_now_mult := LEAST(v_r.crash_multiplier, exp(0.06 * v_elapsed_ms/1000.0));
  IF v_now_mult < 1.01 THEN RAISE EXCEPTION 'too_early'; END IF;
  v_now_mult := round(v_now_mult, 2);
  v_effective := round(v_now_mult * v_b.bonus_mult, 2);
  v_payout := round(v_b.bet_phon * v_effective, 2);
  UPDATE public.crash_bets SET cashed_out_at_multiplier = v_now_mult, payout_phon = v_payout, won = true WHERE id = v_b.id;
  UPDATE public.phon_balances SET balance = balance + v_payout, updated_at = now() WHERE user_id = v_uid;
  INSERT INTO public.phon_transactions(user_id, amount, kind, ref, meta)
    VALUES (v_uid, v_payout, 'crash_cashout', v_r.id::text,
            jsonb_build_object('mult', v_now_mult, 'bonus', v_b.bonus_mult, 'effective', v_effective, 'auto', false));
  INSERT INTO public.crash_hot_streaks(user_id, streak, updated_at) VALUES (v_uid, 1, now())
    ON CONFLICT (user_id) DO UPDATE SET streak = crash_hot_streaks.streak + 1, updated_at = now();
  RETURN jsonb_build_object('ok',true,'mult',v_now_mult,'effective',v_effective,'payout',v_payout);
END;$$;

CREATE OR REPLACE FUNCTION public.crash_get_current_round()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_r record; v_count int; v_total numeric; v_last_crash numeric;
BEGIN
  SELECT * INTO v_r FROM public.crash_rounds WHERE status <> 'crashed' ORDER BY created_at DESC LIMIT 1;
  SELECT crash_multiplier INTO v_last_crash FROM public.crash_rounds WHERE status='crashed' ORDER BY crashed_at DESC LIMIT 1;
  IF v_r.id IS NULL THEN RETURN jsonb_build_object('status','none','last_crash',v_last_crash); END IF;
  SELECT count(*), COALESCE(sum(bet_phon),0) INTO v_count, v_total FROM public.crash_bets WHERE round_id = v_r.id;
  RETURN jsonb_build_object('id',v_r.id,'status',v_r.status,'seed_hash',v_r.seed_hash,
    'pending_until',v_r.pending_until,'started_at',v_r.started_at,
    'server_time',now(),'bet_count',v_count,'total_phon',v_total,'last_crash',v_last_crash);
END;$$;

CREATE OR REPLACE FUNCTION public.crash_get_recent_wins(_limit int DEFAULT 20)
RETURNS TABLE(nick text, avatar_id uuid, multiplier numeric, payout numeric, created_at timestamptz, round_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    CASE WHEN length(COALESCE(p.nickname,'')) >= 2
         THEN left(p.nickname,1) || repeat('*', greatest(length(p.nickname)-2,1)) || right(p.nickname,1)
         ELSE '익명' END,
    (SELECT avatar_id FROM public.user_avatars ua WHERE ua.user_id = b.user_id AND ua.equipped = true LIMIT 1),
    b.cashed_out_at_multiplier, b.payout_phon, b.created_at, b.round_id
  FROM public.crash_bets b
  LEFT JOIN public.profiles p ON p.id = b.user_id
  WHERE b.won = true AND b.payout_phon >= 5000
  ORDER BY b.created_at DESC
  LIMIT LEAST(GREATEST(_limit,1), 50);
$$;

CREATE OR REPLACE FUNCTION public.crash_get_live_bets(_round_id uuid)
RETURNS TABLE(nick text, avatar_id uuid, bet_phon numeric, cashed_at numeric, payout numeric, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    CASE WHEN length(COALESCE(p.nickname,'')) >= 2
         THEN left(p.nickname,1) || repeat('*', greatest(length(p.nickname)-2,1)) || right(p.nickname,1)
         ELSE '익명' END,
    (SELECT avatar_id FROM public.user_avatars ua WHERE ua.user_id = b.user_id AND ua.equipped = true LIMIT 1),
    b.bet_phon, b.cashed_out_at_multiplier, b.payout_phon,
    CASE WHEN b.won IS TRUE THEN 'won' WHEN b.won IS FALSE THEN 'lost' ELSE 'live' END
  FROM public.crash_bets b
  LEFT JOIN public.profiles p ON p.id = b.user_id
  WHERE b.round_id = _round_id
  ORDER BY b.bet_phon DESC
  LIMIT 30;
$$;

CREATE OR REPLACE FUNCTION public.crash_get_my_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_total int; v_wins int; v_best numeric; v_streak int; v_today_bets int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('total',0); END IF;
  SELECT count(*), count(*) FILTER (WHERE won), COALESCE(max(cashed_out_at_multiplier),0)
    INTO v_total, v_wins, v_best FROM public.crash_bets WHERE user_id = v_uid;
  SELECT COALESCE(streak,0) INTO v_streak FROM public.crash_hot_streaks WHERE user_id = v_uid;
  SELECT count(*) INTO v_today_bets FROM public.crash_bets
    WHERE user_id = v_uid AND created_at >= ((now() AT TIME ZONE 'Asia/Seoul')::date::timestamp AT TIME ZONE 'Asia/Seoul');
  RETURN jsonb_build_object('total',v_total,'wins',v_wins,'best_mult',v_best,'streak',v_streak,
    'today_bets',v_today_bets,'mission_ready', v_today_bets >= 3,
    'mission_claimed', EXISTS (SELECT 1 FROM public.crash_mission_claims
      WHERE user_id = v_uid AND day = (now() AT TIME ZONE 'Asia/Seoul')::date));
END;$$;

CREATE OR REPLACE FUNCTION public.crash_get_my_hot_streak()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_s int;
BEGIN
  SELECT COALESCE(streak,0) INTO v_s FROM public.crash_hot_streaks WHERE user_id = auth.uid();
  RETURN jsonb_build_object('streak', COALESCE(v_s,0), 'bonus_active', COALESCE(v_s,0) >= 3);
END;$$;

CREATE OR REPLACE FUNCTION public.claim_crash_mission_phon()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date; v_bets int; v_reward numeric := 150;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.crash_mission_claims WHERE user_id = v_uid AND day = v_today) THEN
    RAISE EXCEPTION 'already_claimed'; END IF;
  SELECT count(*) INTO v_bets FROM public.crash_bets
    WHERE user_id = v_uid AND created_at >= (v_today::timestamp AT TIME ZONE 'Asia/Seoul');
  IF v_bets < 3 THEN RAISE EXCEPTION 'need_3_plays'; END IF;
  INSERT INTO public.crash_mission_claims(user_id, day) VALUES (v_uid, v_today);
  INSERT INTO public.phon_balances(user_id, balance, updated_at) VALUES (v_uid, v_reward, now())
    ON CONFLICT (user_id) DO UPDATE SET balance = phon_balances.balance + v_reward, updated_at = now();
  INSERT INTO public.phon_transactions(user_id, amount, kind, ref, meta)
    VALUES (v_uid, v_reward, 'mission_crash_3', v_today::text, '{}'::jsonb);
  RETURN jsonb_build_object('ok',true,'reward',v_reward);
END;$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.crash_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crash_bets;

GRANT EXECUTE ON FUNCTION public.crash_place_bet(numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crash_cashout(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crash_get_current_round() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.crash_get_recent_wins(int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.crash_get_live_bets(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.crash_get_my_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crash_get_my_hot_streak() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_crash_mission_phon() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crash_tick_round() TO service_role;
