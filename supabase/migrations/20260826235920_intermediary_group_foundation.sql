-- Intermediary Group foundation for the commercial hierarchy used by the web portal
-- and the future INSUREIT Partner app.
--
-- A Group is an organizational layer below a sales employee and above a permanent
-- Partner family. Membership attaches to partners(id), not to an individual linked
-- POSP/MISP registration, so a Partner and its linked registration can never be
-- classified into different Groups or double-counted.

create sequence if not exists public.intermediary_group_code_seq start with 1 increment by 1;

create table if not exists public.intermediary_groups (
  id uuid primary key default gen_random_uuid(),
  group_code text not null unique default ('IG-' || lpad(nextval('public.intermediary_group_code_seq')::text, 6, '0')),
  group_name text not null,
  owner_employee_id uuid not null references public.employees(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'archived')),
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete set null,
  constraint intermediary_groups_name_check check (char_length(btrim(group_name)) between 1 and 80),
  constraint intermediary_groups_description_check check (description is null or char_length(description) <= 500),
  constraint intermediary_groups_archive_state_check check (
    (status = 'active' and archived_at is null)
    or status = 'archived'
  )
);

comment on table public.intermediary_groups is
  'Sales-owned organizational containers for permanent Partner families. Groups are not login roles and do not replace intermediary.associate_employee_id ownership.';
comment on column public.intermediary_groups.owner_employee_id is
  'Current sales employee who owns the Group. Active members must have the same current sales owner.';

create unique index if not exists intermediary_groups_owner_name_active_uidx
  on public.intermediary_groups(owner_employee_id, lower(btrim(group_name)))
  where status = 'active';
create index if not exists intermediary_groups_owner_employee_idx
  on public.intermediary_groups(owner_employee_id, status, group_name);

create table if not exists public.intermediary_group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.intermediary_groups(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  removed_by uuid references public.profiles(id) on delete set null,
  change_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intermediary_group_membership_range_check check (
    effective_to is null or effective_to > effective_from
  ),
  constraint intermediary_group_membership_reason_check check (
    change_reason is null or char_length(change_reason) <= 300
  )
);

comment on table public.intermediary_group_memberships is
  'Effective-dated membership of a permanent Partner family in an Intermediary Group. One Partner family may have at most one active Group membership.';

create unique index if not exists intermediary_group_memberships_one_active_partner_uidx
  on public.intermediary_group_memberships(partner_id)
  where effective_to is null;
create index if not exists intermediary_group_memberships_group_active_idx
  on public.intermediary_group_memberships(group_id, partner_id)
  where effective_to is null;
create index if not exists intermediary_group_memberships_partner_history_idx
  on public.intermediary_group_memberships(partner_id, effective_from desc);

