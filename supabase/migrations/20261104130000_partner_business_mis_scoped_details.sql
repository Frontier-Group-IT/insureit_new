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
  if exists (
    select 1 from unnest(p_policy_ids) as input(policy_id)
    where not coalesce(public.partner_app_policy_in_scope(input.policy_id),false)
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
