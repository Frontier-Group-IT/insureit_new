create or replace function public.partner_app_branch_network_contacts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_partner_ids jsonb;
  v_branch_id uuid;
  v_result jsonb;
begin
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode = '28000';
  end if;

  if coalesce(v_scope ->> 'scope_mode', 'none') <> 'self' then
    return null;
  end if;

  v_partner_ids := coalesce(v_scope -> 'partner_ids', '[]'::jsonb);
  if jsonb_array_length(v_partner_ids) <> 1 then
    return null;
  end if;

  select value::uuid
  into v_branch_id
  from jsonb_array_elements_text(v_partner_ids) value
  limit 1;

  select jsonb_build_object(
    'branch_partner',
      case
        when parent_partner.id is null then null
        else jsonb_build_object(
          'name', parent_partner.display_name,
          'phone', parent_partner.mobile,
          'email', parent_partner.email
        )
      end,
    'branch_group',
      case
        when parent_group.id is null then null
        else jsonb_build_object(
          'name', parent_group.group_name,
          'phone', group_owner.phone,
          'email', group_owner.email
        )
      end
  )
  into v_result
  from public.partners branch_partner
  join public.partners parent_partner
    on parent_partner.id = branch_partner.parent_partner_id
   and parent_partner.partner_status = 'active_partner'
  left join public.intermediary_group_memberships parent_membership
    on parent_membership.partner_id = parent_partner.id
   and parent_membership.effective_to is null
  left join public.intermediary_groups parent_group
    on parent_group.id = parent_membership.group_id
   and parent_group.status = 'active'
  left join public.employees group_owner
    on group_owner.id = parent_group.owner_employee_id
  where branch_partner.id = v_branch_id
    and branch_partner.partner_status = 'active_partner'
    and branch_partner.parent_partner_id is not null
  order by parent_membership.effective_from desc nulls last
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.partner_app_branch_network_contacts() from public;
grant execute on function public.partner_app_branch_network_contacts() to authenticated;
