begin;

-- Reversible Partner Portal associate-account layer.
-- The existing intermediary_portal_accounts table remains the untouched primary login.
create table if not exists public.partner_portal_associate_accounts (
  id uuid primary key default gen_random_uuid(),
  intermediary_id uuid not null references public.intermediaries(id) on delete cascade,
  application_id uuid references public.intermediary_onboarding_applications(id) on delete set null,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  phone_number text not null,
  email text not null,
  designation text not null,
  role text not null check (role in ('admin','claim_head','insurance_head','bodyshop_manager')),
  status text not null default 'invited' check (status in ('invited','active','disabled')),
  invited_at timestamptz,
  activated_at timestamptz,
  disabled_at timestamptz,
  invited_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_portal_associate_accounts_email_unique
  on public.partner_portal_associate_accounts (lower(email));
create index if not exists partner_portal_associate_accounts_intermediary_idx
  on public.partner_portal_associate_accounts (intermediary_id, created_at);

alter table public.partner_portal_associate_accounts enable row level security;

drop policy if exists partner_portal_associate_self_read on public.partner_portal_associate_accounts;
create policy partner_portal_associate_self_read
on public.partner_portal_associate_accounts
for select
to authenticated
using (auth_user_id = auth.uid());

revoke all on table public.partner_portal_associate_accounts from public, anon, authenticated;
grant select on table public.partner_portal_associate_accounts to authenticated;
grant select, insert, update, delete on table public.partner_portal_associate_accounts to service_role;

create table if not exists public.partner_portal_associate_account_audit (
  id uuid primary key default gen_random_uuid(),
  associate_account_id uuid references public.partner_portal_associate_accounts(id) on delete set null,
  intermediary_id uuid not null references public.intermediaries(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('invited','activated','disabled','enabled')),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.partner_portal_associate_account_audit enable row level security;
revoke all on table public.partner_portal_associate_account_audit from public, anon, authenticated;
grant select, insert on table public.partner_portal_associate_account_audit to service_role;

create or replace function public.partner_portal_associate_identity()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_user public.partner_portal_associate_accounts%rowtype;
  v_intermediary public.intermediaries%rowtype;
  v_partner_id uuid;
  v_partner_code text;
  v_partner_name text;
begin
  if v_uid is null then return null; end if;

  select a.* into v_user
  from public.partner_portal_associate_accounts a
  join public.profiles pr on pr.id = a.auth_user_id and pr.is_active = true
  where a.auth_user_id = v_uid and a.status = 'active'
  limit 1;

  if not found then return null; end if;

  select i.* into v_intermediary
  from public.intermediaries i
  where i.id = v_user.intermediary_id
    and i.intermediary_type = 'partner'
    and i.account_status = 'active'
  limit 1;

  if not found then return null; end if;

  v_partner_id := public.partner_app_resolve_partner_family(v_user.intermediary_id);
  if v_partner_id is null then return null; end if;

  select p.partner_code, p.display_name
  into v_partner_code, v_partner_name
  from public.partners p
  where p.id = v_partner_id and p.partner_status = 'active_partner';

  if not found then return null; end if;

  return jsonb_build_object(
    'actor_kind', 'intermediary',
    'auth_user_id', v_uid,
    'profile_id', v_uid,
    'portal_account_id', v_user.id,
    'portal_account_source', 'associate',
    'intermediary_id', v_intermediary.id,
    'intermediary_type', v_intermediary.intermediary_type,
    'intermediary_code', v_intermediary.intermediary_code,
    'display_name', v_intermediary.display_name,
    'partner_id', v_partner_id,
    'partner_code', v_partner_code,
    'partner_name', v_partner_name,
    'login_email', v_user.email,
    'associate_name', v_user.name,
    'associate_role', v_user.role,
    'associate_designation', v_user.designation
  );
end;
$$;

do $$
begin
  if to_regprocedure('public.partner_app_current_identity_before_associate_accounts()') is null then
    alter function public.partner_app_current_identity()
      rename to partner_app_current_identity_before_associate_accounts;
  end if;
end;
$$;

revoke all on function public.partner_app_current_identity_before_associate_accounts() from public, anon, authenticated;
grant execute on function public.partner_app_current_identity_before_associate_accounts() to service_role;

create or replace function public.partner_app_current_identity()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare v_identity jsonb;
begin
  v_identity := public.partner_portal_associate_identity();
  if v_identity is not null then return v_identity; end if;
  return public.partner_app_current_identity_before_associate_accounts();
end;
$$;

do $$
begin
  if to_regprocedure('public.partner_app_activate_current_account_before_associate_accounts()') is null then
    alter function public.partner_app_activate_current_account()
      rename to partner_app_activate_current_account_before_associate_accounts;
  end if;
end;
$$;

revoke all on function public.partner_app_activate_current_account_before_associate_accounts() from public, anon, authenticated;
grant execute on function public.partner_app_activate_current_account_before_associate_accounts() to service_role;

create or replace function public.partner_app_activate_current_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_user public.partner_portal_associate_accounts%rowtype;
  v_partner_id uuid;
  v_now timestamptz := now();
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='28000'; end if;

  select * into v_user
  from public.partner_portal_associate_accounts
  where auth_user_id = v_uid
  for update;

  if found then
    if v_user.status = 'disabled' then
      raise exception 'Partner portal account is not available' using errcode='28000';
    end if;

    v_partner_id := public.partner_app_resolve_partner_family(v_user.intermediary_id);
    if v_partner_id is null then
      raise exception 'Intermediary account does not resolve to one active permanent Partner family'
        using errcode='28000';
    end if;

    if v_user.status = 'invited' then
      update public.partner_portal_associate_accounts
      set status='active', activated_at=coalesce(activated_at,v_now), disabled_at=null, updated_at=v_now
      where id=v_user.id;

      insert into public.partner_portal_associate_account_audit(
        associate_account_id, intermediary_id, auth_user_id, event_type, actor_profile_id
      ) values (v_user.id, v_user.intermediary_id, v_uid, 'activated', v_uid);
    end if;

    return public.partner_app_current_identity();
  end if;

  return public.partner_app_activate_current_account_before_associate_accounts();
end;
$$;

revoke all on function public.partner_portal_associate_identity() from public, anon;
revoke all on function public.partner_app_current_identity() from public, anon;
revoke all on function public.partner_app_activate_current_account() from public, anon;
grant execute on function public.partner_portal_associate_identity() to authenticated, service_role;
grant execute on function public.partner_app_current_identity() to authenticated, service_role;
grant execute on function public.partner_app_activate_current_account() to authenticated, service_role;

commit;
