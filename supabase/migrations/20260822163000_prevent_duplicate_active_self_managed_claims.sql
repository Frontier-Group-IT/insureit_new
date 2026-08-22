-- Prevent a customer from creating more than one active self-tracked claim
-- for the same external policy. Completed/settled historical claims remain
-- eligible for a later claim under the same policy.
--
-- The external policy row is locked before the duplicate check so concurrent
-- requests for the same policy serialize and cannot both create a claim.

create or replace function public.create_self_managed_external_claim(
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_external_policy_id uuid,
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
  v_policy public.external_policies;
  v_claim public.claims;
  v_details jsonb;
  v_existing_active_claim_id uuid;
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
  from public.external_policies ep
  where ep.id = p_external_policy_id
    and ep.customer_id = p_customer_id
    and ep.vehicle_id = p_vehicle_id
  for update;

  if not found then
    raise exception 'Select a valid external policy for this vehicle.';
  end if;

  select c.id into v_existing_active_claim_id
  from public.claims c
  where c.external_policy_id = v_policy.id
    and c.customer_id = p_customer_id
    and c.vehicle_id = p_vehicle_id
    and c.claim_service_mode = 'self_managed'::public.claim_service_mode
    and coalesce(c.current_status::text, '') not in ('Settled', 'Closed', 'Claim Complete')
    and (
      select count(distinct cm.milestone_key)
      from public.claim_milestones cm
      where cm.claim_id = c.id
        and cm.milestone_key in (
          'spot_intimation',
          'spot_status',
          'claim_intimation',
          'work_approval',
          'repair_ri',
          'billing',
          'delivery_order',
          'vehicle_delivery',
          'payment_encashment'
        )
        and cm.milestone_status in ('completed', 'not_applicable')
    ) < 9
  order by c.created_at desc
  limit 1;

  if v_existing_active_claim_id is not null then
    raise exception using
      errcode = 'P0001',
      message = 'An active claim already exists for this policy.';
  end if;

  v_details := jsonb_strip_nulls(jsonb_build_object(
    'accident_at', p_accident_at,
    'driver_name', nullif(btrim(coalesce(p_driver_name, '')), ''),
    'driver_phone', nullif(btrim(coalesce(p_driver_phone, '')), ''),
    'location', nullif(btrim(coalesce(p_location, '')), ''),
    'external_policy_id', v_policy.id,
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
    null,
    v_policy.id,
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
  ) returning * into v_claim;

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

revoke all on function public.create_self_managed_external_claim(uuid, uuid, uuid, timestamptz, text, text, text) from public;
revoke all on function public.create_self_managed_external_claim(uuid, uuid, uuid, timestamptz, text, text, text) from anon;
grant execute on function public.create_self_managed_external_claim(uuid, uuid, uuid, timestamptz, text, text, text) to authenticated;
