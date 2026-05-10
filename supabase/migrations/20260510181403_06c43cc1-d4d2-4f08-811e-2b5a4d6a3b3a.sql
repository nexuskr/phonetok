
CREATE TABLE IF NOT EXISTS public.passkey_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_passkey_verifications_active
  ON public.passkey_verifications(user_id, expires_at);

ALTER TABLE public.passkey_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "passkey_verifications self select" ON public.passkey_verifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_passkey_verified()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.passkey_verifications
     WHERE user_id = auth.uid() AND expires_at > now()
  );
$$;

REVOKE ALL ON FUNCTION public.is_passkey_verified() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_passkey_verified() TO authenticated;
