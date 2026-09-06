-- Ensure Stage 1 -> Stage 2 persists even when the direct authenticated UPDATE is RLS-filtered.
-- The existing server action writes a Stage 2 stage-detail row after validating the form.
-- This trigger turns that row into an authoritative claim-status transition for authorized Operations users.

create or replace function public.persist_initial_document_submission_from_stage_details()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.persist_initial_document_submission_from_stage_details() from public;

drop trigger if exists trg_persist_initial_document_submission on public.claim_stage_details;
create trigger trg_persist_initial_document_submission
after insert on public.claim_stage_details
for each row
execute function public.persist_initial_document_submission_from_stage_details();
