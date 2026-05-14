-- ============================================================
-- ADMIN TOTP RECOVERY — 3-Layer Safety Net
-- 1) Backup Codes (self-recovery)
-- 2) Break-Glass runbook (docs only)
-- 3) 4-eyes Admin Recovery Request (peer-approved)
-- ============================================================

-- ──────────────── 1. Backup Codes ────────────────
create table if not exists public.admin_backup_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_abc_user_unused
  on public.admin_backup_codes(user_id) where used_at is null;

alter table public.admin_backup_codes enable row level security;
-- 직접 접근 전면 차단 — RPC만 사용
drop policy if exists "abc_deny_all" on public.admin_backup_codes;
create policy "abc_deny_all" on public.admin_backup_codes
  for all to authenticated using (false) with check (false);

-- generate_admin_backup_codes — 본인 AAL2에서만, 10개 plain-text 반환
create or replace function public.generate_admin_backup_codes()
returns text[]
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid    uuid := auth.uid();
  v_codes  text[] := array[]::text[];
  v_code   text;
  i        int;
begin
  if v_uid is null or not public.has_role(v_uid, 'admin') then
    raise exception 'admin_only';
  end if;
  if coalesce((auth.jwt()->>'aal'), 'aal1') <> 'aal2' then
    raise exception 'aal2_required';
  end if;

  -- 기존 미사용 코드 폐기 (재발급 시 이전 것 무효화)
  delete from public.admin_backup_codes
   where user_id = v_uid and used_at is null;

  for i in 1..10 loop
    -- 10자 영숫자, 혼동 글자(0/O/I/l) 제거
    v_code := upper(translate(
      encode(extensions.gen_random_bytes(10), 'base64'),
      '+/=OIl0', 'XYZWVUT'
    ));
    v_code := substr(v_code, 1, 10);
    v_codes := v_codes || v_code;
    insert into public.admin_backup_codes(user_id, code_hash)
      values (v_uid, extensions.crypt(v_code, extensions.gen_salt('bf', 8)));
  end loop;

  insert into public.admin_audit_log(admin_id, action, target_id, metadata)
    values (v_uid, 'backup_codes.generate', v_uid, jsonb_build_object('count', 10));

  return v_codes;
end$$;

revoke all on function public.generate_admin_backup_codes() from public, anon;
grant execute on function public.generate_admin_backup_codes() to authenticated;

