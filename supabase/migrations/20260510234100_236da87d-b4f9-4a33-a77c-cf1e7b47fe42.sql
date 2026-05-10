
CREATE TABLE IF NOT EXISTS public.fomo_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('recovery','loss_streak','inactive','jackpot_near','war_started','referral_used','empire_promo','market_event')),
  title text NOT NULL,
  message text NOT NULL,
  cta_label text,
  cta_url text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority smallint NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  read_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fomo_user_unread ON public.fomo_notifications(user_id, read_at, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fomo_dedupe ON public.fomo_notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.fomo_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fomo_self_read" ON public.fomo_notifications FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "fomo_self_update" ON public.fomo_notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "fomo_admin_all" ON public.fomo_notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.fomo_notifications;

CREATE OR REPLACE FUNCTION public.enqueue_fomo_notification(
  _user_id uuid, _kind text, _title text, _message text,
  _cta_label text DEFAULT NULL, _cta_url text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb, _priority smallint DEFAULT 5,
  _dedupe_key text DEFAULT NULL, _ttl_hours int DEFAULT 168
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_required'; END IF;
  INSERT INTO public.fomo_notifications(user_id, kind, title, message, cta_label, cta_url, payload, priority, dedupe_key, expires_at)
    VALUES(_user_id, _kind, _title, _message, _cta_label, _cta_url, coalesce(_payload,'{}'::jsonb), coalesce(_priority,5), _dedupe_key, now() + make_interval(hours => GREATEST(_ttl_hours,1)))
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
    RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.mark_fomo_notification_read(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  UPDATE public.fomo_notifications SET read_at = now()
    WHERE id = _id AND user_id = _uid AND read_at IS NULL;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.get_my_fomo_notifications(_limit int DEFAULT 20)
RETURNS SETOF public.fomo_notifications
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.fomo_notifications
   WHERE user_id = auth.uid() AND expires_at > now()
   ORDER BY read_at NULLS FIRST, priority DESC, created_at DESC
   LIMIT GREATEST(_limit,1);
$$;

INSERT INTO public.function_permissions_baseline(function_name, function_args, allowed_roles, category, note) VALUES
  ('public.enqueue_fomo_notification','uuid, text, text, text, text, text, jsonb, smallint, text, integer', ARRAY['service_role'],'fomo','P5 server-side enqueue only'),
  ('public.mark_fomo_notification_read','uuid', ARRAY['authenticated'],'fomo','P5 user read mark'),
  ('public.get_my_fomo_notifications','integer', ARRAY['authenticated'],'fomo','P5 user fetch')
ON CONFLICT DO NOTHING;

REVOKE EXECUTE ON FUNCTION public.enqueue_fomo_notification(uuid, text, text, text, text, text, jsonb, smallint, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_fomo_notification(uuid, text, text, text, text, text, jsonb, smallint, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_fomo_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_fomo_notifications(int) TO authenticated;
