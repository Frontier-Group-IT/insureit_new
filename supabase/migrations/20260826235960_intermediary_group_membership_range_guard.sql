-- Preserve strict effective-dated Intermediary Group membership history even when
-- a membership is moved or removed immediately after it is created.
--
-- The table invariant is effective_to IS NULL OR effective_to > effective_from.
-- Use the same one-microsecond minimum close interval already used by the
-- ownership-change triggers and Group creation move path.

create or replace function public.service_assign_intermediary_group_members(
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

    update public.intermediary_group_memberships membership
    set effective_to = greatest(v_now, membership.effective_from + interval '1 microsecond'),
        removed_by = p_actor_profile_id,
        change_reason = coalesce(nullif(btrim(p_reason), ''), 'Moved to ' || v_group_name),
        updated_at = v_now
    where membership.partner_id = v_partner_id and membership.effective_to is null;

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
$function$;

create or replace function public.service_remove_intermediary_group_members(
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
  v_now timestamptz := now();
  v_count integer;
begin
  with closed as (
    update public.intermediary_group_memberships membership
    set effective_to = greatest(v_now, membership.effective_from + interval '1 microsecond'),
        removed_by = p_actor_profile_id,
        change_reason = coalesce(nullif(btrim(p_reason), ''), 'Removed from Intermediary Group'),
        updated_at = v_now
    where membership.partner_id = any(coalesce(p_partner_ids, '{}'::uuid[]))
      and membership.effective_to is null
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
$function$;

-- Keep the service-only RPC boundary explicit after CREATE OR REPLACE.
revoke all on function public.service_assign_intermediary_group_members(uuid, uuid[], uuid, text) from public, anon, authenticated;
grant execute on function public.service_assign_intermediary_group_members(uuid, uuid[], uuid, text) to service_role;

revoke all on function public.service_remove_intermediary_group_members(uuid[], uuid, text) from public, anon, authenticated;
grant execute on function public.service_remove_intermediary_group_members(uuid[], uuid, text) to service_role;
