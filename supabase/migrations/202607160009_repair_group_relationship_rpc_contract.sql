-- Ensure the live database has the Group hierarchy RPC contract used by the portal.
-- Safe to run after partial rollouts of the earlier Group relationship migrations.

alter table public.customer_relationships
  add column if not exists status text not null default 'active',
  add column if not exists effective_from timestamptz not null default now(),
  add column if not exists effective_to timestamptz,
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now();

update public.customer_relationships
set
  status = case when is_active then 'active' else 'inactive' end,
  updated_at = coalesce(updated_at, now())
where status is distinct from case when is_active then 'active' else 'inactive' end
   or updated_at is null;

alter table public.customer_relationships
  drop constraint if exists customer_relationships_status_check;

alter table public.customer_relationships
  add constraint customer_relationships_status_check
  check (status in ('active', 'inactive', 'ended'));

do $$
declare
  constraint_name text;
begin
  select con.conname
    into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'customer_relationships'
    and con.contype = 'u'
    and (
      select array_agg(att.attname::text order by key.ordinality)
      from unnest(con.conkey) with ordinality as key(attnum, ordinality)
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = key.attnum
    ) = array['parent_customer_id', 'child_customer_id', 'relationship_type']
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.customer_relationships drop constraint %I', constraint_name);
  end if;
end;
$$;

with ranked_relationships as (
  select
    id,
    row_number() over (
      partition by child_customer_id
      order by effective_from desc nulls last, updated_at desc nulls last, created_at desc nulls last, id desc
    ) as active_rank
  from public.customer_relationships
  where relationship_type = 'group_member'
    and is_active
    and status = 'active'
)
update public.customer_relationships relationship
set
  status = 'ended',
  is_active = false,
  effective_to = coalesce(relationship.effective_to, now()),
  updated_at = now()
from ranked_relationships ranked
where relationship.id = ranked.id
  and ranked.active_rank > 1;

create unique index if not exists customer_relationships_one_active_group_per_child
  on public.customer_relationships(child_customer_id)
  where relationship_type = 'group_member'
    and is_active
    and status = 'active';

create index if not exists customer_relationships_active_group_parent_idx
  on public.customer_relationships(parent_customer_id, child_customer_id)
  where relationship_type = 'group_member'
    and is_active
    and status = 'active';

create or replace function public.validate_group_customer_relationship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_type text;
  parent_status text;
  child_type text;
  child_status text;
begin
  if new.relationship_type <> 'group_member' then
    return new;
  end if;

  if new.parent_customer_id = new.child_customer_id then
    raise exception 'A Group cannot be linked to itself.';
  end if;

  select partner_type::text, onboarding_status
    into parent_type, parent_status
  from public.customers
  where id = new.parent_customer_id;

  select partner_type::text, onboarding_status
    into child_type, child_status
  from public.customers
  where id = new.child_customer_id;

  if parent_type is distinct from 'group' then
    raise exception 'Only an active Group customer can be selected as the parent.';
  end if;

  if child_type not in ('corporate', 'individual_proprietor', 'dealership') then
    raise exception 'Only Corporate, Individual/Proprietor or Dealership customers can be linked below a Group.';
  end if;

  if coalesce(parent_status, '') <> 'active' then
    raise exception 'The selected Group customer is not active.';
  end if;

  if coalesce(child_status, '') <> 'active' then
    raise exception 'The selected child customer is not active.';
  end if;

  new.is_active := new.status = 'active';
  new.updated_at := now();

  if new.status = 'active' then
    new.effective_to := null;
    new.effective_from := coalesce(new.effective_from, now());
  elsif new.effective_to is null then
    new.effective_to := now();
  end if;

  return new;
end;
$$;

drop trigger if exists validate_group_customer_relationship_trigger
  on public.customer_relationships;

create trigger validate_group_customer_relationship_trigger
before insert or update on public.customer_relationships
for each row execute function public.validate_group_customer_relationship();

create or replace function public.assert_group_relationship_manager(actor_profile_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  if actor_profile_id is null then
    raise exception 'A reviewer profile is required to manage Group affiliations.';
  end if;

  select role::text into actor_role
  from public.profiles
  where id = actor_profile_id;

  if actor_role not in (
    'super_admin', 'admin', 'manager', 'it_super_user',
    'sales_operations_head', 'backoffice_executive'
  ) then
    raise exception 'You are not allowed to manage Group affiliations.';
  end if;
end;
$$;

revoke all on function public.assert_group_relationship_manager(uuid) from public;

drop function if exists public.link_customer_to_group(uuid, uuid);
drop function if exists public.unlink_customer_from_group(uuid);

create or replace function public.link_customer_to_group(
  p_group_customer_id uuid,
  p_child_customer_id uuid,
  p_actor_profile_id uuid
)
returns public.customer_relationships
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.customer_relationships;
begin
  perform public.assert_group_relationship_manager(p_actor_profile_id);
  perform pg_advisory_xact_lock(hashtextextended(p_child_customer_id::text, 0));

  update public.customer_relationships
  set
    status = 'ended',
    is_active = false,
    effective_to = coalesce(effective_to, now()),
    updated_at = now()
  where child_customer_id = p_child_customer_id
    and relationship_type = 'group_member'
    and is_active
    and status = 'active';

  insert into public.customer_relationships (
    parent_customer_id,
    child_customer_id,
    relationship_type,
    is_active,
    status,
    effective_from,
    effective_to,
    created_by,
    approved_by,
    updated_at
  ) values (
    p_group_customer_id,
    p_child_customer_id,
    'group_member',
    true,
    'active',
    now(),
    null,
    p_actor_profile_id,
    p_actor_profile_id,
    now()
  )
  returning * into result;

  return result;
end;
$$;

create or replace function public.unlink_customer_from_group(
  p_child_customer_id uuid,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_group_relationship_manager(p_actor_profile_id);
  perform pg_advisory_xact_lock(hashtextextended(p_child_customer_id::text, 0));

  update public.customer_relationships
  set
    status = 'ended',
    is_active = false,
    effective_to = coalesce(effective_to, now()),
    updated_at = now(),
    approved_by = coalesce(approved_by, p_actor_profile_id)
  where child_customer_id = p_child_customer_id
    and relationship_type = 'group_member'
    and is_active
    and status = 'active';
end;
$$;

revoke all on function public.link_customer_to_group(uuid, uuid, uuid) from public;
revoke all on function public.unlink_customer_from_group(uuid, uuid) from public;
grant execute on function public.link_customer_to_group(uuid, uuid, uuid) to authenticated;
grant execute on function public.unlink_customer_from_group(uuid, uuid) to authenticated;
grant execute on function public.link_customer_to_group(uuid, uuid, uuid) to service_role;
grant execute on function public.unlink_customer_from_group(uuid, uuid) to service_role;
