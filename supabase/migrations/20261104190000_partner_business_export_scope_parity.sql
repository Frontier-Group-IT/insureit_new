-- Align only the Partner Business MIS export authorization with the existing
-- partner_app_list_policies source. Keep the exact 35-field non-commercial
-- payload, per-request max 100 IDs, and existing SQL function privileges.
-- Never relax canonical branch restrictions or bypass individual policy checks.
-- The Partner Business MIS may show only the 35 non-commercial Operations columns.
-- This function accepts a bounded set of policy IDs from the authenticated Partner
-- policy list, and RECHECKS every ID against canonical account scope before reading.
-- It never exposes insurer commissions, partner payouts, TDS or retention.
create or replace function public.partner_app_export_policy_details(p_policy_ids uuid[])
returns table(policy_id uuid, detail jsonb)
language plpgsql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_scope jsonb;
  v_is_branch_login boolean := false;
  v_actor_kind text;
  v_scope_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_partner_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_policy_ids is null or cardinality(p_policy_ids) = 0 then
    return;
  end if;
  if cardinality(p_policy_ids) > 100 or array_position(p_policy_ids, null) is not null then
    raise exception 'Invalid export batch' using errcode='22023';
  end if;
  -- The export MUST use exactly the access logic of partner_app_list_policies.
  -- The older partner_app_policy_in_scope helper omits canonical branch logins
  -- and partner_id relationships, so it rejects policies visible in the list.
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;
  v_is_branch_login := exists (
    select 1 from public.portal_access_identities a
    where a.profile_id=auth.uid() and a.entity_type='branch'
  ) or exists (
    select 1 from public.partner_branch_login_links l
    where l.profile_id=auth.uid()
  );
  v_actor_kind := v_scope->>'actor_kind';
  v_scope_mode := coalesce(v_scope->>'scope_mode','none');
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;

  -- Fail closed for every missing or unauthorized policy. Never trust a
  -- policy ID merely because the caller sent it or it appeared in a URL.
  if exists (
    select 1
    from unnest(p_policy_ids) as requested(policy_id)
    left join public.policies scoped_policy on scoped_policy.id=requested.policy_id
    left join public.intermediaries scoped_intermediary
      on scoped_intermediary.intermediary_code=scoped_policy.intermediary_code
    where scoped_policy.id is null or not (
      case
        when v_is_branch_login then exists (
          select 1 from public.partner_branch_authorized_policy_ids() authorized
          where authorized.policy_id=scoped_policy.id
        )
        when v_scope_mode='none' then false
        when v_actor_kind='intermediary' then (
          scoped_intermediary.id=any(v_intermediary_ids)
          or exists (
            select 1 from public.partners scoped_partner
            where scoped_partner.id=any(v_partner_ids)
              and scoped_partner.partner_code=scoped_policy.intermediary_code
          )
        )
        when v_actor_kind='employee' and v_scope_mode='organization' then true
        when v_actor_kind='employee' then (
          scoped_policy.rm_employee_id=any(v_employee_ids)
          or scoped_intermediary.id=any(v_intermediary_ids)
          or (scoped_policy.intermediary_group_id is not null
              and scoped_policy.intermediary_group_id=any(v_group_ids))
        )
        else false
      end
    )
  ) then
    raise exception 'Policy is not available in this Partner scope' using errcode='42501';
  end if;

  return query
  select p.id,
    jsonb_build_object(
      'lead_source', p.lead_source,
      'insured_declared_value', p.insured_declared_value,
      'customers', case when c.id is null then null else jsonb_build_object(
        'contact_name', c.contact_name,
        'phone', c.phone
      ) end,
      'vehicles', case when v.id is null then null else jsonb_build_object(
        'vehicle_no', v.vehicle_no,
        'vehicle_class_code', v.vehicle_class_code,
        'vehicle_class_description', v.vehicle_class_description,
        'make', v.make, 'model', v.model, 'fuel_type', v.fuel_type,
        'gvw_kg', v.gvw_kg, 'engine_capacity_cc', v.engine_capacity_cc,
        'seating_capacity', v.seating_capacity, 'year', v.year,
        'chassis_no', v.chassis_no, 'engine_no', v.engine_no,
        'rto_state', v.rto_state, 'rto_name', v.rto_name
      ) end,
      'policy_premium_details', case when ppd.policy_id is null then null else jsonb_build_object(
        'od_premium', ppd.od_premium,
        'add_on_premium', ppd.add_on_premium,
        'tp_premium', ppd.tp_premium,
        'cpa_amount', ppd.cpa_amount,
        'net_premium', ppd.net_premium,
        'gst_amount', ppd.gst_amount,
        'gross_premium', ppd.gross_premium
      ) end
    ) as detail
  from public.policies p
  left join public.customers c on c.id=p.customer_id
  left join public.vehicles v on v.id=p.vehicle_id
  left join lateral (
    select x.policy_id,x.od_premium,x.add_on_premium,x.tp_premium,
           x.cpa_amount,x.net_premium,x.gst_amount,x.gross_premium
    from public.policy_premium_details x
    where x.policy_id=p.id
    order by x.updated_at desc,x.created_at desc
    limit 1
  ) ppd on true
  where p.id=any(p_policy_ids);
end;
$function$;

revoke all on function public.partner_app_export_policy_details(uuid[]) from public, anon, authenticated;
grant execute on function public.partner_app_export_policy_details(uuid[]) to authenticated;
