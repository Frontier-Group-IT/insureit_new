begin;

drop function if exists public.partner_app_insert_claim_stage_detail(uuid,public.claim_status,jsonb);

CREATE OR REPLACE FUNCTION public.persist_initial_document_submission_from_stage_details()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_claim public.claims%rowtype;
begin
  if new.stage::text not in ('Initial Documents Submitted', 'Documents Submitted') then
    return new;
  end if;

  if coalesce(new.details->>'milestone_key', '') <> 'spot_intimation' then
    return new;
  end if;

  if auth.uid() is null or new.created_by is distinct from auth.uid() then
    raise exception 'The workflow user does not match the authenticated user.';
  end if;

  if not public.is_operations_role() or not public.can_access_claim(auth.uid(), new.claim_id) then
    raise exception 'You do not have permission to advance this claim stage.';
  end if;

  select *
    into v_claim
    from public.claims
   where id = new.claim_id
     and claim_service_mode = 'broker_managed'
   for update;

  if not found then
    raise exception 'Managed claim not found.';
  end if;

  -- If the direct update already succeeded for this actor, keep the transition idempotent.
  if v_claim.current_status::text in ('Initial Documents Submitted', 'Documents Submitted') then
    return new;
  end if;

  if v_claim.current_status::text not in ('Initial Documents Pending', 'Documents Pending') then
    raise exception 'This claim is not awaiting initial document submission.';
  end if;

  -- Accident Video is optional. The five mandatory categories must be verified.
  if not exists (
    select 1 from public.claim_documents
    where claim_id = new.claim_id
      and verification_status = 'verified'
      and lower(document_type) like any (array['%accident photo%', '%spot photo%', '%spot image%', '%loss photo%', '%vehicle photo%'])
  ) then raise exception 'Accident photo is not verified.'; end if;

  if not exists (
    select 1 from public.claim_documents
    where claim_id = new.claim_id
      and verification_status = 'verified'
      and lower(document_type) like any (array['%rc copy%', '%registration certificate%'])
  ) then raise exception 'RC copy is not verified.'; end if;

  if not exists (
    select 1 from public.claim_documents
    where claim_id = new.claim_id
      and verification_status = 'verified'
      and lower(document_type) like any (array['%insurance copy%', '%policy copy%'])
  ) then raise exception 'Insurance copy is not verified.'; end if;

  if not exists (
    select 1 from public.claim_documents
    where claim_id = new.claim_id
      and verification_status = 'verified'
      and lower(document_type) like any (array['%driver licence%', '%driving licence%', '%driving license%', '%dl copy%'])
  ) then raise exception 'Driver licence is not verified.'; end if;

  if not exists (
    select 1 from public.claim_documents
    where claim_id = new.claim_id
      and verification_status = 'verified'
      and lower(document_type) like any (array['%gr / load bill%', '%gr copy / load challan%', '%gr copy / road challan%', '%gr / load challan%', '%road challan%', '%load challan%'])
  ) then raise exception 'GR / Load Bill is not verified.'; end if;

  update public.claims
     set current_status = 'Initial Documents Submitted'
   where id = new.claim_id
     and current_status = v_claim.current_status;

  if not found then
    raise exception 'The claim status could not be persisted.';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.persist_managed_claim_stage_transition_from_details()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_claim public.claims%rowtype;
  v_stage_key text;
  v_status text;
  v_rows integer := 0;
