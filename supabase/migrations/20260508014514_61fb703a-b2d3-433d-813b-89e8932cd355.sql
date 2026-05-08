-- Uptime pings table
create table if not exists public.uptime_pings (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamptz not null default now(),
  ok boolean not null,
  http_status integer,
  latency_ms integer,
  indicator text,
  error text
);
create index if not exists uptime_pings_checked_at_idx on public.uptime_pings (checked_at desc);

alter table public.uptime_pings enable row level security;

drop policy if exists up_admin_read on public.uptime_pings;
create policy up_admin_read on public.uptime_pings
  for select to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

-- Aggregated public summary (no row-level exposure)
create or replace function public.public_uptime_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with d as (
    select * from public.uptime_pings where checked_at >= now() - interval '7 days'
  ),
  d24 as (
    select * from d where checked_at >= now() - interval '24 hours'
  )
  select jsonb_build_object(
    'samples_24h', (select count(*) from d24),
    'success_rate_24h', coalesce(round(100.0 * (select count(*) filter (where ok) from d24)::numeric
                                  / nullif((select count(*) from d24), 0), 2), 100),
    'success_rate_7d',  coalesce(round(100.0 * (select count(*) filter (where ok) from d)::numeric
                                  / nullif((select count(*) from d), 0), 2), 100),
    'p95_latency_ms_24h', coalesce((
      select percentile_cont(0.95) within group (order by latency_ms)
      from d24 where ok and latency_ms is not null
    )::int, 0),
    'avg_latency_ms_24h', coalesce((
      select avg(latency_ms)::int from d24 where ok and latency_ms is not null
    ), 0),
    'last_ping_at', (select max(checked_at) from d),
    'last_ok', (select ok from public.uptime_pings order by checked_at desc limit 1),
    'generated_at', now()
  );
$$;

revoke all on function public.public_uptime_summary() from public;
grant execute on function public.public_uptime_summary() to anon, authenticated;

-- Canary runner: pings the public-status edge function and inserts a row.
create or replace function public.run_uptime_canary()
returns void
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  v_request_id bigint;
  v_started timestamptz := clock_timestamp();
  v_status integer;
  v_body jsonb;
  v_indicator text;
  v_latency integer;
  v_ok boolean := false;
  v_error text;
begin
  begin
    select net.http_get(
      url := 'https://ketlqzfaplppmupaiwft.supabase.co/functions/v1/public-status?format=shield',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 8000
    ) into v_request_id;

    -- pg_net is async; poll the response table briefly
    for i in 1..40 loop
      perform pg_sleep(0.2);
      select status_code, content::jsonb
        into v_status, v_body
      from net._http_response
      where id = v_request_id;
      exit when v_status is not null;
    end loop;

    v_latency := extract(epoch from (clock_timestamp() - v_started)) * 1000;
    v_indicator := coalesce(v_body->>'color', null);
    v_ok := (v_status between 200 and 299) and (v_indicator = 'brightgreen');
  exception when others then
    v_error := sqlerrm;
    v_latency := extract(epoch from (clock_timestamp() - v_started)) * 1000;
  end;

  insert into public.uptime_pings (ok, http_status, latency_ms, indicator, error)
  values (v_ok, v_status, v_latency, v_indicator, v_error);

  -- Retention: keep 30 days
  delete from public.uptime_pings where checked_at < now() - interval '30 days';
end;
$$;

revoke all on function public.run_uptime_canary() from public;

-- Schedule: every 5 minutes
do $$
declare jid int;
begin
  select jobid into jid from cron.job where jobname = 'phonara-uptime-canary';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
  perform cron.schedule(
    'phonara-uptime-canary',
    '*/5 * * * *',
    $cron$ select public.run_uptime_canary(); $cron$
  );
end $$;