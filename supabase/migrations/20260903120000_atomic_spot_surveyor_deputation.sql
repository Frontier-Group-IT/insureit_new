-- Persist spot surveyor deputation and its workflow transition atomically.
alter table public.customer_activity_events
  drop constraint if exists customer_activity_events_event_type_check;

alter table public.customer_activity_events
  add constraint customer_activity_events_event_type_check
  check (event_type in (
    'claim_submitted',
    'claim_document_uploaded',
    'claim_document_reuploaded',
    'claim_documents_completed',
    'spot_surveyor_deputed',
    'support_ticket_created',
    'support_ticket_message_sent',
    'support_ticket_attachment_uploaded',
    'customer_kyc_uploaded',
    'customer_kyc_deleted',
    'endorsement_requested',
    'roadside_call_started',
    'notification_unread'
  ));

create or replace function public.depute_spot_surveyor(
  p_claim_id uuid,
  p_surveyor_name text,
  p_surveyor_number text,
  p_surveyor_email text,
  p_deputed_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims%rowtype;
  v_next_status public.claim_status := 'Surveyor Appointed';
  v_now timestamptz := now();
  v_details jsonb;
begin
  if p_deputed_by is distinct from auth.uid() then
    raise exception 'The deputing user does not match the authenticated user.';
  end if;

  if not public.is_operations_role() or not public.can_access_claim(auth.uid(), p_claim_id) then
    raise exception 'You do not have permission to depute a spot surveyor.';
  end if;

  if nullif(trim(p_surveyor_name), '') is null
     or p_surveyor_number !~ '^[0-9]{10}$'
     or p_surveyor_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid spot surveyor details.';
  end if;

  select *
    into v_claim
    from public.claims
   where id = p_claim_id
     and current_status in ('Initial Documents Verified', 'Claim Intimated')
   for update;

  if not found then
    raise exception 'This claim is not ready for spot surveyor deputation.';
  end if;

  v_details := jsonb_build_object(
    'verification_type', 'spot_surveyor_deputation',
    'surveyor_name', trim(p_surveyor_name),
    'surveyor_number', p_surveyor_number,
    'surveyor_email', lower(trim(p_surveyor_email)),
    'deputed_at', v_now,
    'deputed_by', p_deputed_by
  );

  insert into public.claim_stage_details (claim_id, stage, details, created_by)
  values (p_claim_id, v_next_status, v_details, p_deputed_by);

  update public.claims
     set current_status = v_next_status,
         updated_at = v_now
   where id = p_claim_id
     and current_status = v_claim.current_status;

  if not found then
    raise exception 'The claim status could not be updated.';
  end if;

  insert into public.claim_status_history (
    claim_id, from_status, to_status, notes, changed_by
  )
  values (
    p_claim_id,
    v_claim.current_status,
    v_next_status,
    format('Spot surveyor deputed: %s, %s, %s', trim(p_surveyor_name), p_surveyor_number, lower(trim(p_surveyor_email))),
    p_deputed_by
  );

  if v_claim.customer_id is not null then
    insert into public.customer_activity_events (
      customer_id, claim_id, event_type, title, message, priority, status, metadata
    )
    values (
      v_claim.customer_id,
      p_claim_id,
      'spot_surveyor_deputed',
      'Spot surveyor deputed',
      format('%s has been deputed for spot survey.', trim(p_surveyor_name)),
      'medium',
      'new',
      v_details
    );
  end if;

  return jsonb_build_object('ok', true, 'next_status', v_next_status);
end;
$$;

revoke all on function public.depute_spot_surveyor(uuid, text, text, text, uuid) from public;
grant execute on function public.depute_spot_surveyor(uuid, text, text, text, uuid) to authenticated;
