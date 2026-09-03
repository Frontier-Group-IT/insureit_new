-- Complete the spot survey and open customer Claim Intimation uploads atomically.
create or replace function public.complete_spot_survey(
  p_claim_id uuid,
  p_completed_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims%rowtype;
  v_next_status public.claim_status := 'Final Documents Awaited';
  v_now timestamptz := now();
  v_details jsonb;
begin
  if p_completed_by is distinct from auth.uid() then
    raise exception 'The completing user does not match the authenticated user.';
  end if;

  if not public.is_operations_role()
     or not public.can_access_claim(auth.uid(), p_claim_id) then
    raise exception 'You do not have permission to complete the spot survey.';
  end if;

  select *
    into v_claim
    from public.claims
   where id = p_claim_id
     and claim_service_mode = 'broker_managed'
     and current_status = 'Surveyor Appointed'
   for update;

  if not found then
    raise exception 'This claim is not ready for spot survey completion.';
  end if;

  v_details := jsonb_build_object(
    'verification_type', 'spot_survey_completed',
    'previous_status', v_claim.current_status,
    'next_status', v_next_status,
    'next_stage', 'Claim Intimation',
    'completed_at', v_now,
    'completed_by', p_completed_by
  );

  update public.claims
     set current_status = v_next_status,
         updated_at = v_now
   where id = p_claim_id
     and current_status = v_claim.current_status;

  if not found then
    raise exception 'The claim status could not be updated.';
  end if;

  insert into public.claim_stage_details (
    claim_id, stage, details, created_by
  )
  values (
    p_claim_id, v_next_status, v_details, p_completed_by
  );

  insert into public.claim_status_history (
    claim_id, from_status, to_status, notes, changed_by
  )
  values (
    p_claim_id,
    v_claim.current_status,
    v_next_status,
    'Spot survey completed. Claim Intimation document uploads opened for the customer.',
    p_completed_by
  );

  return jsonb_build_object(
    'ok', true,
    'previous_status', v_claim.current_status,
    'next_status', v_next_status
  );
end;
$$;

revoke all on function public.complete_spot_survey(uuid, uuid) from public;
grant execute on function public.complete_spot_survey(uuid, uuid) to authenticated;
