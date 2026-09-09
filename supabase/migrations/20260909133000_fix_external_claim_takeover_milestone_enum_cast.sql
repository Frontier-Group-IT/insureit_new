-- Fix the External Claim Operations takeover snapshot comparison without rewriting
-- the already-applied 20260909121000 migration.
--
-- claim_stage_details.details->>'milestone_key' is text while
-- claim_milestones.milestone_key is public.claim_milestone_key. Cast the enum to
-- text so the duplicate-snapshot guard can execute for real External Claims.

create or replace function public.begin_external_claim_operations_workflow(
  p_claim_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims%rowtype;
  v_now timestamptz := now();
  v_spot_intimation_at timestamptz;
begin
  if auth.uid() is null or p_actor_id is distinct from auth.uid() then
    raise exception 'The Operations user does not match the authenticated user.';
  end if;

  if not public.can_update_claim_status()
     or not public.can_access_claim(auth.uid(), p_claim_id) then
    raise exception 'You do not have permission to manage this claim.';
  end if;

  select *
    into v_claim
    from public.claims
   where id = p_claim_id
   for update;

  if not found then
    raise exception 'Claim not found.';
  end if;

  if v_claim.policy_service_source is distinct from 'external'::public.policy_service_source
     or v_claim.external_policy_id is null then
    raise exception 'Only External Claims can enter the External Operations workflow.';
  end if;

  if v_claim.claim_service_mode = 'broker_managed'::public.claim_service_mode then
    return jsonb_build_object(
      'ok', true,
      'claim_id', v_claim.id,
      'claim_service_mode', 'broker_managed',
      'policy_service_source', 'external',
      'current_status', v_claim.current_status,
      'changed', false
    );
  end if;

  if v_claim.claim_service_mode is distinct from 'self_managed'::public.claim_service_mode then
    raise exception 'This External Claim has an unsupported workflow ownership state.';
  end if;

  -- Preserve every customer-entered milestone as an Operations-readable snapshot.
  -- Canonical Operations writes remain authoritative because these snapshots are
  -- inserted before any later Operations stage detail rows.
  insert into public.claim_stage_details (claim_id, stage, details, created_by)
  select
    cm.claim_id,
    v_claim.current_status,
    coalesce(cm.details, '{}'::jsonb)
      || jsonb_build_object(
        'milestone_key', cm.milestone_key,
        'external_customer_snapshot', true,
        'external_customer_milestone_status', cm.milestone_status,
        'external_customer_snapshot_at', v_now
      ),
    p_actor_id
  from public.claim_milestones cm
  where cm.claim_id = p_claim_id
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
    and not exists (
      select 1
      from public.claim_stage_details csd
      where csd.claim_id = cm.claim_id
        and csd.details->>'milestone_key' = cm.milestone_key::text
        and coalesce((csd.details->>'external_customer_snapshot')::boolean, false)
    );

  select nullif(cm.details->>'spot_intimation_at', '')::timestamptz
    into v_spot_intimation_at
    from public.claim_milestones cm
   where cm.claim_id = p_claim_id
     and cm.milestone_key = 'spot_intimation'
   limit 1;

  update public.claims
     set claim_service_mode = 'broker_managed'::public.claim_service_mode,
         policy_service_source = 'external'::public.policy_service_source,
         spot_intimation_at = coalesce(spot_intimation_at, v_spot_intimation_at),
         assistance_status = case
           when assistance_status = 'requested'::public.claim_assistance_status
             then 'accepted'::public.claim_assistance_status
           else assistance_status
         end,
         assistance_resolved_at = case
           when assistance_status = 'requested'::public.claim_assistance_status then v_now
           else assistance_resolved_at
         end,
         assistance_resolved_by = case
           when assistance_status = 'requested'::public.claim_assistance_status then p_actor_id
           else assistance_resolved_by
         end,
         assigned_to = coalesce(assigned_to, p_actor_id),
         updated_at = v_now
   where id = p_claim_id
     and claim_service_mode = 'self_managed'::public.claim_service_mode
     and policy_service_source = 'external'::public.policy_service_source;

  if not found then
    raise exception 'The External Claim ownership changed before Operations could take control.';
  end if;

  insert into public.claim_status_history (claim_id, from_status, to_status, notes, changed_by)
  values (
    p_claim_id,
    v_claim.current_status,
    v_claim.current_status,
    'External policy claim entered the canonical Operations nine-stage workflow. Customer milestone history was preserved.',
    p_actor_id
  );

  return jsonb_build_object(
    'ok', true,
    'claim_id', p_claim_id,
    'claim_service_mode', 'broker_managed',
    'policy_service_source', 'external',
    'current_status', v_claim.current_status,
    'changed', true
  );
end;
$$;

revoke all on function public.begin_external_claim_operations_workflow(uuid, uuid) from public;
grant execute on function public.begin_external_claim_operations_workflow(uuid, uuid) to authenticated;
