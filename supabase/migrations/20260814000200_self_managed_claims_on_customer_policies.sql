-- Production integration for customer-added policies stored in public.policies.
-- Existing/legacy policy rows with policy_service_source IS NULL keep the
-- current Sankalp-managed behavior. Only explicit 'external' policies are
-- eligible for the self-managed customer claim flow.

create or replace function public.create_self_managed_policy_claim(
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_policy_id uuid,
  p_accident_at timestamptz,
  p_driver_name text default null,
  p_driver_phone text default null,
  p_location text default null
)
returns table(claim_id uuid, claim_no text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.policies;
  v_claim public.claims;
  v_details jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_customer_id is null or not public.can_access_customer(p_customer_id) then
    raise exception 'You do not have access to create a claim for this customer.';
  end if;

  if p_accident_at is null then
    raise exception 'Accident date and time are required.';
  end if;

  if p_accident_at > now() then
    raise exception 'Accident date and time cannot be in the future.';
  end if;

  select * into v_policy
  from public.policies policy
  where policy.id = p_policy_id
    and policy.customer_id = p_customer_id
    and policy.vehicle_id = p_vehicle_id
    and policy.policy_service_source = 'external'::public.policy_service_source;

  if not found then
    raise exception 'Select a valid customer-added policy for this vehicle.';
  end if;

  v_details := jsonb_strip_nulls(jsonb_build_object(
    'accident_at', p_accident_at,
    'driver_name', nullif(btrim(coalesce(p_driver_name, '')), ''),
    'driver_phone', nullif(btrim(coalesce(p_driver_phone, '')), ''),
    'location', nullif(btrim(coalesce(p_location, '')), ''),
    'policy_id', v_policy.id,
    'policy_no', v_policy.policy_no,
    'insurance_company_id', v_policy.insurance_company_id
  ));

  insert into public.claims (
    claim_no,
    customer_id,
    vehicle_id,
    policy_id,
    external_policy_id,
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
    null,
    p_customer_id,
    p_vehicle_id,
    v_policy.id,
    null,
    v_policy.insurance_company_id,
    'Accident Reported',
    p_accident_at,
    nullif(btrim(coalesce(p_location, '')), ''),
    null,
    auth.uid(),
    'external',
    'self_managed',
    'not_requested',
    now(),
    auth.uid()
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
    'spot_intimation',
    'completed',
    v_details,
    now(),
    auth.uid(),
    'customer'
  );

  return query select v_claim.id, v_claim.claim_no;
end;
$$;

revoke all on function public.create_self_managed_policy_claim(uuid, uuid, uuid, timestamptz, text, text, text) from public;
revoke all on function public.create_self_managed_policy_claim(uuid, uuid, uuid, timestamptz, text, text, text) from anon;
grant execute on function public.create_self_managed_policy_claim(uuid, uuid, uuid, timestamptz, text, text, text) to authenticated;

create or replace function public.request_claim_assistance(
  p_claim_id uuid,
  p_note text default null
)
returns public.claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_claim
  from public.claims
  where id = p_claim_id;

  if v_claim.id is null or not public.can_access_customer(v_claim.customer_id) then
    raise exception 'Claim not available.';
  end if;

  if v_claim.policy_id is null
     or v_claim.policy_service_source is distinct from 'external'::public.policy_service_source
     or v_claim.claim_service_mode <> 'self_managed'::public.claim_service_mode then
    raise exception 'Assistance can only be requested for a self-tracked customer policy claim.';
  end if;

  if v_claim.current_status::text in ('Settled', 'Closed') then
    raise exception 'This claim is already settled.';
  end if;

  if v_claim.assistance_status = 'accepted'::public.claim_assistance_status then
    raise exception 'Sankalp assistance has already been accepted for this claim.';
  end if;

  if v_claim.assistance_status = 'requested'::public.claim_assistance_status then
    raise exception 'Assistance has already been requested for this claim.';
  end if;

  update public.claims
  set assistance_status = 'requested',
      assistance_requested_at = now(),
      assistance_requested_by = auth.uid(),
      assistance_resolved_at = null,
      assistance_resolved_by = null,
      assistance_notes = nullif(btrim(coalesce(p_note, '')), ''),
      updated_at = now()
  where id = p_claim_id
  returning * into v_claim;

  return v_claim;
end;
$$;

revoke all on function public.request_claim_assistance(uuid, text) from public;
revoke all on function public.request_claim_assistance(uuid, text) from anon;
grant execute on function public.request_claim_assistance(uuid, text) to authenticated;

-- Preserve the existing milestone validation/financial behavior while making
-- the terminal customer state Settled. A pending assistance request is
-- automatically closed because no further claim handling is required.
create or replace function public.finalize_self_managed_claim_if_complete(p_claim_id uuid)
returns public.claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims;
  v_completed_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_claim from public.claims where id = p_claim_id;
  if v_claim.id is null or not public.can_access_customer(v_claim.customer_id) then
    raise exception 'Claim not available.';
  end if;

  if v_claim.claim_service_mode <> 'self_managed'::public.claim_service_mode then
    raise exception 'Only self-managed claims can be finalized here.';
  end if;

  select count(*) into v_completed_count
  from public.claim_milestones
  where claim_id = p_claim_id
    and milestone_key in (
      'spot_intimation','spot_status','claim_intimation','work_approval',
      'repair_ri','billing','delivery_order','vehicle_delivery','payment_encashment'
    )
    and milestone_status in ('completed','not_applicable');

  if v_completed_count <> 9 then
    return v_claim;
  end if;

  update public.claims
  set current_status = 'Settled',
      assistance_status = case
        when assistance_status = 'requested'::public.claim_assistance_status
          then 'cancelled'::public.claim_assistance_status
        else assistance_status
      end,
      assistance_resolved_at = case
        when assistance_status = 'requested'::public.claim_assistance_status
          then now()
        else assistance_resolved_at
      end,
      updated_at = now()
  where id = p_claim_id
  returning * into v_claim;

  return v_claim;
end;
$$;

revoke all on function public.finalize_self_managed_claim_if_complete(uuid) from public;
revoke all on function public.finalize_self_managed_claim_if_complete(uuid) from anon;
grant execute on function public.finalize_self_managed_claim_if_complete(uuid) to authenticated;
