
CREATE TABLE IF NOT EXISTS public.ai_daily_ops_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL UNIQUE,
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  summary text NOT NULL,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_input jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aidor_date ON public.ai_daily_ops_reports (report_date DESC);

ALTER TABLE public.ai_daily_ops_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aidor_admin_select" ON public.ai_daily_ops_reports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "aidor_admin_insert" ON public.ai_daily_ops_reports
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
