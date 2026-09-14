-- Reversible safety helper for the business Group hierarchy.
-- This does not run automatically. It provides an explicit, audited path to
-- return a business Group to the legacy employee-linked mode when every
-- current root Partner already belongs to the selected employee.

create or replace function public.service_revert_business_intermediary_group_to_legacy(
  p_group_id uuid,
  p_owner_employee_id uuid,
  p_actor_profile_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_group_mode text;
  v_partner_id uuid;
begin
  if not exists (
    select 1
    from public.employees employee
    where employee.id = p_owner_employee_id
      and employee.employment_status = 'active'
  ) then
    raise exception 'Legacy Group owner must be an active employee.';
  end if;

  select group_mode
    into v_group_mode
  from public.intermediary_groups
  where id = p_group_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'Active Intermediary Group not found.';
  end if;

  if v_group_mode = 'legacy_employee' then
    return;
  end if;

  for v_partner_id in
    select membership.partner_id
    from public.intermediary_group_memberships membership
    where membership.group_id = p_group_id
      and membership.effective_to is null
  loop
    if public.intermediary_group_partner_owner_employee(v_partner_id) is distinct from p_owner_employee_id then
      raise exception 'Every current Group Partner must already belong to the selected employee before reverting to legacy mode.';
    end if;
  end loop;

  update public.intermediary_groups
  set group_mode = 'legacy_employee',
      owner_employee_id = p_owner_employee_id,
      updated_by = p_actor_profile_id,
      updated_at = now()
  where id = p_group_id;

  insert into public.audit_logs(actor_id, action, table_name, record_id, old_data, new_data)
  values (
    p_actor_profile_id,
    'business_intermediary_group_reverted_to_legacy',
    'intermediary_groups',
    p_group_id,
    jsonb_build_object('group_mode', 'business', 'owner_employee_id', null),
    jsonb_build_object(
      'group_mode', 'legacy_employee',
      'owner_employee_id', p_owner_employee_id,
      'reason', nullif(btrim(coalesce(p_reason, '')), '')
    )
  );
end;
$function$;
