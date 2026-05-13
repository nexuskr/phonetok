-- ============== TABLES ==============
CREATE TABLE IF NOT EXISTS public.founding_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  total_seats int NOT NULL CHECK (total_seats > 0 AND total_seats <= 10000),
  perks jsonb NOT NULL DEFAULT '[]'::jsonb,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_founding_seasons_one_active
  ON public.founding_seasons(active) WHERE active = true;

ALTER TABLE public.founding_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fs_admin_all" ON public.founding_seasons
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
-- (no public SELECT — exposed via RPC)

CREATE TABLE IF NOT EXISTS public.founding_season_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.founding_seasons(id) ON DELETE CASCADE,
  seat_no int NOT NULL,
  claimed_by uuid,
  claimed_at timestamptz,
  display_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, seat_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fss_one_per_user_season
  ON public.founding_season_seats(season_id, claimed_by)
  WHERE claimed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fss_season_open
  ON public.founding_season_seats(season_id, seat_no)
  WHERE claimed_by IS NULL;

ALTER TABLE public.founding_season_seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fss_self_select" ON public.founding_season_seats
  FOR SELECT USING (claimed_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "fss_admin_all" ON public.founding_season_seats
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== RPCs ==============

-- helper: mask nickname
CREATE OR REPLACE FUNCTION public._mask_nick(_n text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT
    CASE
      WHEN _n IS NULL OR length(_n) = 0 THEN '익명'
      WHEN length(_n) <= 2 THEN LEFT(_n,1) || '*'
      ELSE LEFT(_n,1) || repeat('*', GREATEST(2, length(_n)-2)) || RIGHT(_n,1)
    END;
$$;

-- get current season state
CREATE OR REPLACE FUNCTION public.get_founding_season_state()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_s public.founding_seasons;
  v_remaining int;
  v_total int;
  v_recent jsonb;
BEGIN
  SELECT * INTO v_s FROM public.founding_seasons WHERE active = true LIMIT 1;
  IF v_s.id IS NULL THEN
    RETURN jsonb_build_object('active', false);
  END IF;

  SELECT count(*) FILTER (WHERE claimed_by IS NULL),
         count(*)
    INTO v_remaining, v_total
  FROM public.founding_season_seats WHERE season_id = v_s.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'seat_no', s.seat_no,
    'masked_nick', public._mask_nick(p.nickname),
    'claimed_at', s.claimed_at
  ) ORDER BY s.claimed_at DESC), '[]'::jsonb)
    INTO v_recent
  FROM (
    SELECT seat_no, claimed_at, claimed_by
    FROM public.founding_season_seats
    WHERE season_id = v_s.id AND claimed_by IS NOT NULL
    ORDER BY claimed_at DESC
    LIMIT 5
  ) s
  LEFT JOIN public.profiles p ON p.id = s.claimed_by;

  RETURN jsonb_build_object(
    'active', true,
    'season', jsonb_build_object(
      'id', v_s.id, 'code', v_s.code, 'title', v_s.title, 'subtitle', v_s.subtitle,
      'total_seats', v_s.total_seats, 'perks', v_s.perks,
      'starts_at', v_s.starts_at, 'ends_at', v_s.ends_at
    ),
    'total', v_total,
    'remaining', v_remaining,
    'claimed', v_total - v_remaining,
    'recent', v_recent
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_founding_season_state() TO anon, authenticated;

-- get full grid (masked)
CREATE OR REPLACE FUNCTION public.get_founding_season_grid(_season_id uuid DEFAULT NULL)
RETURNS TABLE (seat_no int, masked_nick text, claimed_at timestamptz, is_mine boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid := _season_id;
BEGIN
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.founding_seasons WHERE active = true LIMIT 1;
  END IF;
  IF v_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    s.seat_no,
    CASE WHEN s.claimed_by IS NULL THEN NULL ELSE public._mask_nick(p.nickname) END AS masked_nick,
    s.claimed_at,
    (s.claimed_by IS NOT NULL AND s.claimed_by = auth.uid()) AS is_mine
  FROM public.founding_season_seats s
  LEFT JOIN public.profiles p ON p.id = s.claimed_by
  WHERE s.season_id = v_id
  ORDER BY s.seat_no;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_founding_season_grid(uuid) TO anon, authenticated;

-- claim a seat
CREATE OR REPLACE FUNCTION public.claim_founding_season_seat()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_season public.founding_seasons;
  v_god_count int;
  v_existing int;
  v_nick text;
  v_seat_no int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT * INTO v_season FROM public.founding_seasons WHERE active = true LIMIT 1;
  IF v_season.id IS NULL THEN RAISE EXCEPTION 'no_active_season'; END IF;
  IF v_season.ends_at IS NOT NULL AND v_season.ends_at < now() THEN
    RAISE EXCEPTION 'season_ended';
  END IF;

  -- gate: must have first deposit godmode
  SELECT count(*) INTO v_god_count
  FROM public.first_deposit_godmode WHERE user_id = v_uid;
  IF v_god_count = 0 THEN RAISE EXCEPTION 'godmode_required'; END IF;

  -- already claimed?
  SELECT count(*) INTO v_existing
  FROM public.founding_season_seats
  WHERE season_id = v_season.id AND claimed_by = v_uid;
  IF v_existing > 0 THEN RAISE EXCEPTION 'already_claimed'; END IF;

  SELECT nickname INTO v_nick FROM public.profiles WHERE id = v_uid;

  -- atomic claim: lowest open seat
  WITH next_seat AS (
    SELECT seat_no
    FROM public.founding_season_seats
    WHERE season_id = v_season.id AND claimed_by IS NULL
    ORDER BY seat_no
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.founding_season_seats s
  SET claimed_by = v_uid,
      claimed_at = now(),
      display_label = COALESCE(v_nick, '익명')
  FROM next_seat
  WHERE s.season_id = v_season.id AND s.seat_no = next_seat.seat_no
  RETURNING s.seat_no INTO v_seat_no;

  IF v_seat_no IS NULL THEN RAISE EXCEPTION 'season_full'; END IF;

  RETURN jsonb_build_object(
    'season_id', v_season.id,
    'season_code', v_season.code,
    'seat_no', v_seat_no,
    'claimed_at', now()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.claim_founding_season_seat() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_founding_season_seat() TO authenticated;

-- admin: create new season
CREATE OR REPLACE FUNCTION public.admin_create_founding_season(
  _code text, _title text, _subtitle text, _total int, _perks jsonb, _ends_at timestamptz
)
RETURNS public.founding_seasons
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.founding_seasons;
  i int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'admin_only'; END IF;
  IF _total IS NULL OR _total < 1 OR _total > 10000 THEN RAISE EXCEPTION 'bad_total'; END IF;

  -- deactivate existing
  UPDATE public.founding_seasons SET active = false WHERE active = true;

  INSERT INTO public.founding_seasons(code, title, subtitle, total_seats, perks, ends_at, active)
  VALUES (_code, _title, _subtitle, _total, COALESCE(_perks,'[]'::jsonb), _ends_at, true)
  RETURNING * INTO v_row;

  -- pre-create empty seats
  FOR i IN 1.._total LOOP
    INSERT INTO public.founding_season_seats(season_id, seat_no) VALUES (v_row.id, i);
  END LOOP;

  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_founding_season(text,text,text,int,jsonb,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_founding_season(text,text,text,int,jsonb,timestamptz) TO authenticated;

-- ============== SEED: S1 ==============
DO $$
DECLARE
  v_id uuid;
  i int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.founding_seasons WHERE code = 'S1_FOUNDING_EMPEROR') THEN
    INSERT INTO public.founding_seasons(code, title, subtitle, total_seats, perks, active)
    VALUES (
      'S1_FOUNDING_EMPEROR',
      'S1 — Founding Emperor',
      '제국 1세대 황제 100석. 영구 명예의 전당.',
      100,
      jsonb_build_array(
        '평생 수수료 -50% 영구 적용',
        '모든 Crown 보상 ×2',
        '명예의 전당 영구 등재',
        'Phonara 한정판 NFT 시즌1 발급'
      ),
      true
    )
    RETURNING id INTO v_id;

    -- deactivate any other active seasons (safety, although unique idx enforces)
    UPDATE public.founding_seasons SET active = false WHERE id <> v_id AND active = true;

    FOR i IN 1..100 LOOP
      INSERT INTO public.founding_season_seats(season_id, seat_no) VALUES (v_id, i);
    END LOOP;
  END IF;
END $$;

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.founding_season_seats;