CREATE TABLE IF NOT EXISTS public.pay_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tron_receive_address text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

INSERT INTO public.pay_config(id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.pay_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pay_config_public_read"
ON public.pay_config FOR SELECT USING (true);

CREATE POLICY "pay_config_admin_write"
ON public.pay_config FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_pay_receive_address()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tron_receive_address FROM public.pay_config WHERE id = 1;
$$;

REVOKE ALL ON FUNCTION public.get_pay_receive_address() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pay_receive_address() TO anon, authenticated;