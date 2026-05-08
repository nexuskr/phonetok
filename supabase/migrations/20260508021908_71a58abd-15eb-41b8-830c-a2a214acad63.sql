
-- 1) trust 스키마 (PostgREST 미노출)
create schema if not exists trust;
revoke all on schema trust from public, anon, authenticated;
grant usage on schema trust to postgres, service_role;

-- 2) 기존 public 함수들을 trust 스키마로 재정의(이동) 후 public 버전 삭제
do $$
declare
  fn record;
begin
  for fn in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('public_trust_metrics','public_uptime_summary','public_uptime_heatmap_90d','latest_chaos_run')
  loop
    execute format('alter function public.%I(%s) set schema trust', fn.proname, fn.args);
  end loop;
end$$;

-- 안전: anon/authenticated의 trust 함수 실행 차단
revoke all on all functions in schema trust from public, anon, authenticated;
grant execute on all functions in schema trust to service_role;

-- 3) trust_snapshots 공개 집계 테이블
create table if not exists public.trust_snapshots (
  id uuid primary key default gen_random_uuid(),
  taken_at timestamptz not null default now(),
  total_paid bigint not null default 0,
  paid_30d bigint not null default 0,
  cron_uptime_7d numeric not null default 0,
  audit_pass_30d numeric not null default 0,
  policy_pass_7d numeric not null default 0,
  uptime_success_24h numeric not null default 0,
  uptime_success_7d numeric not null default 0,
  uptime_p95_ms_24h integer not null default 0,
  unack_anomalies integer not null default 0,
  total_members integer not null default 0,
  active_members_30d integer not null default 0
);
alter table public.trust_snapshots enable row level security;
drop policy if exists ts_public_read on public.trust_snapshots;
create policy ts_public_read on public.trust_snapshots for select using (true);
create index if not exists trust_snapshots_taken_at_idx on public.trust_snapshots(taken_at desc);

-- 4) 스냅샷 기록 함수 (서비스 롤 전용)
create or replace function public.trust_record_snapshot()
returns uuid
language plpgsql
security definer
set search_path = public, trust
as $$
declare
  m jsonb;
  u jsonb;
  _id uuid;
begin
  m := trust.public_trust_metrics();
  u := trust.public_uptime_summary();
  insert into public.trust_snapshots (
    total_paid, paid_30d, cron_uptime_7d, audit_pass_30d, policy_pass_7d,
    uptime_success_24h, uptime_success_7d, uptime_p95_ms_24h,
    unack_anomalies, total_members, active_members_30d
  ) values (
    coalesce((m->>'total_paid')::bigint, 0),
    coalesce((m->>'paid_30d')::bigint, 0),
    coalesce((m->>'cron_uptime_7d')::numeric, 0),
    coalesce((m->>'audit_pass_30d')::numeric, 0),
    coalesce((m->>'policy_pass_7d')::numeric, 0),
    coalesce((u->>'success_rate_24h')::numeric, 0),
    coalesce((u->>'success_rate_7d')::numeric, 0),
    coalesce((u->>'p95_latency_ms_24h')::integer, 0),
    coalesce((m->>'unack_anomalies')::integer, 0),
    coalesce((m->>'total_members')::integer, 0),
    coalesce((m->>'active_members_30d')::integer, 0)
  ) returning id into _id;
  delete from public.trust_snapshots where taken_at < now() - interval '180 days';
  return _id;
end;
$$;
revoke all on function public.trust_record_snapshot() from public, anon, authenticated;
grant execute on function public.trust_record_snapshot() to service_role;

-- 5) 공개 히스토리 RPC (SECURITY INVOKER, RLS 통과만으로 공개)
create or replace function public.public_trust_history(_days integer default 30)
returns setof public.trust_snapshots
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.trust_snapshots
  where taken_at >= now() - (greatest(_days,1) || ' days')::interval
  order by taken_at asc
$$;
grant execute on function public.public_trust_history(integer) to anon, authenticated;

-- 6) 정책 단언 cron 상태 RPC (admin)
create or replace function public.policy_assertions_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  last_run timestamptz;
  next_run timestamptz;
  job_schedule text;
begin
  if not has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'forbidden';
  end if;
  select max(created_at) into last_run from public.policy_assertion_runs;
  select schedule into job_schedule from cron.job where jobname = 'run-policy-assertions-daily';
  -- 단순 다음 실행: 오늘 03:30 (서버 UTC) → 지났으면 내일
  next_run := date_trunc('day', now()) + interval '3 hours 30 minutes';
  if next_run <= now() then next_run := next_run + interval '1 day'; end if;
  return jsonb_build_object(
    'last_run_at', last_run,
    'next_run_at', next_run,
    'cron_schedule', coalesce(job_schedule, '30 3 * * *')
  );
end;
$$;
revoke all on function public.policy_assertions_status() from public, anon;
grant execute on function public.policy_assertions_status() to authenticated;

-- 7) 일괄 확인 처리 + 단일 재탐지
create or replace function public.bulk_acknowledge_anomalies(_ids uuid[], _note text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _cnt integer;
begin
  if not has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'forbidden';
  end if;
  with up as (
    update public.anomaly_events
       set acknowledged = true,
           acknowledged_by = auth.uid(),
           acknowledged_at = now(),
           ack_note = _note
     where id = any(_ids) and acknowledged = false
     returning 1
  )
  select count(*) into _cnt from up;
  insert into public.admin_audit_log(admin_id, action, target_type, metadata)
  values (auth.uid(), 'bulk_ack_anomalies', 'anomaly_event',
    jsonb_build_object('count', _cnt, 'ids', _ids, 'note', _note));
  return _cnt;
end;
$$;
revoke all on function public.bulk_acknowledge_anomalies(uuid[], text) from public, anon;
grant execute on function public.bulk_acknowledge_anomalies(uuid[], text) to authenticated;

create or replace function public.redetect_anomaly(_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.anomaly_events%rowtype;
  _new jsonb;
begin
  if not has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'forbidden';
  end if;
  select * into _row from public.anomaly_events where id = _id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  -- 같은 dedupe_key 잠시 풀고 detect_anomalies 재실행
  update public.anomaly_events set dedupe_key = dedupe_key || ':redetect:' || extract(epoch from now())::text
    where id = _id;
  _new := public.detect_anomalies();
  insert into public.admin_audit_log(admin_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'redetect_anomaly', 'anomaly_event', _id, jsonb_build_object('result', _new));
  return jsonb_build_object('ok', true, 'result', _new);
end;
$$;
revoke all on function public.redetect_anomaly(uuid) from public, anon;
grant execute on function public.redetect_anomaly(uuid) to authenticated;

-- 8) 일일 trust 스냅샷 cron 등록
do $$
begin
  perform cron.unschedule('phonara-trust-snapshot-daily') where exists (
    select 1 from cron.job where jobname='phonara-trust-snapshot-daily'
  );
exception when others then null;
end$$;

select cron.schedule(
  'phonara-trust-snapshot-daily',
  '5 4 * * *',
  $$ select public.trust_record_snapshot(); $$
);

-- 9) 첫 스냅샷 즉시 1건 기록 (히스토리 시작점)
select public.trust_record_snapshot();
