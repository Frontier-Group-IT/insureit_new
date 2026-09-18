begin;

create or replace function public.partner_app_vehicle_detail(p_vehicle_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_actor_kind text;
  v_scope_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_result jsonb;
begin
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_actor_kind := v_scope->>'actor_kind';
  v_scope_mode := coalesce(v_scope->>'scope_mode','none');

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;

  with scoped_policies as (
    select p.id, p.vehicle_id
    from public.policies p
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    where p.vehicle_id=p_vehicle_id
      and case
        when v_scope_mode='none' then false
        when v_actor_kind='intermediary' then i.id=any(v_intermediary_ids)
        when v_actor_kind='employee' and v_scope_mode='organization' then true
        when v_actor_kind='employee' then
          p.rm_employee_id=any(v_employee_ids)
          or i.id=any(v_intermediary_ids)
          or (p.intermediary_group_id is not null and p.intermediary_group_id=any(v_group_ids))
        else false
      end
  ),
  vehicle_row as (
    select
      v.id,
      v.customer_id,
      v.vehicle_no,
      v.vehicle_type,
      v.make,
      v.model,
      v.year,
      v.registration_status,
      v.registration_date,
      v.chassis_no,
      v.engine_no,
      v.fuel_type,
      v.gvw_kg,
      v.fitness_expiry_date,
      v.puc_expiry_date,
      v.road_tax_expiry_date,
      v.national_permit_expiry_date,
      v.local_permit_expiry_date,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as customer_name
    from public.vehicles v
    left join public.customers c on c.id=v.customer_id
    where v.id=p_vehicle_id
      and exists (select 1 from scoped_policies sp where sp.vehicle_id=v.id)
  ),
  activity as (
    select
      (select count(distinct sp.id)::int from scoped_policies sp) as policies,
      (
        select count(*)::int
        from public.claims cl
        where cl.vehicle_id=p_vehicle_id
          and public.partner_app_claim_in_scope(cl.id)
      ) as claims
  )
  select jsonb_build_object(
    'vehicle', jsonb_build_object(
      'vehicle_id', vr.id,
      'customer_id', vr.customer_id,
      'vehicle_no', vr.vehicle_no,
      'vehicle_type', vr.vehicle_type,
      'make', vr.make,
      'model', vr.model,
      'year', vr.year,
      'registration_status', vr.registration_status,
      'registration_date', vr.registration_date,
      'chassis_no', vr.chassis_no,
      'engine_no', vr.engine_no,
      'fuel_type', vr.fuel_type,
      'gvw_kg', vr.gvw_kg,
      'fitness_expiry_date', vr.fitness_expiry_date,
      'puc_expiry_date', vr.puc_expiry_date,
      'road_tax_expiry_date', vr.road_tax_expiry_date,
      'national_permit_expiry_date', vr.national_permit_expiry_date,
      'local_permit_expiry_date', vr.local_permit_expiry_date
    ),
    'customer', jsonb_build_object(
      'customer_id', vr.customer_id,
      'customer_name', vr.customer_name
    ),
    'activity', jsonb_build_object(
      'policies', a.policies,
      'claims', a.claims
    )
  )
  into v_result
  from vehicle_row vr
  cross join activity a;

  if v_result is null then
    raise exception 'Vehicle is not available in this Partner scope' using errcode='42501';
  end if;

  return v_result;
end;
$$;

revoke all on function public.partner_app_vehicle_detail(uuid) from public, anon;
grant execute on function public.partner_app_vehicle_detail(uuid) to authenticated, service_role;

commit;
