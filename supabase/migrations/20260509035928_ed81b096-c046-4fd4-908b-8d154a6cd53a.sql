-- 1. push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ps_self_select ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY ps_self_insert ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY ps_self_update ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY ps_self_delete ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 2. Trigger: when a notification is inserted, fire send-push edge function via pg_net
CREATE OR REPLACE FUNCTION public.tg_notification_dispatch_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_anon text;
  v_enabled boolean;
BEGIN
  -- check if user has push enabled for this event kind (default true if no row)
  SELECT COALESCE(np.enabled, true) INTO v_enabled
  FROM (SELECT 1) x
  LEFT JOIN public.notification_preferences np
    ON np.user_id = NEW.user_id AND np.channel = 'push' AND np.event = NEW.kind;
  IF v_enabled IS FALSE THEN
    RETURN NEW;
  END IF;

  -- only dispatch if user has any subscription
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  v_url := 'https://ketlqzfaplppmupaiwft.supabase.co/functions/v1/send-push';

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', COALESCE(NEW.body, ''),
      'kind', NEW.kind,
      'notification_id', NEW.id,
      'payload', NEW.payload
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- never block notification insert if push dispatch fails
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notification_dispatch_push ON public.notifications;
CREATE TRIGGER notification_dispatch_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notification_dispatch_push();

-- 3. Register in baseline (admin-only function)
INSERT INTO public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note)
VALUES ('tg_notification_dispatch_push', '', ARRAY['internal_trigger'], 'trigger', 'AFTER INSERT trigger on notifications - dispatches Web Push via pg_net')
ON CONFLICT DO NOTHING;