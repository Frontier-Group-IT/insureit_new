-- Persist managed-claim Operations stage transitions through the already-authorized
-- claim_stage_details insert. This avoids authenticated UPDATEs to claims being
-- silently filtered by RLS while preserving one authoritative current_status.

create or replace function public.persist_managed_claim_stage_transition_from_details()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  select *
    into v_claim
    from public.claims
   where id = new.claim_id
     and claim_service_mode = 'broker_managed'
   for update;

  if not found then
    raise exception 'Managed claim not found.';
  end if;

  -- Keep authoritative claim summary fields synchronized from the same stage-detail
  -- write. These updates also need the SECURITY DEFINER path because ordinary
  -- authenticated claims UPDATEs can be RLS-filtered.
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
    update public.claims
       set current_status = 'Final Documents Awaited'
     where id = new.claim_id
       and current_status::text = v_status;

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
    update public.claims
       set current_status = 'Survey Done'
     where id = new.claim_id
       and current_status::text = v_status;

  elsif v_stage_key = 'work_approval'
     and v_status in ('Survey Done', 'Estimate Submitted', 'Approval Pending', 'Work Approval Status') then
    update public.claims
       set current_status = 'Work Approval Received'
     where id = new.claim_id
       and current_status::text = v_status;

  elsif v_stage_key = 'repair_ri'
     and v_status in ('Work Approval Received', 'Under Repair', 'Repair Started', 'Repair Done', 'Repair Completed', 'RA Intimation') then
    update public.claims
       set current_status = 'RA Intimation Done'
     where id = new.claim_id
       and current_status::text = v_status;

  elsif v_stage_key = 'billing'
     and v_status = 'RA Intimation Done' then
    update public.claims
       set current_status = 'Final Bill Submitted'
     where id = new.claim_id
       and current_status::text = v_status;

  elsif v_stage_key = 'delivery_order'
     and v_status in ('Final Bill Submitted', 'DO Status') then
    update public.claims
       set current_status = 'DO Submitted'
     where id = new.claim_id
       and current_status::text = v_status;

  elsif v_stage_key = 'vehicle_delivery'
     and v_status = 'DO Submitted' then
    update public.claims
       set current_status = 'Payment Stage'
     where id = new.claim_id
       and current_status::text = v_status;

  elsif v_stage_key = 'payment_encashment'
     and v_status in ('Payment Stage', 'Claim Completion In Progress', 'Settlement Under Process') then
    update public.claims
       set current_status = 'Claim Complete'
     where id = new.claim_id
       and current_status::text = v_status;

  else
    -- Historical/completed-stage edits deliberately do not change current_status.
    return new;
  end if;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'The claim stage could not be persisted.';
  end if;

  return new;
end;
$$;

revoke all on function public.persist_managed_claim_stage_transition_from_details() from public;

drop trigger if exists trg_persist_managed_claim_stage_transition on public.claim_stage_details;
create trigger trg_persist_managed_claim_stage_transition
after insert on public.claim_stage_details
for each row
execute function public.persist_managed_claim_stage_transition_from_details();
