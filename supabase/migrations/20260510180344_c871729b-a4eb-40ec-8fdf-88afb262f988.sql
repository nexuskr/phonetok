
-- ========= Phase A: Magic Link & Withdraw OTP =========

-- Notification preferences (SMS off by default later — Phase D)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_notifications_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean DEFAULT true;

-- Withdraw email OTP codes
CREATE TABLE IF NOT EXISTS public.withdraw_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_withdraw_otp_user_active
  ON public.withdraw_otp_codes (user_id, consumed_at, expires_at);

ALTER TABLE public.withdraw_otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "no direct read" ON public.withdraw_otp_codes;
DROP POLICY IF EXISTS "no direct write" ON public.withdraw_otp_codes;
-- No policies = deny-all to non-service-role. RPCs use SECURITY DEFINER.

-- Request OTP: hashes a 6-digit code, stores it, enqueues an email
CREATE OR REPLACE FUNCTION public.request_withdraw_otp()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _code text;
  _hash text;
  _recent int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  -- Rate limit: max 5 OTP requests per 10 minutes
  SELECT count(*) INTO _recent
    FROM public.withdraw_otp_codes
   WHERE user_id = _uid
     AND created_at > now() - interval '10 minutes';
  IF _recent >= 5 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  IF _email IS NULL THEN
    RAISE EXCEPTION 'no_email' USING ERRCODE = 'P0001';
  END IF;

  _code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  _hash := encode(digest(_code || _uid::text, 'sha256'), 'hex');

  INSERT INTO public.withdraw_otp_codes (user_id, code_hash, expires_at)
  VALUES (_uid, _hash, now() + interval '5 minutes');

  -- Enqueue email
  PERFORM public.enqueue_email(
    'transactional_emails',
    jsonb_build_object(
      'to', _email,
      'subject', '[Phonara] 출금 인증 코드: ' || _code,
      'html', format(
        '<div style="font-family:system-ui,sans-serif;padding:24px;max-width:480px;margin:0 auto"><h2 style="color:#0f172a">Phonara 출금 인증 코드</h2><p>출금 요청을 완료하려면 아래 6자리 코드를 입력하세요.</p><p style="font-size:32px;letter-spacing:8px;font-weight:800;background:#0f172a;color:#fff;padding:16px;border-radius:12px;text-align:center">%s</p><p style="color:#64748b;font-size:13px">유효 시간: 5분. 본인이 요청하지 않았다면 즉시 비밀번호를 변경하세요.</p></div>',
        _code
      ),
      'text', '[Phonara] 출금 인증 코드: ' || _code || ' (5분간 유효)',
      'template_name', 'withdraw_otp'
    )
  );

  RETURN jsonb_build_object('ok', true, 'expires_in', 300);
END;
$$;

REVOKE ALL ON FUNCTION public.request_withdraw_otp() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdraw_otp() TO authenticated;

-- Verify OTP
CREATE OR REPLACE FUNCTION public.verify_withdraw_otp(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _hash text;
  _row record;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF _code IS NULL OR length(_code) <> 6 THEN
    RAISE EXCEPTION 'invalid_format' USING ERRCODE = 'P0001';
  END IF;

  _hash := encode(digest(_code || _uid::text, 'sha256'), 'hex');

  SELECT * INTO _row
    FROM public.withdraw_otp_codes
   WHERE user_id = _uid
     AND consumed_at IS NULL
     AND expires_at > now()
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_code' USING ERRCODE = 'P0001';
  END IF;
  IF _row.attempts >= 5 THEN
    RAISE EXCEPTION 'too_many_attempts' USING ERRCODE = 'P0001';
  END IF;

  IF _row.code_hash <> _hash THEN
    UPDATE public.withdraw_otp_codes SET attempts = attempts + 1 WHERE id = _row.id;
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.withdraw_otp_codes SET consumed_at = now() WHERE id = _row.id;
  RETURN jsonb_build_object('ok', true, 'verified_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.verify_withdraw_otp(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_withdraw_otp(text) TO authenticated;
