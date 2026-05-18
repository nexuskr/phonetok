
-- 1) dynasty_links: hide child_email from parent direct SELECT; only child + admin can read base table
DROP POLICY IF EXISTS dynasty_self_select ON public.dynasty_links;
CREATE POLICY dynasty_self_select ON public.dynasty_links
  FOR SELECT TO authenticated
  USING (child_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));

-- Mask child_email for parent role in the helper RPC
CREATE OR REPLACE FUNCTION public.get_my_dynasty_links()
RETURNS TABLE(id uuid, role text, parent_id uuid, child_id uuid, child_email text, status text, created_at timestamptz, accepted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id,
    CASE WHEN parent_id = auth.uid() THEN 'parent' ELSE 'child' END AS role,
    parent_id, child_id,
    CASE
      WHEN child_id = auth.uid() THEN child_email
      WHEN parent_id = auth.uid() THEN
        regexp_replace(child_email, '(^.).*(@.*$)', '\1***\2')
      ELSE NULL
    END AS child_email,
    status, created_at, accepted_at
  FROM dynasty_links
  WHERE (parent_id = auth.uid() OR child_id = auth.uid())
    AND status IN ('pending','active')
  ORDER BY created_at DESC;
$$;

-- 2) profiles: revoke column-level SELECT on withdraw_pin_hash from client roles
REVOKE SELECT (withdraw_pin_hash) ON public.profiles FROM authenticated, anon;

-- Replacement helper so client can still know whether a PIN is set without seeing the hash
CREATE OR REPLACE FUNCTION public.has_withdraw_pin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT withdraw_pin_hash IS NOT NULL FROM public.profiles WHERE id = auth.uid()), false);
$$;
REVOKE ALL ON FUNCTION public.has_withdraw_pin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_withdraw_pin() TO authenticated;
