create table if not exists public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  max_uses int not null default 1,
  uses int not null default 0,
  expires_at timestamptz,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_beta_invites_code on public.beta_invites (code);
alter table public.beta_invites enable row level security;
drop policy if exists "bi_admin_all" on public.beta_invites;
create policy "bi_admin_all" on public.beta_invites for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

create table if not exists public.beta_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invite_id uuid not null references public.beta_invites(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (user_id, invite_id)
);
create index if not exists idx_br_user on public.beta_redemptions (user_id);
alter table public.beta_redemptions enable row level security;
drop policy if exists "br_self_read" on public.beta_redemptions;
create policy "br_self_read" on public.beta_redemptions for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "br_admin_read" on public.beta_redemptions;
create policy "br_admin_read" on public.beta_redemptions for select to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

create or replace function public.redeem_beta_invite(_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); inv record;
begin
  if uid is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if _code is null or length(trim(_code)) = 0 then raise exception 'code_required'; end if;

  select * into inv from public.beta_invites
    where code = upper(trim(_code))
    for update;
  if not found then raise exception 'invalid_code'; end if;
  if inv.expires_at is not null and inv.expires_at < now() then raise exception 'expired_code'; end if;
  if inv.uses >= inv.max_uses then raise exception 'code_exhausted'; end if;

  insert into public.beta_redemptions (user_id, invite_id) values (uid, inv.id)
    on conflict (user_id, invite_id) do nothing;
  if found then
    update public.beta_invites set uses = uses + 1 where id = inv.id;
  end if;

  return jsonb_build_object('ok', true, 'code', inv.code);
end; $$;
revoke all on function public.redeem_beta_invite(text) from public;
grant execute on function public.redeem_beta_invite(text) to authenticated;

create or replace function public.has_beta_access()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    has_role(auth.uid(), 'admin'::app_role),
    false
  ) or exists (
    select 1 from public.beta_redemptions where user_id = auth.uid()
  );
$$;
revoke all on function public.has_beta_access() from public;
grant execute on function public.has_beta_access() to authenticated;

insert into public.function_permissions_baseline (function_name, function_args, allowed_roles, category, note) values
  ('redeem_beta_invite', '_code text', array['authenticated'], 'user_action', 'Closed beta code redemption'),
  ('has_beta_access',    '',           array['authenticated'], 'user_read',   'Closed beta access check')
on conflict (function_name, function_args) do update
set allowed_roles = excluded.allowed_roles, category = excluded.category, note = excluded.note, updated_at = now();