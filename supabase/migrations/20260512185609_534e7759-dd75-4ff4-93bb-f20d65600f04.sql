create or replace function public.get_beta_funnel_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  with seats as (
    select coalesce(sum(max_uses),0)::bigint as cap, coalesce(sum(uses),0)::bigint as used
    from public.beta_invites
    where has_role(auth.uid(), 'admin'::app_role)
  ),
  inv as (
    select count(*)::bigint as cnt from public.beta_invites
    where has_role(auth.uid(), 'admin'::app_role)
  ),
  red as (
    select user_id, redeemed_at from public.beta_redemptions
    where has_role(auth.uid(), 'admin'::app_role)
  ),
  red_total as (select count(*)::bigint as cnt from red),
  red_unique as (select count(distinct user_id)::bigint as cnt from red),
  red_7d as (select count(distinct user_id)::bigint as cnt from red where redeemed_at >= now() - interval '7 days'),
  red_users_7d as (select user_id from red where redeemed_at >= now() - interval '7 days'),
  red_users_30d as (select user_id from red where redeemed_at >= now() - interval '30 days'),
  dep_7d as (
    select count(distinct user_id)::bigint as cnt from public.deposit_requests
    where status = 'approved'
      and created_at >= now() - interval '7 days'
      and user_id in (select user_id from red_users_7d)
  ),
  dep_30d as (
    select count(distinct user_id)::bigint as cnt from public.deposit_requests
    where status = 'approved'
      and created_at >= now() - interval '30 days'
      and user_id in (select user_id from red_users_30d)
  )
  select jsonb_build_object(
    'invites_issued',     (select cnt from inv),
    'seats_total',        (select cap from seats),
    'seats_used',         (select used from seats),
    'redemptions_total',  (select cnt from red_total),
    'unique_redeemers',   (select cnt from red_unique),
    'redeemers_7d',       (select cnt from red_7d),
    'depositors_7d',      (select cnt from dep_7d),
    'depositors_30d',     (select cnt from dep_30d),
    'generated_at', now()
  );
$$;
revoke all on function public.get_beta_funnel_stats() from public;
grant execute on function public.get_beta_funnel_stats() to authenticated;

insert into public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note)
values ('get_beta_funnel_stats', '', array['authenticated'], 'admin_read', 'Closed beta funnel KPI')
on conflict (function_name, function_args) do update
set allowed_roles = excluded.allowed_roles, category = excluded.category, note = excluded.note, updated_at = now();