
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tos_version text;

UPDATE public.profiles SET tos_version = '2026-05-11' WHERE tos_version IS NULL;

CREATE OR REPLACE FUNCTION public.current_tos_version()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT '2026-05-11'::text $$;