begin
  v_stage_key := coalesce(new.details->>'milestone_key', '');

  if v_stage_key not in (
    'spot_status',
    'claim_intimation',
    'work_approval',
    'repair_ri',
    'billing',
    'delivery_order',
    'vehicle_delivery',
    'payment_encashment'
  ) then
    return new;
  end if;

  if auth.uid() is null or new.created_by is distinct from auth.uid() then
    raise exception 'The workflow user does not match the authenticated user.';
  end if;

  if not public.is_operations_role() or not public.can_access_claim(auth.uid(), new.claim_id) then
    raise exception 'You do not have permission to update this managed claim stage.';
  end if;

  -- Historical customer milestone snapshots are inserted by the protected
  -- External Claim takeover RPC before claim_service_mode changes to
  -- broker_managed. They are preservation evidence only and must never drive
  -- Operations stage persistence.
  if coalesce((new.details->>'external_customer_snapshot')::boolean, false) then
    return new;
  end if;

  select *
    into v_claim
    from public.claims
   where id = new.claim_id
     and claim_service_mode = 'broker_managed'
   for update;

  if not found then
    raise exception 'Managed claim not found.';
  end if;

  update public.claims
     set insurer_claim_no = case
           when new.details ? 'insurer_claim_no'
             and nullif(btrim(new.details->>'insurer_claim_no'), '') is not null
           then btrim(new.details->>'insurer_claim_no')
           else insurer_claim_no
         end,
         approved_amount = case
           when new.details ? 'approved_amount'
             and nullif(btrim(new.details->>'approved_amount'), '') is not null
           then (new.details->>'approved_amount')::numeric
           else approved_amount
         end,
         settlement_amount = case
           when new.details ? 'payment_received_amount'
             and nullif(btrim(new.details->>'payment_received_amount'), '') is not null
           then (new.details->>'payment_received_amount')::numeric
           else settlement_amount
         end
   where id = new.claim_id;

  if v_claim.policy_service_source::text = 'external'
     and not (new.details ? 'completed_at') then
    return new;
  end if;

  v_status := v_claim.current_status::text;

  if v_stage_key = 'spot_status'
     and v_status in (
       'Initial Documents Submitted',
       'Initial Documents Verification Pending',
       'Documents Submitted',
       'Initial Documents Verified',
       'Claim Intimated',
       'Surveyor Appointed'
     ) then
    update public.claims set current_status = 'Final Documents Awaited'
     where id = new.claim_id and current_status::text = v_status;

  elsif v_stage_key = 'claim_intimation'
     and v_status in (
       'Vehicle Inspected',
       'Spot Survey Completed',
       'Final Documents Awaited',
       'Final Documents Verification Pending',
       'Final Documents Submitted',
       'Final Documents Verified',
       'Claim Intimation',
       'Final Surveyor Details',
       'Survey Status'
     ) then
    update public.claims set current_status = 'Survey Done'
     where id = new.claim_id and current_status::text = v_status;

  elsif v_stage_key = 'work_approval'
     and v_status in ('Survey Done', 'Estimate Submitted', 'Approval Pending', 'Work Approval Status') then
    update public.claims set current_status = 'Work Approval Received'
     where id = new.claim_id and current_status::text = v_status;

  elsif v_stage_key = 'repair_ri'
     and v_status in ('Work Approval Received', 'Under Repair', 'Repair Started', 'Repair Done', 'Repair Completed', 'RA Intimation') then
    update public.claims set current_status = 'RA Intimation Done'
     where id = new.claim_id and current_status::text = v_status;

  elsif v_stage_key = 'billing'
     and v_status = 'RA Intimation Done' then
    update public.claims set current_status = 'Final Bill Submitted'
     where id = new.claim_id and current_status::text = v_status;

  elsif v_stage_key = 'delivery_order'
     and v_status in ('Final Bill Submitted', 'DO Status') then
    update public.claims set current_status = 'DO Submitted'
     where id = new.claim_id and current_status::text = v_status;

  elsif v_stage_key = 'vehicle_delivery'
     and v_status = 'DO Submitted' then
    update public.claims set current_status = 'Payment Stage'
     where id = new.claim_id and current_status::text = v_status;

  elsif v_stage_key = 'payment_encashment'
     and v_status in ('Payment Stage', 'Claim Completion In Progress', 'Settlement Under Process') then
    update public.claims set current_status = 'Claim Complete'
     where id = new.claim_id and current_status::text = v_status;

  else
    return new;
  end if;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'The claim stage could not be persisted.';
  end if;

  return new;
end;
$function$;

commit;
