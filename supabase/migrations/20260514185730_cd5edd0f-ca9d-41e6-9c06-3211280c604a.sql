
CREATE OR REPLACE FUNCTION public.admin_freeze_user(_user_id uuid, _hours integer DEFAULT 24, _reason text DEFAULT 'manual_admin_freeze'::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE freeze_id uuid; v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN RAISE EXCEPTION 'admin_only'; END IF;
  IF v_admin = _user_id THEN RAISE EXCEPTION 'cannot_target_self'; END IF;
  IF _hours < 1 OR _hours > 720 THEN RAISE EXCEPTION 'invalid_hours'; END IF;
  INSERT INTO public.account_freezes (user_id, expires_at, reason, source, severity, metadata)
  VALUES (_user_id, now() + make_interval(hours => _hours), _reason, 'admin_manual', 'warn',
          jsonb_build_object('admin_id', v_admin, 'hours', _hours)) RETURNING id INTO freeze_id;
  INSERT INTO public.anomaly_events (rule, severity, user_id, evidence)
  VALUES ('manual_admin_freeze', 'medium', _user_id, jsonb_build_object('hours', _hours, 'reason', _reason, 'admin_id', v_admin));
  INSERT INTO public.admin_audit_log(admin_id, action, target_type, target_id, payload)
  VALUES (v_admin, 'admin_freeze_user', 'user', _user_id, jsonb_build_object('hours', _hours, 'reason', _reason, 'freeze_id', freeze_id));
  RETURN freeze_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_ban_user(_user_id uuid, _reason text DEFAULT 'admin_ban')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN RAISE EXCEPTION 'admin_only'; END IF;
  IF _user_id = v_admin THEN RAISE EXCEPTION 'cannot_ban_self'; END IF;
  UPDATE auth.users SET banned_until = 'infinity'::timestamptz WHERE id = _user_id;
  INSERT INTO public.anomaly_events (rule, severity, user_id, evidence)
  VALUES ('admin_ban', 'high', _user_id, jsonb_build_object('reason', _reason, 'admin_id', v_admin));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN RAISE EXCEPTION 'admin_only'; END IF;
  UPDATE auth.users SET banned_until = NULL WHERE id = _user_id;
  INSERT INTO public.anomaly_events (rule, severity, user_id, evidence)
  VALUES ('admin_unban', 'low', _user_id, jsonb_build_object('admin_id', v_admin));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.admin_soft_delete_user(_user_id uuid, _reason text DEFAULT 'admin_delete')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN RAISE EXCEPTION 'admin_only'; END IF;
  IF _user_id = v_admin THEN RAISE EXCEPTION 'cannot_delete_self'; END IF;
  UPDATE auth.users SET deleted_at = now(), banned_until = 'infinity'::timestamptz WHERE id = _user_id;
  INSERT INTO public.anomaly_events (rule, severity, user_id, evidence)
  VALUES ('admin_soft_delete', 'high', _user_id, jsonb_build_object('reason', _reason, 'admin_id', v_admin));
  RETURN true;
END $$;
