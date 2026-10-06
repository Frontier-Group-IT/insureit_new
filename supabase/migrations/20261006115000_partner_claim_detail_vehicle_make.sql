begin;

create or replace function public.partner_app_claim_detail(p_claim_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_result jsonb;
begin
  if not public.partner_app_claim_in_scope(p_claim_id) then
    raise exception 'Claim is not available in this Partner scope' using errcode='42501';
  end if;

  with base as (
    select
      cl.*,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as customer_name,
      c.customer_code,
      v.vehicle_no,
      v.make as vehicle_make,
      ep.policy_no,
      ic.name as insurer_name
    from public.claims cl
    join public.customers c on c.id=cl.customer_id
    left join public.vehicles v on v.id=cl.vehicle_id
    left join public.external_policies ep on ep.id=cl.external_policy_id
    left join public.insurance_companies ic on ic.id=cl.insurance_company_id
    where cl.id=p_claim_id
  ),
  history as (
    select
      h.id,
      h.from_status::text as from_status,
      h.to_status::text as to_status,
      h.created_at
    from public.claim_status_history h
    where h.claim_id=p_claim_id
    order by h.created_at
  ),
  stages as (
    select
      s.id,
      s.stage::text as stage,
      s.created_at
    from public.claim_stage_details s
    where s.claim_id=p_claim_id
    order by s.created_at
  )
  select jsonb_build_object(
    'claim',jsonb_build_object(
      'id',b.id,
      'claim_no',b.claim_no,
      'insurer_claim_no',b.insurer_claim_no,
      'current_status',b.current_status::text,
      'claim_service_mode',b.claim_service_mode::text,
      'assistance_status',b.assistance_status::text,
      'accident_at',b.accident_at,
      'accident_location',b.accident_location,
      'estimated_loss',b.estimated_loss,
      'approved_amount',b.approved_amount,
      'settlement_amount',b.settlement_amount,
      'created_at',b.created_at,
      'updated_at',b.updated_at
    ),
    'customer',jsonb_build_object(
      'id',b.customer_id,
      'name',b.customer_name,
      'customer_code',b.customer_code
    ),
    'vehicle',jsonb_build_object(
      'id',b.vehicle_id,
      'vehicle_no',b.vehicle_no,
      'make',b.vehicle_make
    ),
    'policy',jsonb_build_object(
      'policy_no',b.policy_no
    ),
    'insurer',jsonb_build_object(
      'name',b.insurer_name
    ),
    'status_history',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',id,
        'from_status',from_status,
        'to_status',to_status,
        'created_at',created_at
      ) order by created_at)
      from history
    ),'[]'::jsonb),
    'stages',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',id,
        'stage',stage,
        'created_at',created_at
      ) order by created_at)
      from stages
    ),'[]'::jsonb)
  )
  into v_result
  from base b;

  return v_result;
end;
$$;

revoke all on function public.partner_app_claim_detail(uuid) from public, anon;
grant execute on function public.partner_app_claim_detail(uuid) to authenticated, service_role;

commit;
