create or replace function public.partner_app_customer_detail(p_customer_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_result jsonb;
begin
  if not public.partner_app_customer_in_scope(p_customer_id) then
    raise exception 'Customer is not available in this Partner scope' using errcode='42501';
  end if;

  with base as (
    select
      c.id,
      c.customer_code,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as customer_name,
      c.company_name,
      c.contact_name,
      c.phone,
      c.email,
      c.city,
      c.state,
      c.customer_type,
      c.fleet_size_band,
      c.status,
      c.created_at,
      i.intermediary_type,
      i.intermediary_code
    from public.customers c
    left join public.intermediaries i on i.id=c.lead_source_intermediary_id
    where c.id=p_customer_id
  ),
  policy_rows as (
    select
      p.id,
      p.vehicle_id,
      p.policy_no,
      p.policy_code,
      p.policy_type,
      p.policy_product,
      p.end_date,
      coalesce(prem.gross_premium,p.premium_amount,0) as premium_amount,
      ic.name as insurer_name,
      v.vehicle_no
    from public.policies p
    left join public.insurance_companies ic on ic.id=p.insurance_company_id
    left join public.vehicles v on v.id=p.vehicle_id
    left join lateral (
      select ppd.gross_premium
      from public.policy_premium_details ppd
      where ppd.policy_id=p.id
      order by ppd.updated_at desc,ppd.created_at desc
      limit 1
    ) prem on true
    where p.customer_id=p_customer_id
      and public.partner_app_policy_in_scope(p.id)
    order by coalesce(p.end_date,current_date) desc
    limit 25
  ),
  vehicle_rows as (
    select
      v.id,
      v.vehicle_no,
      v.vehicle_type,
      v.make,
      v.model,
      v.year,
      v.fitness_expiry_date,
      v.puc_expiry_date,
      v.road_tax_expiry_date,
      v.national_permit_expiry_date,
      v.local_permit_expiry_date
    from public.vehicles v
    where v.customer_id=p_customer_id
    order by v.vehicle_no
    limit 25
  ),
  claim_rows as (
    select
      cl.id,
      cl.vehicle_id,
      cl.policy_id,
      cl.claim_no,
      cl.current_status::text as current_status,
      cl.created_at,
      v.vehicle_no,
      ic.name as insurer_name
    from public.claims cl
    left join public.vehicles v on v.id=cl.vehicle_id
    left join public.insurance_companies ic on ic.id=cl.insurance_company_id
    where cl.customer_id=p_customer_id
      and public.partner_app_claim_in_scope(cl.id)
    order by cl.created_at desc
    limit 25
  ),
  counts as (
    select
      (
        select count(*)::int
        from public.policies p
        where p.customer_id=p_customer_id
          and public.partner_app_policy_in_scope(p.id)
      ) as policies,
      (
        select count(*)::int
        from public.vehicles v
        where v.customer_id=p_customer_id
      ) as vehicles,
      (
        select count(*)::int
        from public.claims cl
        where cl.customer_id=p_customer_id
          and public.partner_app_claim_in_scope(cl.id)
      ) as claims,
      (
        select count(*)::int
        from public.policies p
        where p.customer_id=p_customer_id
          and p.end_date between current_date and current_date+30
          and public.partner_app_policy_in_scope(p.id)
      ) as renewals_30_days
  )
  select jsonb_build_object(
    'customer',jsonb_build_object(
      'id',b.id,
      'customer_code',b.customer_code,
      'customer_name',b.customer_name,
      'company_name',b.company_name,
      'contact_name',b.contact_name,
      'phone',b.phone,
      'email',b.email,
      'city',b.city,
      'state',b.state,
      'customer_type',b.customer_type,
      'fleet_size_band',b.fleet_size_band,
      'status',b.status,
      'created_at',b.created_at,
      'intermediary_type',b.intermediary_type,
      'intermediary_code',b.intermediary_code
    ),
    'summary',jsonb_build_object(
      'policies',cnt.policies,
      'vehicles',cnt.vehicles,
      'claims',cnt.claims,
      'renewals_30_days',cnt.renewals_30_days
    ),
    'policies',coalesce((
      select jsonb_agg(jsonb_build_object(
        'policy_id',id,
        'vehicle_id',vehicle_id,
        'policy_no',policy_no,
        'policy_code',policy_code,
        'policy_type',policy_type,
        'policy_product',policy_product,
        'end_date',end_date,
        'premium_amount',premium_amount,
        'insurer_name',insurer_name,
        'vehicle_no',vehicle_no
      ) order by end_date desc nulls last)
      from policy_rows
    ),'[]'::jsonb),
    'vehicles',coalesce((
      select jsonb_agg(jsonb_build_object(
        'vehicle_id',id,
        'vehicle_no',vehicle_no,
        'vehicle_type',vehicle_type,
        'make',make,
        'model',model,
        'year',year,
        'fitness_expiry_date',fitness_expiry_date,
        'puc_expiry_date',puc_expiry_date,
        'road_tax_expiry_date',road_tax_expiry_date,
        'national_permit_expiry_date',national_permit_expiry_date,
        'local_permit_expiry_date',local_permit_expiry_date
      ) order by vehicle_no)
      from vehicle_rows
    ),'[]'::jsonb),
    'claims',coalesce((
      select jsonb_agg(jsonb_build_object(
        'claim_id',id,
        'vehicle_id',vehicle_id,
        'policy_id',policy_id,
        'claim_no',claim_no,
        'current_status',current_status,
        'created_at',created_at,
        'vehicle_no',vehicle_no,
        'insurer_name',insurer_name
      ) order by created_at desc)
      from claim_rows
    ),'[]'::jsonb)
  )
  into v_result
  from base b
  cross join counts cnt;

  return v_result;
end;
$function$;
