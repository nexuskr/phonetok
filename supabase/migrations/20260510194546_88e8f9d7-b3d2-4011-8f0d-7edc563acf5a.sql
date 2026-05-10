
-- Phase 1: 19+ legal safety
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_adult boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.enforce_adult_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_age int;
BEGIN
  IF NEW.birth_date IS NOT NULL THEN
    v_age := date_part('year', age(CURRENT_DATE, NEW.birth_date))::int;
    IF v_age < 19 THEN
      RAISE EXCEPTION '만 19세 미만은 이용할 수 없습니다.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.is_adult := true;
  ELSE
    NEW.is_adult := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_adult_only ON public.profiles;
CREATE TRIGGER trg_enforce_adult_only
  BEFORE INSERT OR UPDATE OF birth_date ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_adult_only();

-- backfill is_adult for existing rows with birth_date
UPDATE public.profiles
SET is_adult = (date_part('year', age(CURRENT_DATE, birth_date))::int >= 19)
WHERE birth_date IS NOT NULL AND is_adult = false;
