-- Business Group hierarchy foundation
--
-- Safety model:
-- - Existing Group IDs, memberships and employee assignments are preserved.
-- - Existing Groups remain legacy_employee until explicitly converted.
-- - New business Groups have no employee owner.
-- - Branches are existing Partner records linked by a nullable parent_partner_id.
-- - No production data is backfilled or deleted by this migration.

begin;

alter table public.intermediary_groups
  add column if not exists group_mode text not null default 'legacy_employee';

alter table public.intermediary_groups
  drop constraint if exists intermediary_groups_group_mode_check;

alter table public.intermediary_groups
  add constraint intermediary_groups_group_mode_check
  check (group_mode in ('legacy_employee', 'business'));

alter table public.intermediary_groups
  alter column owner_employee_id drop not null;

alter table public.intermediary_groups
  drop constraint if exists intermediary_groups_owner_mode_check;

alter table public.intermediary_groups
  add constraint intermediary_groups_owner_mode_check
  check (
    (group_mode = 'legacy_employee' and owner_employee_id is not null)
    or
    (group_mode = 'business' and owner_employee_id is null)
  );

create unique index if not exists intermediary_groups_business_name_active_uidx
  on public.intermediary_groups (lower(btrim(group_name)))
  where status = 'active' and group_mode = 'business';

alter table public.partners
  add column if not exists parent_partner_id uuid null;

alter table public.partners
  drop constraint if exists partners_parent_partner_id_fkey;

alter table public.partners
  add constraint partners_parent_partner_id_fkey
  foreign key (parent_partner_id)
  references public.partners(id)
  on delete restrict;

alter table public.partners
  drop constraint if exists partners_not_own_parent_check;

alter table public.partners
  add constraint partners_not_own_parent_check
  check (parent_partner_id is null or parent_partner_id <> id);

create index if not exists partners_parent_partner_idx
  on public.partners(parent_partner_id)
  where parent_partner_id is not null;

create or replace function public.validate_partner_branch_parent()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_parent_parent_id uuid;
begin
  if new.parent_partner_id is null then
    return new;
  end if;

  if new.parent_partner_id = new.id then
    raise exception 'A Partner cannot be its own Branch parent.';
  end if;

  select parent_partner_id
    into v_parent_parent_id
  from public.partners
  where id = new.parent_partner_id
    and partner_status = 'active_partner';

  if not found then
    raise exception 'Branch parent must be an active Partner.';
  end if;

  if v_parent_parent_id is not null then
    raise exception 'A Branch cannot be used as a parent Partner.';
  end if;

  if exists (
    select 1
    from public.partners child
    where child.parent_partner_id = new.id
      and child.id <> new.id
  ) then
    raise exception 'A Partner with Branches cannot itself become a Branch.';
  end if;

  if exists (
    select 1
    from public.intermediary_group_memberships membership
    where membership.partner_id = new.id
      and membership.effective_to is null
  ) then
    raise exception 'Remove the Partner from its direct Group before assigning it as a Branch.';
  end if;

  return new;
end;
$function$;

drop trigger if exists validate_partner_branch_parent_trigger on public.partners;
create trigger validate_partner_branch_parent_trigger
before insert or update of parent_partner_id on public.partners
for each row
execute function public.validate_partner_branch_parent();

create or replace function public.validate_intermediary_group_membership()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_group_owner uuid;
  v_group_status text;
  v_group_mode text;
  v_partner_owner uuid;
  v_parent_partner_id uuid;
