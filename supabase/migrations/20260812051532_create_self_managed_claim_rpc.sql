create or replace function public.create_self_managed_claim(
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_policy_id uuid,
  p_insurance_company_id uuid,
  p_accident_at timestamptz,
  p_driver_name text default null,
  p_driver_phone text default null,
  p_location text default null
)
returns table (claim_id uuid, claim_no text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_claim public.claims%rowtype;
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if public.current_app_role() <> 'customer'::public.app_role then
    raise exception 'Only customer accounts can create self-managed claims.' using errcode = '42501';
  end if;

  if p_accident_at is null then
    raise exception 'Accident date and time are required.' using errcode = '22023';
  end if;

  if p_accident_at > v_now then
    raise exception 'Accident date and time cannot be in the future.' using errcode = '22023';
  end if;

  if p_insurance_company_id is null then
    raise exception 'Insurance company is required for an external policy.' using errcode = '22023';
  end if;

  if not public.can_access_customer(v_user_id, p_customer_id) then
    raise exception 'Customer account is not accessible.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.customer_id = p_customer_id
  ) then
    raise exception 'Vehicle does not belong to the selected customer account.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.policies p
    where p.id = p_policy_id and p.customer_id = p_customer_id and p.vehicle_id = p_vehicle_id
  ) then
    raise exception 'Policy does not belong to the selected vehicle.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.insurance_companies ic where ic.id = p_insurance_company_id
  ) then
    raise exception 'Insurance company is not valid.' using errcode = '22023';
  end if;

  insert into public.claims (
    claim_no,
    customer_id,
    vehicle_id,
    policy_id,
    insurance_company_id,
    current_status,
    accident_at,
    accident_location,
    accident_description,
    created_by,
    policy_service_source,
    claim_service_mode,
    assistance_status,
    self_management_acknowledged_at,
    self_management_acknowledged_by
  ) values (
    '',
    p_customer_id,
    p_vehicle_id,
    p_policy_id,
    p_insurance_company_id,
    'Accident Reported'::public.claim_status,
    p_accident_at,
    nullif(btrim(coalesce(p_location, '')), ''),
    'Customer self-managed external-policy claim tracking.',
    v_user_id,
    'external'::public.policy_service_source,
    'self_managed'::public.claim_service_mode,
    'not_requested'::public.claim_assistance_status,
    v_now,
    v_user_id
  )
  returning * into v_claim;

  insert into public.claim_milestones (
    claim_id,
    milestone_key,
    milestone_status,
    details,
    completed_at,
    recorded_by,
    recorded_by_actor
  ) values (
    v_claim.id,
    'spot_intimation'::public.claim_milestone_key,
    'completed'::public.claim_milestone_status,
    jsonb_strip_nulls(jsonb_build_object(
      'accident_at', p_accident_at,
      'insurance_company_id', p_insurance_company_id,
      'driver_name', nullif(btrim(coalesce(p_driver_name, '')), ''),
      'driver_phone', nullif(btrim(coalesce(p_driver_phone, '')), ''),
      'location', nullif(btrim(coalesce(p_location, '')), ''),
      'vehicle_id', p_vehicle_id,
      'policy_id', p_policy_id
    )),
    v_now,
    v_user_id,
    'customer'::public.claim_milestone_actor
  );

  return query select v_claim.id, v_claim.claim_no;
end;
$$;

revoke all on function public.create_self_managed_claim(uuid, uuid, uuid, uuid, timestamptz, text, text, text) from public;
revoke all on function public.create_self_managed_claim(uuid, uuid, uuid, uuid, timestamptz, text, text, text) from anon;
grant execute on function public.create_self_managed_claim(uuid, uuid, uuid, uuid, timestamptz, text, text, text) to authenticated;
