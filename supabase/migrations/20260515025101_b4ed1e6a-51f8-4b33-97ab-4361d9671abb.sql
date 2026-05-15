CREATE OR REPLACE FUNCTION public.assign_persona()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _bd DATE;
  _age INT;
  _persona TEXT;
  _is_freelancer BOOLEAN := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT birth_date INTO _bd FROM public.profiles WHERE id = _uid;

  IF _bd IS NULL THEN
    _persona := 'gen30';
  ELSE
    _age := DATE_PART('year', age(_bd));
    IF _age < 30 THEN _persona := 'gen20';
    ELSIF _age < 40 THEN _persona := 'gen30';
    ELSIF _age < 50 THEN _persona := 'gen40';
    ELSIF _age < 60 THEN _persona := 'gen5060';
    ELSE _persona := 'gen6070';
    END IF;
  END IF;

  SELECT (COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 22 OR EXTRACT(HOUR FROM created_at) < 6)::FLOAT
          / NULLIF(COUNT(*),0)) > 0.3
    INTO _is_freelancer
  FROM public.mission_history
  WHERE user_id = _uid AND created_at > now() - INTERVAL '14 days';

  IF _is_freelancer THEN _persona := 'freelancer'; END IF;

  UPDATE public.profiles SET persona = _persona WHERE id = _uid;
  RETURN _persona;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_recommended_missions()
RETURNS TABLE(mission_id TEXT, priority SMALLINT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _persona TEXT;
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  SELECT persona INTO _persona FROM public.profiles WHERE id = _uid;
  IF _persona IS NULL THEN _persona := 'gen30'; END IF;

  RETURN QUERY
    SELECT mp.mission_id, mp.priority
    FROM public.mission_personas mp
    WHERE mp.persona = _persona
    ORDER BY mp.priority DESC;
END;
$$;