begin
  if new.effective_to is not null then
    new.updated_at := now();
    return new;
  end if;

  select owner_employee_id, status, group_mode
    into v_group_owner, v_group_status, v_group_mode
  from public.intermediary_groups
  where id = new.group_id;

  if not found then
    raise exception 'Intermediary Group does not exist.';
  end if;
  if v_group_status <> 'active' then
    raise exception 'Archived Intermediary Groups cannot receive members.';
  end if;

  select parent_partner_id
    into v_parent_partner_id
  from public.partners
  where id = new.partner_id
    and partner_status = 'active_partner';

  if not found then
    raise exception 'Group membership requires an active Partner.';
  end if;
  if v_parent_partner_id is not null then
    raise exception 'Only a root Partner can be assigned directly to a Group. Branches inherit their parent Partner Group.';
  end if;

  if coalesce(v_group_mode, 'legacy_employee') = 'legacy_employee' then
    if v_group_owner is null then
      raise exception 'Legacy Intermediary Group requires an employee owner.';
    end if;

    v_partner_owner := public.intermediary_group_partner_owner_employee(new.partner_id);
    if v_partner_owner is null then
      raise exception 'Partner does not have an assigned sales employee.';
    end if;
    if v_partner_owner <> v_group_owner then
      raise exception 'Partner and legacy Intermediary Group must have the same sales employee owner.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

create or replace function public.close_group_membership_on_partner_owner_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    set effective_to = greatest(now(), membership.effective_from + interval '1 microsecond'),
        removed_by = new.updated_by,
        change_reason = coalesce(membership.change_reason, 'Sales employee ownership changed'),
        updated_at = now()
    where membership.partner_id = v_partner_id
      and membership.effective_to is null
      and exists (
        select 1
        from public.intermediary_groups group_row
        where group_row.id = membership.group_id
          and coalesce(group_row.group_mode, 'legacy_employee') = 'legacy_employee'
      );
  end if;

  return new;
end;
$function$;

create or replace function public.close_group_membership_on_partner_profile_owner_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_partner_id uuid;
  v_skip_close boolean := coalesce(current_setting('insureit.group_transfer', true), '') = 'on';
begin
  if v_skip_close
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
    set effective_to = greatest(now(), membership.effective_from + interval '1 microsecond'),
        removed_by = new.updated_by,
        change_reason = coalesce(membership.change_reason, 'Sales employee ownership changed'),
        updated_at = now()
    where membership.partner_id = v_partner_id
      and membership.effective_to is null
      and exists (
        select 1
        from public.intermediary_groups group_row
        where group_row.id = membership.group_id
          and coalesce(group_row.group_mode, 'legacy_employee') = 'legacy_employee'
      );
  end if;

  return new;
end;
$function$;

