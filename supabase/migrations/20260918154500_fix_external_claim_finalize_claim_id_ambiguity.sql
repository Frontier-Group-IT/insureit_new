-- Fix External Claim Stage 1 finalization failure caused by PL/pgSQL output-column ambiguity.
--
-- finalize_self_managed_external_claim_draft() RETURNS TABLE(claim_id, claim_no).
-- In PL/pgSQL those output names are variables, so the previous
--   ON CONFLICT (claim_id, milestone_key)
-- could resolve "claim_id" ambiguously between the output variable and
-- public.claim_milestones.claim_id.
--
-- Keep the function contract and workflow unchanged; target the existing
-- named UNIQUE constraint instead.

create or replace function public.finalize_self_managed_external_claim_draft(
  p_claim_id uuid,
  p_accident_at timestamptz,
  p_spot_intimation_at timestamptz,
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
  v_claim public.claims%rowtype;
  v_policy public.external_policies%rowtype;
  v_details jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_accident_at is null then
    raise exception 'Accident date and time are required.';
  end if;

  if p_spot_intimation_at is null then
    raise exception 'Spot Intimation date and time are required.';
  end if;

  if p_accident_at > now() then
    raise exception 'Accident date and time cannot be in the future.';
  end if;

  if p_spot_intimation_at > now() then
    raise exception 'Spot Intimation date and time cannot be in the future.';
  end if;

  if p_spot_intimation_at < p_accident_at then
    raise exception 'Spot Intimation date and time cannot be earlier than Accident date and time.';
  end if;

  select *
    into v_claim
    from public.claims c
   where c.id = p_claim_id
   for update;

  if not found
     or not public.can_access_customer(v_claim.customer_id)
     or v_claim.policy_service_source is distinct from 'external'::public.policy_service_source
     or v_claim.claim_service_mode is distinct from 'self_managed'::public.claim_service_mode
     or v_claim.external_policy_id is null then
    raise exception 'External claim draft is not available.';
  end if;

  if v_claim.current_status is distinct from 'Draft'::public.claim_status then
    raise exception 'This External Claim has already been started.';
  end if;

  select *
    into v_policy
    from public.external_policies ep
   where ep.id = v_claim.external_policy_id
     and ep.customer_id = v_claim.customer_id
     and ep.vehicle_id = v_claim.vehicle_id;

  if not found then
    raise exception 'The external policy linked to this claim is no longer available.';
  end if;

  v_details := jsonb_strip_nulls(jsonb_build_object(
    'incident_at', p_accident_at,
    'spot_intimation_at', p_spot_intimation_at,
    'driver_name', nullif(btrim(coalesce(p_driver_name, '')), ''),
    'driver_phone', nullif(btrim(coalesce(p_driver_phone, '')), ''),
    'location', nullif(btrim(coalesce(p_location, '')), ''),
    'external_policy_id', v_policy.id,
    'policy_no', v_policy.policy_no,
    'insurance_company_id', v_policy.insurance_company_id
  ));

  update public.claims
     set current_status = 'Accident Reported'::public.claim_status,
         accident_at = p_accident_at,
         accident_location = nullif(btrim(coalesce(p_location, '')), ''),
         accident_description = null,
         insurance_company_id = v_policy.insurance_company_id,
         self_management_acknowledged_at = coalesce(self_management_acknowledged_at, now()),
         self_management_acknowledged_by = coalesce(self_management_acknowledged_by, auth.uid()),
         updated_at = now()
   where id = v_claim.id
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
    v_details,
    now(),
    auth.uid(),
    'customer'::public.claim_milestone_actor
  )
  on conflict on constraint claim_milestones_claim_key_unique do update
    set milestone_status = 'completed'::public.claim_milestone_status,
        details = excluded.details,
        completed_at = coalesce(public.claim_milestones.completed_at, excluded.completed_at),
        recorded_by = excluded.recorded_by,
        recorded_by_actor = excluded.recorded_by_actor,
        updated_at = now();

  return query select v_claim.id, v_claim.claim_no;
end;
$$;

revoke all on function public.finalize_self_managed_external_claim_draft(uuid, timestamptz, timestamptz, text, text, text) from public;
revoke all on function public.finalize_self_managed_external_claim_draft(uuid, timestamptz, timestamptz, text, text, text) from anon;
grant execute on function public.finalize_self_managed_external_claim_draft(uuid, timestamptz, timestamptz, text, text, text) to authenticated;

comment on function public.finalize_self_managed_external_claim_draft(uuid, timestamptz, timestamptz, text, text, text) is
  'Finalizes an External Claim upload Draft into Accident Reported and completes Spot Intimation using validated customer-entered Stage 1 details. Uses the named milestone uniqueness constraint to avoid PL/pgSQL claim_id ambiguity.';
