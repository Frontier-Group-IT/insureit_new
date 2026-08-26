-- Integrity follow-up for the Intermediary Group foundation.
-- Repository migration only; this file is not applied by creating the PR.

-- Archived Groups must carry an archive timestamp; active Groups must not.
alter table public.intermediary_groups
  drop constraint if exists intermediary_groups_archive_state_check;

alter table public.intermediary_groups
  add constraint intermediary_groups_archive_state_check check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  );

-- Keep the membership history valid even when an ownership change occurs in the
-- same transaction timestamp as an assignment.
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
    set effective_to = greatest(now(), membership.effective_from + interval '1 microsecond'),
        removed_by = new.updated_by,
        change_reason = coalesce(membership.change_reason, 'Sales employee ownership changed'),
        updated_at = now()
    where membership.partner_id = v_partner_id
      and membership.effective_to is null;
  end if;

  return new;
end;
$$;

-- Some existing onboarding flows can update the authoritative associate on the
-- Partner onboarding profile before/without touching the parent intermediary row.
-- Mirror the same safety rule there so an active Group can never remain owned by
-- a different sales employee.
create or replace function public.close_group_membership_on_partner_profile_owner_change()
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
      and membership.effective_to is null;
  end if;

  return new;
end;
$$;

drop trigger if exists close_group_membership_on_partner_profile_owner_change_trigger
  on public.posp_misp_onboarding_profiles;

create trigger close_group_membership_on_partner_profile_owner_change_trigger
after update of associate_employee_id
on public.posp_misp_onboarding_profiles
for each row execute function public.close_group_membership_on_partner_profile_owner_change();

-- The current web action already de-duplicates selected IDs, but the database RPC
-- is a shared contract for the future INSUREIT Partner app as well. De-duplicate at
-- the database boundary so repeated IDs can never create zero-length history rows.
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

  for v_partner_id in
    select distinct candidate.partner_id
    from unnest(coalesce(p_partner_ids, '{}'::uuid[])) as candidate(partner_id)
  loop
    if public.intermediary_group_partner_owner_employee(v_partner_id) <> p_owner_employee_id then
      raise exception 'Every selected Partner must belong to the Group owner.';
    end if;

    update public.intermediary_group_memberships membership
    set effective_to = greatest(v_now, membership.effective_from + interval '1 microsecond'),
        removed_by = p_actor_profile_id,
        change_reason = 'Moved to ' || btrim(p_group_name),
        updated_at = v_now
    where membership.partner_id = v_partner_id
      and membership.effective_to is null;

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
    jsonb_build_object(
      'owner_employee_id', p_owner_employee_id,
      'member_count', (
        select count(*)
        from (
          select distinct candidate.partner_id
          from unnest(coalesce(p_partner_ids, '{}'::uuid[])) as candidate(partner_id)
        ) distinct_partners
      )
    )
  );

  return v_group_id;
end;
$$;

revoke all on function public.close_group_membership_on_partner_profile_owner_change() from public, anon, authenticated;
revoke all on function public.service_create_intermediary_group(uuid, text, text, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.service_create_intermediary_group(uuid, text, text, uuid[], uuid) to service_role;
