-- Advance already-verified initial-document claims without an RLS-filtered no-op.
create or replace function public.advance_initial_documents_verified(
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
begin
  if p_actor_id is distinct from auth.uid() then
    raise exception 'The verification user does not match the authenticated user.';
  end if;
  if not public.is_operations_role() or not public.can_access_claim(auth.uid(), p_claim_id) then
    raise exception 'You do not have permission to finalize document verification.';
  end if;

  select * into v_claim from public.claims
   where id = p_claim_id
     and current_status in ('Initial Documents Verification Pending', 'Initial Documents Submitted')
   for update;
  if not found then
    raise exception 'This claim is not awaiting initial document verification.';
  end if;

  if not exists (select 1 from public.claim_documents where claim_id = p_claim_id and verification_status = 'verified' and lower(document_type) like any (array['%accident photo%', '%spot photo%', '%spot image%', '%loss photo%', '%vehicle photo%'])) then raise exception 'Accident photo is not verified.'; end if;
  if not exists (select 1 from public.claim_documents where claim_id = p_claim_id and verification_status = 'verified' and lower(document_type) like any (array['%rc copy%', '%registration certificate%'])) then raise exception 'RC copy is not verified.'; end if;
  if not exists (select 1 from public.claim_documents where claim_id = p_claim_id and verification_status = 'verified' and lower(document_type) like any (array['%insurance copy%', '%policy copy%'])) then raise exception 'Insurance copy is not verified.'; end if;
  if not exists (select 1 from public.claim_documents where claim_id = p_claim_id and verification_status = 'verified' and lower(document_type) like any (array['%driver licence%', '%driving licence%', '%driving license%', '%dl copy%'])) then raise exception 'Driver licence is not verified.'; end if;
  if not exists (select 1 from public.claim_documents where claim_id = p_claim_id and verification_status = 'verified' and lower(document_type) like any (array['%gr / load bill%', '%load challan%', '%road challan%'])) then raise exception 'GR / Load Bill is not verified.'; end if;
  if not exists (select 1 from public.claim_documents where claim_id = p_claim_id and verification_status = 'verified' and lower(document_type) like any (array['%accident video%', '%loss video%', '%vehicle video%'])) then raise exception 'Accident video is not verified.'; end if;

  update public.claims
     set current_status = 'Initial Documents Verified',
         updated_at = v_now
   where id = p_claim_id
     and current_status = v_claim.current_status;
  if not found then raise exception 'The claim status could not be updated.'; end if;

  insert into public.claim_status_history (claim_id, from_status, to_status, notes, changed_by)
  values (p_claim_id, v_claim.current_status, 'Initial Documents Verified', 'All required initial documents verified by claim desk.', p_actor_id);
  return jsonb_build_object('ok', true, 'next_status', 'Initial Documents Verified');
end;
$$;

revoke all on function public.advance_initial_documents_verified(uuid, uuid) from public;
grant execute on function public.advance_initial_documents_verified(uuid, uuid) to authenticated;
