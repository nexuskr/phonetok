
-- ===== Phase D: SMS opt-in =====
CREATE OR REPLACE FUNCTION public.tg_withdrawal_status_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_title text; v_body text; v_sms_on boolean;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  CASE NEW.status::text
    WHEN 'reviewing' THEN v_title := '🔍 출금 검수 중';      v_body := '출금 신청이 검수 단계로 이동했습니다.';
    WHEN 'approved'  THEN v_title := '✅ 출금 승인';         v_body := '출금이 승인되어 곧 지급됩니다.';
    WHEN 'completed' THEN v_title := '💸 출금 지급 완료';     v_body := '요청하신 금액이 정상적으로 지급되었습니다.';
    WHEN 'rejected'  THEN v_title := '⛔ 출금 거절';         v_body := COALESCE('사유: '||NEW.rejected_reason, '관리자 검수에서 거절되었습니다.');
    WHEN 'cancelled' THEN v_title := '🚫 출금 취소';         v_body := '출금 요청이 취소되었습니다.';
    ELSE RETURN NEW;
  END CASE;

  INSERT INTO public.notifications(user_id, kind, title, body, payload)
  VALUES (NEW.user_id, 'withdrawal_'||NEW.status::text, v_title, v_body,
    jsonb_build_object('request_id', NEW.id, 'amount', NEW.amount, 'status', NEW.status));

  -- SMS only when user has explicitly opted in
  SELECT COALESCE(sms_notifications_enabled, false) INTO v_sms_on
    FROM public.profiles WHERE id = NEW.user_id;

  IF v_sms_on THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://ketlqzfaplppmupaiwft.supabase.co/functions/v1/send-withdrawal-sms',
        headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldGxxemZhcGxwcG11cGFpd2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzQzMzcsImV4cCI6MjA5MzY1MDMzN30.GtdLLkaCiNUsEkqHYd1fg8fUk0dtojSubj6lPA3igtk"}'::jsonb,
        body := jsonb_build_object('user_id', NEW.user_id, 'status', NEW.status::text, 'amount', NEW.amount, 'request_id', NEW.id)
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN NEW;
END $function$;

-- ===== Phase C: Passkey storage =====
CREATE TABLE IF NOT EXISTS public.user_passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[],
  device_name text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_user ON public.user_passkeys(user_id);

ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "passkey self select" ON public.user_passkeys
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "passkey self delete" ON public.user_passkeys
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- INSERT/UPDATE only via SECURITY DEFINER edge functions (no client policies)

CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  challenge text NOT NULL,
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_exp ON public.webauthn_challenges(expires_at);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
-- No policies = deny-all to clients. Edge functions use service role.
