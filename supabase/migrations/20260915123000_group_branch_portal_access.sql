-- Additive Group / Branch portal access identities.
-- Existing Partner authentication is intentionally untouched. Existing business
-- rows are not backfilled; access is provisioned explicitly by an administrator.

create table if not exists public.portal_access_identities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('group', 'branch')),
  entity_id uuid not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  login_email text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint portal_access_identities_profile_unique unique (profile_id),
  constraint portal_access_identities_entity_unique unique (entity_type, entity_id),
  constraint portal_access_identities_login_email_unique unique (login_email)
);

comment on table public.portal_access_identities is
  'Explicit auth-to-business mapping for Group and Branch portal logins. Partner login remains on the legacy intermediary account path.';

alter table public.portal_access_identities enable row level security;

-- No client CRUD policies are created intentionally. Provisioning is performed
-- only by server-side admin actions using the service-role client.

create or replace function public.portal_access_identity_validate_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.entity_type = 'group' then
    if not exists (
      select 1 from public.intermediary_groups g
      where g.id = new.entity_id and g.status = 'active'
    ) then
      raise exception 'portal_access_group_not_available';
    end if;
  elsif new.entity_type = 'branch' then
    if not exists (
      select 1
      from public.partners p
      join public.partner_branch_profiles b on b.partner_id = p.id
      where p.id = new.entity_id
    ) then
      raise exception 'portal_access_branch_not_available';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.portal_access_identity_validate_target() from public;

drop trigger if exists portal_access_identity_validate_target on public.portal_access_identities;
create trigger portal_access_identity_validate_target
before insert or update of entity_type, entity_id
on public.portal_access_identities
for each row execute function public.portal_access_identity_validate_target();

create or replace function public.partner_portal_access_context()
returns table (
  account_type text,
  entity_id uuid,
  login_email text,
  scoped_partner_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_identity public.portal_access_identities%rowtype;
begin
  select i.* into v_identity
  from public.portal_access_identities i
  where i.profile_id = auth.uid()
    and i.status = 'active'
  limit 1;

  if not found then
    return;
  end if;

  if v_identity.entity_type = 'branch' then
    return query
    select
      'branch'::text,
      v_identity.entity_id,
      v_identity.login_email,
      array[v_identity.entity_id]::uuid[];
    return;
  end if;

  return query
  with member_partners as (
    select distinct m.partner_id
    from public.intermediary_group_memberships m
    where m.group_id = v_identity.entity_id
      and m.effective_to is null
  ), scoped as (
    select mp.partner_id as id from member_partners mp
    union
    select p.id
    from public.partners p
    join member_partners mp on mp.partner_id = p.parent_partner_id
  )
  select
    'group'::text,
    v_identity.entity_id,
    v_identity.login_email,
    coalesce(array_agg(distinct scoped.id) filter (where scoped.id is not null), '{}'::uuid[])
  from scoped;
end;
$$;

revoke all on function public.partner_portal_access_context() from public;
grant execute on function public.partner_portal_access_context() to authenticated;

create or replace function public.partner_portal_scoped_partner_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select c.scoped_partner_ids from public.partner_portal_access_context() c limit 1),
    '{}'::uuid[]
  );
$$;

revoke all on function public.partner_portal_scoped_partner_ids() from public;
grant execute on function public.partner_portal_scoped_partner_ids() to authenticated;

create index if not exists portal_access_identities_active_profile_idx
  on public.portal_access_identities (profile_id)
  where status = 'active';

create index if not exists portal_access_identities_entity_idx
  on public.portal_access_identities (entity_type, entity_id);