create or replace function public.service_create_business_intermediary_group(
  p_group_name text,
  p_description text,
  p_partner_ids uuid[],
  p_actor_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_group_id uuid;
  v_partner_id uuid;
  v_now timestamptz := now();
begin
  if nullif(btrim(p_group_name), '') is null then
    raise exception 'Group name is required.';
  end if;

  insert into public.intermediary_groups (
    group_name,
    group_mode,
    owner_employee_id,
    description,
    created_by,
    updated_by
  ) values (
    btrim(p_group_name),
    'business',
    null,
    nullif(btrim(coalesce(p_description, '')), ''),
    p_actor_profile_id,
    p_actor_profile_id
  )
  returning id into v_group_id;

  for v_partner_id in
    select distinct candidate.partner_id
    from unnest(coalesce(p_partner_ids, '{}'::uuid[])) as candidate(partner_id)
  loop
    if not exists (
      select 1
      from public.partners partner
      where partner.id = v_partner_id
        and partner.partner_status = 'active_partner'
        and partner.parent_partner_id is null
    ) then
      raise exception 'Only an active root Partner can be assigned directly to a business Group.';
    end if;

    update public.intermediary_group_memberships membership
    set effective_to = greatest(v_now, membership.effective_from + interval '1 microsecond'),
        removed_by = p_actor_profile_id,
        change_reason = 'Moved to business Group ' || btrim(p_group_name),
        updated_at = v_now
    where membership.partner_id = v_partner_id
      and membership.effective_to is null;

    insert into public.intermediary_group_memberships (
      group_id,
      partner_id,
      effective_from,
      assigned_by,
      change_reason
    ) values (
      v_group_id,
      v_partner_id,
      v_now,
      p_actor_profile_id,
      'Assigned during business Group creation'
    );
  end loop;

  insert into public.audit_logs(actor_id, action, table_name, record_id, new_data)
  values (
    p_actor_profile_id,
    'business_intermediary_group_created',
    'intermediary_groups',
    v_group_id,
    jsonb_build_object(
      'group_mode', 'business',
      'member_count', (
        select count(*)
        from (
          select distinct candidate.partner_id
          from unnest(coalesce(p_partner_ids, '{}'::uuid[])) as candidate(partner_id)
        ) members
      )
    )
  );

  return v_group_id;
end;
$function$;

create or replace function public.service_assign_business_intermediary_group_members(
  p_group_id uuid,
  p_partner_ids uuid[],
  p_actor_profile_id uuid,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_group_name text;
  v_partner_id uuid;
  v_now timestamptz := now();
  v_count integer := 0;
begin
  select group_name
    into v_group_name
  from public.intermediary_groups
  where id = p_group_id
    and status = 'active'
    and group_mode = 'business'
  for update;

  if not found then
    raise exception 'Active business Group not found.';
  end if;

  foreach v_partner_id in array coalesce(p_partner_ids, '{}'::uuid[]) loop
    if not exists (
      select 1
      from public.partners partner
      where partner.id = v_partner_id
        and partner.partner_status = 'active_partner'
        and partner.parent_partner_id is null
    ) then
      raise exception 'Only an active root Partner can be assigned directly to a business Group.';
    end if;

    if exists (
      select 1
      from public.intermediary_group_memberships membership
      where membership.partner_id = v_partner_id
        and membership.group_id = p_group_id
        and membership.effective_to is null
    ) then
      continue;
    end if;

    update public.intermediary_group_memberships membership
    set effective_to = greatest(v_now, membership.effective_from + interval '1 microsecond'),
        removed_by = p_actor_profile_id,
        change_reason = coalesce(nullif(btrim(p_reason), ''), 'Moved to ' || v_group_name),
        updated_at = v_now
    where membership.partner_id = v_partner_id
      and membership.effective_to is null;

    insert into public.intermediary_group_memberships (
      group_id,
      partner_id,
      effective_from,
      assigned_by,
      change_reason
    ) values (
      p_group_id,
      v_partner_id,
      v_now,
      p_actor_profile_id,
      coalesce(nullif(btrim(p_reason), ''), 'Assigned to ' || v_group_name)
    );

    v_count := v_count + 1;
  end loop;

  insert into public.audit_logs(actor_id, action, table_name, record_id, new_data)
  values (
    p_actor_profile_id,
    'business_intermediary_group_members_assigned',
    'intermediary_groups',
    p_group_id,
    jsonb_build_object('assigned_count', v_count, 'partner_ids', coalesce(to_jsonb(p_partner_ids), '[]'::jsonb))
  );

  return v_count;
end;
$function$;

create or replace function public.service_convert_intermediary_group_to_business(
  p_group_id uuid,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_old_owner uuid;
  v_old_mode text;
begin
  select owner_employee_id, group_mode
    into v_old_owner, v_old_mode
  from public.intermediary_groups
  where id = p_group_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'Active Intermediary Group not found.';
  end if;

  if v_old_mode = 'business' then
    return;
  end if;

  update public.intermediary_groups
  set group_mode = 'business',
      owner_employee_id = null,
      updated_by = p_actor_profile_id,
      updated_at = now()
  where id = p_group_id;

  insert into public.audit_logs(actor_id, action, table_name, record_id, old_data, new_data)
  values (
    p_actor_profile_id,
    'intermediary_group_converted_to_business',
    'intermediary_groups',
    p_group_id,
    jsonb_build_object('group_mode', v_old_mode, 'owner_employee_id', v_old_owner),
    jsonb_build_object('group_mode', 'business', 'owner_employee_id', null)
  );
end;
$function$;

create or replace function public.service_assign_partner_branch(
  p_parent_partner_id uuid,
  p_branch_partner_id uuid,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_parent_partner_id = p_branch_partner_id then
    raise exception 'A Partner cannot be its own Branch parent.';
  end if;

  if not exists (
    select 1
    from public.partners parent
    where parent.id = p_parent_partner_id
      and parent.partner_status = 'active_partner'
      and parent.parent_partner_id is null
  ) then
    raise exception 'Branch parent must be an active root Partner.';
  end if;

  if not exists (
    select 1
    from public.partners branch
    where branch.id = p_branch_partner_id
      and branch.partner_status = 'active_partner'
      and branch.parent_partner_id is null
  ) then
    raise exception 'Branch profile must be an active root Partner before assignment.';
  end if;

  if exists (
    select 1
    from public.partners child
    where child.parent_partner_id = p_branch_partner_id
  ) then
    raise exception 'A Partner that already owns Branches cannot itself become a Branch.';
  end if;

  if exists (
    select 1
    from public.intermediary_group_memberships membership
    where membership.partner_id = p_branch_partner_id
      and membership.effective_to is null
  ) then
    raise exception 'Remove the Partner from its direct Group before assigning it as a Branch.';
  end if;

  update public.partners
  set parent_partner_id = p_parent_partner_id,
      updated_at = now()
  where id = p_branch_partner_id;

  insert into public.audit_logs(actor_id, action, table_name, record_id, new_data)
  values (
    p_actor_profile_id,
    'partner_branch_assigned',
    'partners',
    p_branch_partner_id,
    jsonb_build_object('parent_partner_id', p_parent_partner_id)
  );
end;
$function$;

create or replace function public.service_remove_partner_branch(
  p_branch_partner_id uuid,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_old_parent uuid;
begin
  select parent_partner_id
    into v_old_parent
  from public.partners
  where id = p_branch_partner_id
  for update;

  if not found then
    raise exception 'Branch Partner not found.';
  end if;
  if v_old_parent is null then
    return;
  end if;

  update public.partners
  set parent_partner_id = null,
      updated_at = now()
  where id = p_branch_partner_id;

  insert into public.audit_logs(actor_id, action, table_name, record_id, old_data, new_data)
  values (
    p_actor_profile_id,
    'partner_branch_removed',
    'partners',
    p_branch_partner_id,
    jsonb_build_object('parent_partner_id', v_old_parent),
    jsonb_build_object('parent_partner_id', null)
  );
end;
$function$;

create or replace function public.sync_policy_intermediary_group_snapshot()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_partner_id uuid;
  v_root_partner_id uuid;
  v_group_id uuid;
  v_group_code text;
  v_group_name text;
  v_at timestamptz;
begin
  if tg_op = 'UPDATE'
     and new.intermediary_code is not distinct from old.intermediary_code then
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

  select coalesce(partner.parent_partner_id, partner.id)
    into v_root_partner_id
  from public.partners partner
  where partner.id = v_partner_id;

  v_root_partner_id := coalesce(v_root_partner_id, v_partner_id);

  v_at := case
    when tg_op = 'INSERT' then coalesce(new.created_at, now())
    else now()
  end;

  select group_row.id, group_row.group_code, group_row.group_name
    into v_group_id, v_group_code, v_group_name
  from public.intermediary_group_memberships membership
  join public.intermediary_groups group_row on group_row.id = membership.group_id
  where membership.partner_id = v_root_partner_id
    and membership.effective_from <= v_at
    and (membership.effective_to is null or membership.effective_to > v_at)
  order by membership.effective_from desc
  limit 1;

  new.intermediary_group_id := v_group_id;
  new.intermediary_group_code := v_group_code;
  new.intermediary_group_name := v_group_name;
  return new;
end;
$function$;

comment on column public.intermediary_groups.group_mode is
  'legacy_employee preserves the historical employee-owned behavior; business is the canonical employee-independent Group -> Partner -> Branch hierarchy.';

comment on column public.partners.parent_partner_id is
  'Nullable self-reference used only for the business hierarchy: a Branch Partner points to its root Partner. Group membership remains on the root Partner.';

commit;
