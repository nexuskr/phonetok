-- daily_whale_leaderboard: drop public-read, add authenticated-only read
DROP POLICY IF EXISTS dwl_public_read ON public.daily_whale_leaderboard;
DROP POLICY IF EXISTS dwl_authenticated_read ON public.daily_whale_leaderboard;
CREATE POLICY dwl_authenticated_read
  ON public.daily_whale_leaderboard
  FOR SELECT
  TO authenticated
  USING (true);

-- trust_snapshots: admin-only read
DROP POLICY IF EXISTS ts_authenticated_read ON public.trust_snapshots;
DROP POLICY IF EXISTS ts_admin_read ON public.trust_snapshots;
CREATE POLICY ts_admin_read
  ON public.trust_snapshots
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- viral_settings: admin-only read
DROP POLICY IF EXISTS vs_authenticated_read ON public.viral_settings;
DROP POLICY IF EXISTS vs_admin_read ON public.viral_settings;
CREATE POLICY vs_admin_read
  ON public.viral_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- bot_personas: admin-only read
DROP POLICY IF EXISTS bot_personas_read_authenticated ON public.bot_personas;
DROP POLICY IF EXISTS bot_personas_admin_read ON public.bot_personas;
CREATE POLICY bot_personas_admin_read
  ON public.bot_personas
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));