-- consume_admin_backup_code — AAL1 OK (분실 시 사용)
create or replace function public.consume_admin_backup_code(_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_match   uuid;
  v_deleted int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_role(v_uid, 'admin') then raise exception 'admin_only'; end if;
  if _code is null or length(trim(_code)) < 6 then raise exception 'invalid_code'; end if;

  select id into v_match
    from public.admin_backup_codes
   where user_id = v_uid
     and used_at is null
     and code_hash = extensions.crypt(trim(_code), code_hash)
   limit 1;

  if v_match is null then
    insert into public.anomaly_events(user_id, rule, severity, metadata)
      values (v_uid, 'admin_backup_code_invalid', 'warn',
              jsonb_build_object('at', now()));
    raise exception 'invalid_code';
  end if;

  update public.admin_backup_codes set used_at = now() where id = v_match;

  delete from auth.mfa_factors where user_id = v_uid and factor_type = 'totp';
  get diagnostics v_deleted = row_count;

  insert into public.admin_audit_log(admin_id, action, target_id, metadata)
    values (v_uid, 'backup_codes.consume', v_uid,
            jsonb_build_object('totp_factors_removed', v_deleted));

  insert into public.anomaly_events(user_id, rule, severity, metadata)
    values (v_uid, 'admin_totp_reset_via_backup', 'error',
            jsonb_build_object('factors_removed', v_deleted));

  return jsonb_build_object('ok', true, 'totp_removed', v_deleted);
end$$;

revoke all on function public.consume_admin_backup_code(text) from public, anon;
grant execute on function public.consume_admin_backup_code(text) to authenticated;

-- count_admin_backup_codes — 남은 개수
create or replace function public.count_admin_backup_codes()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.admin_backup_codes
   where user_id = auth.uid() and used_at is null
$$;

revoke all on function public.count_admin_backup_codes() from public, anon;
grant execute on function public.count_admin_backup_codes() to authenticated;

-- ──────────────── 3. 4-eyes Recovery Requests ────────────────
create table if not exists public.admin_recovery_requests (
  id              uuid primary key default gen_random_uuid(),
  target_user_id  uuid not null references auth.users(id) on delete cascade,
  requested_by    uuid not null references auth.users(id),
  reason          text not null,
  status          text not null default 'pending',
  approvals       jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid
);
create index if not exists idx_arr_status_created
  on public.admin_recovery_requests(status, created_at desc);

alter table public.admin_recovery_requests enable row level security;

drop policy if exists "arr_admin_select" on public.admin_recovery_requests;
create policy "arr_admin_select" on public.admin_recovery_requests
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "arr_deny_write" on public.admin_recovery_requests;
create policy "arr_deny_write" on public.admin_recovery_requests
  for all to authenticated using (false) with check (false);

-- request_admin_recovery
create or replace function public.request_admin_recovery(_target uuid, _reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null or not public.has_role(v_uid, 'admin') then
    raise exception 'admin_only';
  end if;
  if _target is null or not public.has_role(_target, 'admin') then
    raise exception 'target_not_admin';
  end if;
  if _reason is null or length(trim(_reason)) < 10 then
    raise exception 'reason_required_min10';
  end if;

  insert into public.admin_recovery_requests(target_user_id, requested_by, reason)
    values (_target, v_uid, _reason)
    returning id into v_id;

  insert into public.admin_audit_log(admin_id, action, target_id, metadata)
    values (v_uid, 'recovery.request', _target,
            jsonb_build_object('request_id', v_id, 'reason', _reason));

  return v_id;
end$$;

revoke all on function public.request_admin_recovery(uuid, text) from public, anon;
grant execute on function public.request_admin_recovery(uuid, text) to authenticated;

-- approve_admin_recovery — 2 distinct approvers required (총 3명: 요청자 + 승인2)
create or replace function public.approve_admin_recovery(_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid             uuid := auth.uid();
  r                 record;
  v_approvals       jsonb;
  v_approver_count  int;
  v_target          uuid;
  v_deleted         int;
begin
  if v_uid is null or not public.has_role(v_uid, 'admin') then
    raise exception 'admin_only';
  end if;

  select * into r from public.admin_recovery_requests
   where id = _request_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.status <> 'pending' then raise exception 'not_pending'; end if;
  if r.requested_by = v_uid then raise exception 'requester_cannot_approve'; end if;

  if exists (
    select 1 from jsonb_array_elements(r.approvals) e
     where (e->>'admin_id')::uuid = v_uid
  ) then
    raise exception 'already_approved';
  end if;

  v_approvals := r.approvals || jsonb_build_object(
    'admin_id', v_uid, 'at', now()
  );
  v_approver_count := jsonb_array_length(v_approvals);
  v_target := r.target_user_id;

  if v_approver_count >= 2 then
    -- 4-eyes 충족 (요청자 + 2명 승인) → 즉시 실행
    delete from auth.mfa_factors
     where user_id = v_target and factor_type = 'totp';
    get diagnostics v_deleted = row_count;

    update public.admin_recovery_requests
       set status = 'approved',
           approvals = v_approvals,
           resolved_at = now(),
           resolved_by = v_uid
     where id = _request_id;

    insert into public.admin_audit_log(admin_id, action, target_id, metadata)
      values (v_uid, 'recovery.executed', v_target,
              jsonb_build_object('request_id', _request_id,
                                 'requester', r.requested_by,
                                 'totp_factors_removed', v_deleted));

    insert into public.anomaly_events(user_id, rule, severity, metadata)
      values (v_target, 'admin_totp_reset_4eyes', 'error',
              jsonb_build_object('request_id', _request_id,
                                 'requester', r.requested_by,
                                 'final_approver', v_uid,
                                 'factors_removed', v_deleted));

    return jsonb_build_object('ok', true, 'executed', true);
  else
    update public.admin_recovery_requests
       set approvals = v_approvals
     where id = _request_id;

    insert into public.admin_audit_log(admin_id, action, target_id, metadata)
      values (v_uid, 'recovery.approve', v_target,
              jsonb_build_object('request_id', _request_id,
                                 'approvals_so_far', v_approver_count));

    return jsonb_build_object('ok', true, 'executed', false,
                              'approvals', v_approver_count,
                              'needed', 2);
  end if;
end$$;

revoke all on function public.approve_admin_recovery(uuid) from public, anon;
grant execute on function public.approve_admin_recovery(uuid) to authenticated;

-- reject_admin_recovery
create or replace function public.reject_admin_recovery(_request_id uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.has_role(v_uid, 'admin') then
    raise exception 'admin_only';
  end if;

  update public.admin_recovery_requests
     set status = 'rejected',
         resolved_at = now(),
         resolved_by = v_uid,
         approvals = approvals || jsonb_build_object(
           'rejected_by', v_uid,
           'reason', coalesce(_reason, ''),
           'at', now()
         )
   where id = _request_id and status = 'pending';

  insert into public.admin_audit_log(admin_id, action, metadata)
    values (v_uid, 'recovery.reject',
            jsonb_build_object('request_id', _request_id, 'reason', _reason));
end$$;

revoke all on function public.reject_admin_recovery(uuid, text) from public, anon;
grant execute on function public.reject_admin_recovery(uuid, text) to authenticated;

-- list_admin_recovery_requests
create or replace function public.list_admin_recovery_requests(
  _status text default null,
  _limit  int  default 50
)
returns setof public.admin_recovery_requests
language sql
stable
security definer
set search_path = public
as $$
  select * from public.admin_recovery_requests
   where (_status is null or status = _status)
   order by created_at desc
   limit greatest(1, least(coalesce(_limit, 50), 200))
$$;

revoke all on function public.list_admin_recovery_requests(text, int) from public, anon;
grant execute on function public.list_admin_recovery_requests(text, int) to authenticated;

-- ──────────────── Permission Baseline ────────────────
insert into public.function_permissions_baseline
  (function_name, function_args, allowed_roles, category, note)
values
  ('generate_admin_backup_codes', '', array['admin'], 'admin_recovery',
   'Generate 10 one-time TOTP backup codes (AAL2 required)'),
  ('consume_admin_backup_code', '_code text', array['admin'], 'admin_recovery',
   'Consume backup code → delete own TOTP factor (AAL1 OK; lock-out recovery)'),
  ('count_admin_backup_codes', '', array['admin'], 'admin_recovery',
   'Remaining unused backup codes for self'),
  ('request_admin_recovery', '_target uuid, _reason text', array['admin'], 'admin_recovery',
   '4-eyes: request another admin TOTP reset (reason ≥10 chars)'),
  ('approve_admin_recovery', '_request_id uuid', array['admin'], 'admin_recovery',
   '4-eyes: approve; on 2nd distinct approver (≠requester) executes TOTP reset'),
  ('reject_admin_recovery', '_request_id uuid, _reason text', array['admin'], 'admin_recovery',
   '4-eyes: reject pending recovery request'),
  ('list_admin_recovery_requests', '_status text, _limit integer', array['admin'], 'admin_recovery',
   'List recovery requests for admin console')
on conflict (function_name, function_args) do update
  set allowed_roles = excluded.allowed_roles,
      category      = excluded.category,
      note          = excluded.note,
      updated_at    = now();