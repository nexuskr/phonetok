
CREATE TABLE IF NOT EXISTS public.daily_briefings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  briefing_date DATE NOT NULL,
  cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  refreshed_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, briefing_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_briefings_user_date ON public.daily_briefings(user_id, briefing_date DESC);

ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_briefings self read" ON public.daily_briefings;
CREATE POLICY "daily_briefings self read"
  ON public.daily_briefings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.get_my_daily_briefing()
RETURNS TABLE(briefing_date DATE, cards JSONB, model TEXT, generated_at TIMESTAMPTZ, refreshed_count INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT briefing_date, cards, model, generated_at, refreshed_count
  FROM public.daily_briefings
  WHERE user_id = auth.uid()
    AND briefing_date = (now() AT TIME ZONE 'Asia/Seoul')::date
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.request_my_briefing_context()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_phon NUMERIC := 0;
  v_level INTEGER := 1;
  v_crown_24h INTEGER := 0;
  v_jackpot_24h INTEGER := 0;
  v_nick TEXT;
  v_last RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT COALESCE(p.balance,0) INTO v_phon FROM public.phon_balances p WHERE p.user_id = v_uid;
  SELECT pr.nickname, COALESCE(pr.empire_level,1)
    INTO v_nick, v_level
    FROM public.profiles pr
    WHERE pr.id = v_uid;
  SELECT COUNT(*) INTO v_crown_24h FROM public.crown_events
    WHERE user_id = v_uid AND created_at > now() - interval '24 hours';
  SELECT COUNT(*) INTO v_jackpot_24h FROM public.crown_events
    WHERE user_id = v_uid AND created_at > now() - interval '24 hours' AND COALESCE((meta->>'rpe')::numeric,0) >= 0.8;
  SELECT generated_at, refreshed_count INTO v_last
    FROM public.daily_briefings
    WHERE user_id = v_uid AND briefing_date = (now() AT TIME ZONE 'Asia/Seoul')::date
    LIMIT 1;
  IF v_last.generated_at IS NOT NULL AND v_last.generated_at > now() - interval '1 hour' AND COALESCE(v_last.refreshed_count,0) >= 3 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  RETURN jsonb_build_object(
    'user_id', v_uid,
    'nickname', COALESCE(v_nick, 'Emperor'),
    'locale', 'ko',
    'phon', v_phon,
    'level', v_level,
    'crown_24h', v_crown_24h,
    'jackpot_24h', v_jackpot_24h
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_briefing_targets(_limit INTEGER DEFAULT 200)
RETURNS TABLE(user_id UUID, nickname TEXT, phon NUMERIC, level INTEGER, crown_24h INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pr.id, pr.nickname,
         COALESCE(pb.balance,0), COALESCE(pr.empire_level,1),
         (SELECT COUNT(*)::INTEGER FROM public.crown_events ce
            WHERE ce.user_id = pr.id AND ce.created_at > now() - interval '24 hours')
  FROM public.profiles pr
  LEFT JOIN public.phon_balances pb ON pb.user_id = pr.id
  WHERE public.has_role(auth.uid(),'admin')
    AND EXISTS (
      SELECT 1 FROM public.crown_events ce2
      WHERE ce2.user_id = pr.id AND ce2.created_at > now() - interval '7 days'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.daily_briefings db
      WHERE db.user_id = pr.id
        AND db.briefing_date = (now() AT TIME ZONE 'Asia/Seoul')::date
    )
  ORDER BY pr.updated_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(1000, _limit));
$$;

CREATE OR REPLACE FUNCTION public.upsert_daily_briefing(_user_id UUID, _cards JSONB, _model TEXT, _context JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id BIGINT;
BEGIN
  INSERT INTO public.daily_briefings(user_id, briefing_date, cards, model, context)
  VALUES (_user_id, (now() AT TIME ZONE 'Asia/Seoul')::date, _cards, _model, COALESCE(_context,'{}'::jsonb))
  ON CONFLICT (user_id, briefing_date) DO UPDATE
    SET cards = EXCLUDED.cards,
        model = EXCLUDED.model,
        context = EXCLUDED.context,
        generated_at = now(),
        refreshed_count = public.daily_briefings.refreshed_count + 1
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.upsert_daily_briefing(UUID, JSONB, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

INSERT INTO public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note) VALUES
  ('get_my_daily_briefing',         '',                              ARRAY['authenticated']::text[], 'user', 'Daily AI briefing read'),
  ('request_my_briefing_context',   '',                              ARRAY['authenticated']::text[], 'user', 'Throttled context bundle for edge call'),
  ('admin_list_briefing_targets',   'integer',                       ARRAY['authenticated']::text[], 'admin', 'Active users needing daily briefing'),
  ('upsert_daily_briefing',         'uuid, jsonb, text, jsonb',      ARRAY['service_role']::text[],  'internal', 'Edge function upsert (service-role only)')
ON CONFLICT (function_name, function_args) DO UPDATE
  SET allowed_roles = EXCLUDED.allowed_roles, category = EXCLUDED.category, note = EXCLUDED.note;
