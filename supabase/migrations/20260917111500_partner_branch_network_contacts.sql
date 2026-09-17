create or replace function public.partner_app_branch_network_contacts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_scope_mode text;
  v_partner_id uuid;
  v_result jsonb;
begin
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode = '28000';
  end if;

  v_scope_mode := coalesce(v_scope ->> 'scope_mode', 'none');
  if v_scope_mode <> 'self' then
    return null;
  end if;

  select value::uuid
  into v_partner_id
  from jsonb_array_elements_text(coalesce(v_scope -> 'partner_ids', '[]'::jsonb)) value
  limit 1;

  if v_partner_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'branch_partner', jsonb_build_object(
      'name', p.display_name,
      'phone', p.mobile,
      'email', p.email
    ),
    'branch_group',
      case
        when g.id is null then null
        else jsonb_build_object(
          'name', g.group_name,
          'phone', e.phone,
          'email', e.email
        )
      end
  )
  into v_result
  from public.partners p
  left join public.intermediary_group_memberships m
    on m.partner_id = p.id
   and m.effective_to is null
  left join public.intermediary_groups g
    on g.id = m.group_id
   and g.status = 'active'
  left join public.employees e
    on e.id = g.owner_employee_id
  where p.id = v_partner_id
    and p.partner_status = 'active_partner'
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.partner_app_branch_network_contacts() from public;
grant execute on function public.partner_app_branch_network_contacts() to authenticated;