create or replace function public.intermediary_group_partner_owner_employee(p_partner_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(parent_intermediary.associate_employee_id, onboarding_profile.associate_employee_id)
  from public.partners partner
  left join public.intermediaries parent_intermediary
    on parent_intermediary.application_id = partner.source_application_id
   and parent_intermediary.intermediary_type = 'partner'
  left join public.posp_misp_onboarding_profiles onboarding_profile
    on onboarding_profile.application_id = partner.source_application_id
  where partner.id = p_partner_id
  limit 1;
$$;

revoke all on function public.intermediary_group_partner_owner_employee(uuid) from public;
revoke all on function public.intermediary_group_partner_owner_employee(uuid) from anon;
revoke all on function public.intermediary_group_partner_owner_employee(uuid) from authenticated;
grant execute on function public.intermediary_group_partner_owner_employee(uuid) to service_role;

create or replace function public.validate_intermediary_group_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_owner uuid;
  v_group_status text;
  v_partner_owner uuid;
begin
  if new.effective_to is not null then
    new.updated_at := now();
    return new;
  end if;

  select owner_employee_id, status
    into v_group_owner, v_group_status
  from public.intermediary_groups
  where id = new.group_id;

  if v_group_owner is null then
    raise exception 'Intermediary Group does not exist.';
  end if;
  if v_group_status <> 'active' then
    raise exception 'Archived Intermediary Groups cannot receive members.';
  end if;

  v_partner_owner := public.intermediary_group_partner_owner_employee(new.partner_id);
  if v_partner_owner is null then
    raise exception 'Partner does not have an assigned sales employee.';
  end if;
  if v_partner_owner <> v_group_owner then
    raise exception 'Partner and Intermediary Group must have the same sales employee owner.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_intermediary_group_membership_trigger
before insert or update of group_id, partner_id, effective_to
on public.intermediary_group_memberships
for each row execute function public.validate_intermediary_group_membership();

create or replace function public.close_group_membership_on_partner_owner_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_skip_close boolean := coalesce(current_setting('insureit.group_transfer', true), '') = 'on';
begin
  if v_skip_close
     or new.intermediary_type <> 'partner'
     or new.associate_employee_id is not distinct from old.associate_employee_id then
    return new;
  end if;

  select partner.id
    into v_partner_id
  from public.partners partner
  where partner.source_application_id = new.application_id
  limit 1;

  if v_partner_id is not null then
    update public.intermediary_group_memberships membership
    set effective_to = now(),
        removed_by = new.updated_by,
        change_reason = coalesce(membership.change_reason, 'Sales employee ownership changed'),
        updated_at = now()
    where membership.partner_id = v_partner_id
      and membership.effective_to is null;
  end if;

  return new;
end;
$$;

create trigger close_group_membership_on_partner_owner_change_trigger
after update of associate_employee_id
on public.intermediaries
for each row execute function public.close_group_membership_on_partner_owner_change();

alter table public.policies
  add column if not exists intermediary_group_id uuid references public.intermediary_groups(id) on delete set null,
  add column if not exists intermediary_group_code text,
  add column if not exists intermediary_group_name text;

comment on column public.policies.intermediary_group_id is
  'Historical Intermediary Group snapshot resolved from the policy source Partner family when the policy is booked/corrected. Existing policies are intentionally not backfilled.';
comment on column public.policies.intermediary_group_code is
  'Immutable Group code snapshot retained for historical reporting even if the Group is later archived.';
comment on column public.policies.intermediary_group_name is
  'Group name snapshot at policy attribution time. Later Group renames do not rewrite historical policy labels.';

create index if not exists policies_intermediary_group_idx
  on public.policies(intermediary_group_id, issuance_date desc);

create or replace function public.sync_policy_intermediary_group_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_group_id uuid;
  v_group_code text;
  v_group_name text;
  v_at timestamptz;
begin
  if tg_op = 'UPDATE'
     and new.intermediary_code is not distinct from old.intermediary_code
     and new.issuance_date is not distinct from old.issuance_date then
    return new;
  end if;

  new.intermediary_group_id := null;
  new.intermediary_group_code := null;
  new.intermediary_group_name := null;

  if nullif(btrim(new.intermediary_code), '') is null then
    return new;
  end if;

  select coalesce(application.partner_record_id, partner.id)
    into v_partner_id
  from public.intermediaries intermediary
  left join public.intermediary_onboarding_applications application
    on application.id = intermediary.application_id
  left join public.partners partner
    on partner.source_application_id = intermediary.application_id
  where intermediary.intermediary_code = new.intermediary_code
  order by (intermediary.account_status = 'active') desc, intermediary.updated_at desc nulls last
  limit 1;

  if v_partner_id is null then
    return new;
  end if;

  v_at := coalesce(new.issuance_date::timestamptz, new.created_at, now());

  select group_row.id, group_row.group_code, group_row.group_name
    into v_group_id, v_group_code, v_group_name
  from public.intermediary_group_memberships membership
  join public.intermediary_groups group_row on group_row.id = membership.group_id
  where membership.partner_id = v_partner_id
    and membership.effective_from <= v_at
    and (membership.effective_to is null or membership.effective_to > v_at)
  order by membership.effective_from desc
  limit 1;

  new.intermediary_group_id := v_group_id;
  new.intermediary_group_code := v_group_code;
  new.intermediary_group_name := v_group_name;
  return new;
end;
$$;

create trigger sync_policy_intermediary_group_snapshot_trigger
before insert or update of intermediary_code, issuance_date
on public.policies
for each row execute function public.sync_policy_intermediary_group_snapshot();

-- Service-mediated write functions. The web portal authenticates and authorizes the
-- employee, then calls these through the server-only service role. Keeping the tables
-- closed to client roles ensures sharing a Group never grants peer-intermediary access.

create or replace function public.service_create_intermediary_group(
  p_owner_employee_id uuid,
  p_group_name text,
  p_description text,
  p_partner_ids uuid[],
  p_actor_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_partner_id uuid;
  v_now timestamptz := now();
begin
  if nullif(btrim(p_group_name), '') is null then
    raise exception 'Group name is required.';
  end if;
  if not exists (
    select 1 from public.employees employee
    where employee.id = p_owner_employee_id and employee.employment_status = 'active'
  ) then
    raise exception 'Group owner must be an active employee.';
  end if;

  insert into public.intermediary_groups (
    group_name, owner_employee_id, description, created_by, updated_by
  ) values (
    btrim(p_group_name), p_owner_employee_id, nullif(btrim(coalesce(p_description, '')), ''), p_actor_profile_id, p_actor_profile_id
  ) returning id into v_group_id;

  foreach v_partner_id in array coalesce(p_partner_ids, '{}'::uuid[]) loop
    if public.intermediary_group_partner_owner_employee(v_partner_id) <> p_owner_employee_id then
      raise exception 'Every selected Partner must belong to the Group owner.';
    end if;

    update public.intermediary_group_memberships
    set effective_to = v_now,
        removed_by = p_actor_profile_id,
        change_reason = 'Moved to ' || btrim(p_group_name),
        updated_at = v_now
    where partner_id = v_partner_id and effective_to is null;

    insert into public.intermediary_group_memberships (
      group_id, partner_id, effective_from, assigned_by, change_reason
    ) values (
      v_group_id, v_partner_id, v_now, p_actor_profile_id, 'Assigned during Group creation'
    );
  end loop;

  insert into public.audit_logs(actor_id, action, table_name, record_id, new_data)
  values (
    p_actor_profile_id,
    'intermediary_group_created',
    'intermediary_groups',
    v_group_id,
    jsonb_build_object('owner_employee_id', p_owner_employee_id, 'member_count', coalesce(array_length(p_partner_ids, 1), 0))
  );

  return v_group_id;
end;
$$;

create or replace function public.service_assign_intermediary_group_members(
  p_group_id uuid,
  p_partner_ids uuid[],
  p_actor_profile_id uuid,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_employee_id uuid;
  v_group_name text;
  v_partner_id uuid;
  v_now timestamptz := now();
  v_count integer := 0;
begin
  select owner_employee_id, group_name
    into v_owner_employee_id, v_group_name
  from public.intermediary_groups
  where id = p_group_id and status = 'active'
  for update;

  if v_owner_employee_id is null then
    raise exception 'Active Intermediary Group not found.';
  end if;

  foreach v_partner_id in array coalesce(p_partner_ids, '{}'::uuid[]) loop
    if public.intermediary_group_partner_owner_employee(v_partner_id) <> v_owner_employee_id then
      raise exception 'Every selected Partner must belong to the Group owner.';
    end if;

    if exists (
      select 1 from public.intermediary_group_memberships
      where partner_id = v_partner_id and group_id = p_group_id and effective_to is null
    ) then
      continue;
    end if;

    update public.intermediary_group_memberships
    set effective_to = v_now,
        removed_by = p_actor_profile_id,
        change_reason = coalesce(nullif(btrim(p_reason), ''), 'Moved to ' || v_group_name),
        updated_at = v_now
    where partner_id = v_partner_id and effective_to is null;

    insert into public.intermediary_group_memberships (
      group_id, partner_id, effective_from, assigned_by, change_reason
    ) values (
      p_group_id, v_partner_id, v_now, p_actor_profile_id, coalesce(nullif(btrim(p_reason), ''), 'Assigned to ' || v_group_name)
    );
    v_count := v_count + 1;
  end loop;

  insert into public.audit_logs(actor_id, action, table_name, record_id, new_data)
  values (
    p_actor_profile_id,
    'intermediary_group_members_assigned',
    'intermediary_groups',
    p_group_id,
    jsonb_build_object('assigned_count', v_count, 'partner_ids', coalesce(to_jsonb(p_partner_ids), '[]'::jsonb))
  );

  return v_count;
end;
$$;

create or replace function public.service_remove_intermediary_group_members(
  p_partner_ids uuid[],
  p_actor_profile_id uuid,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with closed as (
    update public.intermediary_group_memberships
    set effective_to = now(),
        removed_by = p_actor_profile_id,
        change_reason = coalesce(nullif(btrim(p_reason), ''), 'Removed from Intermediary Group'),
        updated_at = now()
    where partner_id = any(coalesce(p_partner_ids, '{}'::uuid[]))
      and effective_to is null
    returning id
  )
  select count(*) into v_count from closed;

  insert into public.audit_logs(actor_id, action, table_name, new_data)
  values (
    p_actor_profile_id,
    'intermediary_group_members_removed',
    'intermediary_group_memberships',
    jsonb_build_object('removed_count', v_count, 'partner_ids', coalesce(to_jsonb(p_partner_ids), '[]'::jsonb))
  );

  return v_count;
end;
$$;

create or replace function public.service_rename_intermediary_group(
  p_group_id uuid,
  p_group_name text,
  p_description text,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(p_group_name), '') is null then
    raise exception 'Group name is required.';
  end if;

  update public.intermediary_groups
  set group_name = btrim(p_group_name),
      description = nullif(btrim(coalesce(p_description, '')), ''),
      updated_by = p_actor_profile_id,
      updated_at = now()
  where id = p_group_id and status = 'active';

  if not found then raise exception 'Active Intermediary Group not found.'; end if;

  insert into public.audit_logs(actor_id, action, table_name, record_id, new_data)
  values (p_actor_profile_id, 'intermediary_group_updated', 'intermediary_groups', p_group_id, jsonb_build_object('group_name', btrim(p_group_name)));
end;
$$;

create or replace function public.service_archive_intermediary_group(
  p_group_id uuid,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.intermediary_group_memberships
    where group_id = p_group_id and effective_to is null
  ) then
    raise exception 'Move or remove active members before archiving this Group.';
  end if;

  update public.intermediary_groups
  set status = 'archived', archived_at = now(), archived_by = p_actor_profile_id,
      updated_by = p_actor_profile_id, updated_at = now()
  where id = p_group_id and status = 'active';

  if not found then raise exception 'Active Intermediary Group not found.'; end if;

  insert into public.audit_logs(actor_id, action, table_name, record_id)
  values (p_actor_profile_id, 'intermediary_group_archived', 'intermediary_groups', p_group_id);
end;
$$;

create or replace function public.service_transfer_intermediary_group(
  p_group_id uuid,
  p_new_owner_employee_id uuid,
  p_actor_profile_id uuid,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_owner uuid;
  v_new_owner_name text;
  v_new_owner_profile_id uuid;
  v_partner_ids uuid[];
  v_application_ids uuid[];
  v_count integer := 0;
begin
  select owner_employee_id into v_old_owner
  from public.intermediary_groups
  where id = p_group_id and status = 'active'
  for update;
  if v_old_owner is null then raise exception 'Active Intermediary Group not found.'; end if;

  select employee.full_name,
         (select profile.id from public.profiles profile where profile.employee_id = employee.id and profile.is_active order by profile.created_at limit 1)
    into v_new_owner_name, v_new_owner_profile_id
  from public.employees employee
  where employee.id = p_new_owner_employee_id and employee.employment_status = 'active';
  if v_new_owner_name is null then raise exception 'New Group owner must be an active employee.'; end if;

  select coalesce(array_agg(membership.partner_id), '{}'::uuid[])
    into v_partner_ids
  from public.intermediary_group_memberships membership
  where membership.group_id = p_group_id and membership.effective_to is null;

  select coalesce(array_agg(application.id), '{}'::uuid[])
    into v_application_ids
  from public.intermediary_onboarding_applications application
  where application.partner_record_id = any(v_partner_ids)
     or application.id in (
       select partner.source_application_id from public.partners partner where partner.id = any(v_partner_ids)
     );

  perform set_config('insureit.group_transfer', 'on', true);

  if array_length(v_application_ids, 1) is not null then
    update public.posp_misp_onboarding_profiles profile
    set associate_employee_id = p_new_owner_employee_id,
        associate_profile_id = v_new_owner_profile_id,
        associate_name = v_new_owner_name,
        updated_by = p_actor_profile_id,
        updated_at = now()
    where profile.application_id = any(v_application_ids);
  end if;

  update public.intermediaries intermediary
  set associate_employee_id = p_new_owner_employee_id,
      associate_profile_id = v_new_owner_profile_id,
      updated_by = p_actor_profile_id,
      updated_at = now()
  where intermediary.application_id = any(v_application_ids)
     or intermediary.application_id in (
       select partner.source_application_id from public.partners partner where partner.id = any(v_partner_ids)
     );

  get diagnostics v_count = row_count;

  update public.intermediary_groups
  set owner_employee_id = p_new_owner_employee_id,
      updated_by = p_actor_profile_id,
      updated_at = now()
  where id = p_group_id;

  insert into public.audit_logs(actor_id, action, table_name, record_id, old_data, new_data)
  values (
    p_actor_profile_id,
    'intermediary_group_transferred',
    'intermediary_groups',
    p_group_id,
    jsonb_build_object('owner_employee_id', v_old_owner),
    jsonb_build_object('owner_employee_id', p_new_owner_employee_id, 'reason', nullif(btrim(p_reason), ''), 'updated_intermediaries', v_count)
  );

  return coalesce(array_length(v_partner_ids, 1), 0);
end;
$$;

-- These tables and mutation functions are intentionally server-mediated for V1.
alter table public.intermediary_groups enable row level security;
alter table public.intermediary_group_memberships enable row level security;

revoke all on public.intermediary_groups from public, anon, authenticated;
revoke all on public.intermediary_group_memberships from public, anon, authenticated;
grant all on public.intermediary_groups to service_role;
grant all on public.intermediary_group_memberships to service_role;
grant usage, select on sequence public.intermediary_group_code_seq to service_role;

revoke all on function public.service_create_intermediary_group(uuid, text, text, uuid[], uuid) from public, anon, authenticated;
revoke all on function public.service_assign_intermediary_group_members(uuid, uuid[], uuid, text) from public, anon, authenticated;
revoke all on function public.service_remove_intermediary_group_members(uuid[], uuid, text) from public, anon, authenticated;
revoke all on function public.service_rename_intermediary_group(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.service_archive_intermediary_group(uuid, uuid) from public, anon, authenticated;
revoke all on function public.service_transfer_intermediary_group(uuid, uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.service_create_intermediary_group(uuid, text, text, uuid[], uuid) to service_role;
grant execute on function public.service_assign_intermediary_group_members(uuid, uuid[], uuid, text) to service_role;
grant execute on function public.service_remove_intermediary_group_members(uuid[], uuid, text) to service_role;
grant execute on function public.service_rename_intermediary_group(uuid, text, text, uuid) to service_role;
grant execute on function public.service_archive_intermediary_group(uuid, uuid) to service_role;
grant execute on function public.service_transfer_intermediary_group(uuid, uuid, uuid, text) to service_role;
