-- Fix: function digest(text, unknown) does not exist
-- pgcrypto lives in `extensions` schema; affected SECURITY DEFINER functions
-- had search_path locked to public[, pg_temp] only. Add `extensions` so
-- unqualified `digest(...)` resolves. No behavioral / signature / grant change.

ALTER FUNCTION public.request_withdrawal(bigint, public.withdrawal_method, text, text, text, text, text)
  SET search_path = public, pg_temp, extensions;

ALTER FUNCTION public.verify_withdraw_otp(text)
  SET search_path = public, pg_temp, extensions;

ALTER FUNCTION public.request_withdraw_otp()
  SET search_path = public, pg_temp, extensions;

ALTER FUNCTION public.reset_withdraw_pin(text, text)
  SET search_path = public, pg_temp, extensions;

ALTER FUNCTION public.submit_deposit(bigint, public.deposit_method, text, text, text, text, text, text)
  SET search_path = public, pg_temp, extensions;

ALTER FUNCTION public.validate_deposit_input(text, text, text, text, text, text)
  SET search_path = public, pg_temp, extensions;

ALTER FUNCTION public._crash_compute_multiplier(text)
  SET search_path = public, pg_temp, extensions;

ALTER FUNCTION public.crash_tick_round()
  SET search_path = public, pg_temp, extensions;

ALTER FUNCTION public.fuse_nft(uuid[])
  SET search_path = public, pg_temp, extensions;
