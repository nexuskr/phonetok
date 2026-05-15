CREATE OR REPLACE FUNCTION public.list_public_function_names()
RETURNS TABLE(proname text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT DISTINCT p.proname::text
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  ORDER BY 1;
$$;

REVOKE ALL ON FUNCTION public.list_public_function_names() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_function_names() TO service_role;

NOTIFY pgrst, 'reload schema';