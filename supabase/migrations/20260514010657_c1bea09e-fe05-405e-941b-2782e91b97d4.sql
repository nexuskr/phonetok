
-- 1. Fix admin_freeze_user (table uses expires_at, not frozen_until/frozen_by)
CREATE OR REPLACE FUNCTION public.admin_freeze_user(
  _user_id uuid,
  _hours integer DEFAULT 24,
  _reason text DEFAULT 'manual_admin_freeze'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  freeze_id uuid;
  v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  IF _hours < 1 OR _hours > 720 THEN
    RAISE EXCEPTION 'invalid_hours';
  END IF;

  INSERT INTO public.account_freezes (user_id, expires_at, reason, source, severity, metadata)
  VALUES (_user_id, now() + make_interval(hours => _hours), _reason, 'admin_manual', 'warn',
          jsonb_build_object('admin_id', v_admin, 'hours', _hours))
  RETURNING id INTO freeze_id;

  INSERT INTO public.anomaly_events (rule, severity, user_id, payload)
  VALUES ('manual_admin_freeze', 'warn', _user_id,
          jsonb_build_object('hours', _hours, 'reason', _reason, 'admin_id', v_admin));

  RETURN freeze_id;
END;
$$;

-- 2. Permanent ban / unban via auth.users.banned_until
CREATE OR REPLACE FUNCTION public.admin_ban_user(
  _user_id uuid,
  _reason text DEFAULT 'admin_ban'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  IF _user_id = v_admin THEN
    RAISE EXCEPTION 'cannot_ban_self';
  END IF;

  UPDATE auth.users
     SET banned_until = 'infinity'::timestamptz
   WHERE id = _user_id;

  INSERT INTO public.anomaly_events (rule, severity, user_id, payload)
  VALUES ('admin_ban', 'high', _user_id,
          jsonb_build_object('reason', _reason, 'admin_id', v_admin));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  UPDATE auth.users
     SET banned_until = NULL
   WHERE id = _user_id;

  INSERT INTO public.anomaly_events (rule, severity, user_id, payload)
  VALUES ('admin_unban', 'info', _user_id,
          jsonb_build_object('admin_id', v_admin));

  RETURN true;
END;
$$;

-- 3. Soft delete (탈퇴) — mark auth.users.deleted_at; profile cascades on hard delete later
CREATE OR REPLACE FUNCTION public.admin_soft_delete_user(
  _user_id uuid,
  _reason text DEFAULT 'admin_delete'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  IF _user_id = v_admin THEN
    RAISE EXCEPTION 'cannot_delete_self';
  END IF;

  UPDATE auth.users
     SET deleted_at = now(),
         banned_until = 'infinity'::timestamptz
   WHERE id = _user_id;

  INSERT INTO public.anomaly_events (rule, severity, user_id, payload)
  VALUES ('admin_soft_delete', 'high', _user_id,
          jsonb_build_object('reason', _reason, 'admin_id', v_admin));

  RETURN true;
END;
$$;

-- 4. Full user list with email + freeze + ban + balance in one call
CREATE OR REPLACE FUNCTION public.admin_list_users_full(
  _limit integer DEFAULT 200,
  _offset integer DEFAULT 0,
  _q text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, nickname text, email text, tier text,
  auth_provider text, profile_completed boolean,
  real_name text, phone text, birth_date date,
  available_balance bigint, total_balance bigint,
  created_at timestamptz,
  is_frozen boolean, frozen_until timestamptz, freeze_reason text,
  is_banned boolean, banned_until timestamptz, is_deleted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  RETURN QUERY
  WITH active_freeze AS (
    SELECT DISTINCT ON (user_id) user_id, expires_at, reason
      FROM public.account_freezes
     WHERE released_at IS NULL AND expires_at > now()
     ORDER BY user_id, expires_at DESC
  )
  SELECT p.id,
         p.nickname,
         u.email::text,
         COALESCE(p.tier::text, 'normal'),
         p.auth_provider,
         COALESCE(p.profile_completed, false),
         p.real_name,
         p.phone,
         p.birth_date,
         COALESCE(w.available_balance, 0)::bigint,
         COALESCE(w.total_balance, 0)::bigint,
         p.created_at,
         (af.user_id IS NOT NULL) AS is_frozen,
         af.expires_at AS frozen_until,
         af.reason AS freeze_reason,
         (u.banned_until IS NOT NULL AND u.banned_until > now()) AS is_banned,
         u.banned_until,
         (u.deleted_at IS NOT NULL) AS is_deleted
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.wallet_balances w ON w.user_id = p.id
    LEFT JOIN active_freeze af ON af.user_id = p.id
   WHERE _q IS NULL OR length(trim(_q)) = 0
      OR p.nickname ILIKE '%'||_q||'%'
      OR u.email ILIKE '%'||_q||'%'
      OR p.real_name ILIKE '%'||_q||'%'
      OR p.phone ILIKE '%'||_q||'%'
      OR p.id::text = _q
   ORDER BY p.created_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 500))
   OFFSET GREATEST(0, _offset);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ban_user(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_unban_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_soft_delete_user(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_users_full(integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_soft_delete_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users_full(integer, integer, text) TO authenticated;
