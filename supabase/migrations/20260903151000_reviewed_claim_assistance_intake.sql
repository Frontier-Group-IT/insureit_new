-- Require Operations to review an external claim and explicitly choose its
-- internal intake stage before accepting customer assistance.
alter table public.customer_activity_events
  drop constraint if exists customer_activity_events_event_type_check;

alter table public.customer_activity_events
  add constraint customer_activity_events_event_type_check
  check (event_type in (
    'claim_submitted',
    'claim_document_uploaded',
    'claim_document_reuploaded',
    'claim_documents_completed',
    'claim_assistance_accepted',
    'claim_assistance_declined',
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

create or replace function public.resolve_claim_assistance_intake(
  p_claim_id uuid,
  p_decision text,
  p_entry_status public.claim_status,
  p_note text,
  p_resolved_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_now timestamptz := now();
  v_next_status public.claim_status;
  v_event_type text;
  v_event_title text;
  v_initial_document_categories integer;
begin
  if auth.uid() is null or p_resolved_by is distinct from auth.uid() then
    raise exception 'The reviewing user does not match the authenticated user.';
  end if;

  if public.current_app_role()::text not in ('claim_processor', 'manager', 'admin', 'super_admin', 'it_super_user')
     or not public.can_access_claim(auth.uid(), p_claim_id) then
    raise exception 'You do not have permission to review this assistance request.';
  end if;

  if v_decision not in ('accepted', 'declined') then
    raise exception 'Decision must be accepted or declined.';
  end if;

  if v_note is null or length(v_note) < 10 then
    raise exception 'Enter a review note of at least 10 characters.';
  end if;

  select *
    into v_claim
    from public.claims
   where id = p_claim_id
     and assistance_status = 'requested'
     and claim_service_mode = 'self_managed'
     and policy_service_source = 'external'
     and current_status not in ('Settled', 'Rejected', 'Closed')
   for update;

  if not found then
    raise exception 'This assistance request is no longer available for review.';
  end if;

  if v_decision = 'accepted' then
    if p_entry_status not in (
      'Initial Documents Pending',
      'Initial Documents Verification Pending',
      'Initial Documents Verified'
    ) then
      raise exception 'Select a supported internal intake stage.';
    end if;

    if p_entry_status in ('Initial Documents Verification Pending', 'Initial Documents Verified') then
      select count(distinct category)
        into v_initial_document_categories
        from (
          select case
            when lower(document_type) like any (array['%accident photo%', '%spot photo%', '%spot image%', '%loss photo%', '%vehicle photo%']) then 'accident_photo'
            when lower(document_type) like any (array['%rc copy%', '%registration certificate%']) then 'rc_copy'
            when lower(document_type) like any (array['%insurance copy%', '%policy copy%']) then 'insurance_copy'
            when lower(document_type) like any (array['%driver licence%', '%driving licence%', '%driving license%', '%dl copy%']) then 'driver_licence'
            when lower(document_type) like any (array['%gr / load bill%', '%gr copy / load challan%', '%gr copy / road challan%', '%gr / load challan%', '%road challan%', '%load challan%']) then 'gr_load_bill'
            when lower(document_type) like any (array['%accident video%', '%loss video%', '%vehicle video%']) then 'accident_video'
            else null
          end as category
          from public.claim_documents
          where claim_id = p_claim_id
            and (
              (p_entry_status = 'Initial Documents Verification Pending' and verification_status::text <> 'rejected')
              or (p_entry_status = 'Initial Documents Verified' and verification_status::text = 'verified')
            )
        ) classified
       where category is not null;

      if v_initial_document_categories <> 6 then
        if p_entry_status = 'Initial Documents Verified' then
          raise exception 'All six required initial document categories must be verified before selecting this stage.';
        else
          raise exception 'All six required initial document categories must be uploaded before selecting this stage.';
        end if;
      end if;
    end if;

    v_next_status := p_entry_status;
    v_event_type := 'claim_assistance_accepted';
    v_event_title := 'Claim assistance accepted';

    update public.claims
       set assistance_status = 'accepted',
           claim_service_mode = 'broker_managed',
           policy_service_source = 'external',
           current_status = v_next_status,
           assistance_resolved_at = v_now,
           assistance_resolved_by = p_resolved_by,
           assistance_notes = case
             when assistance_notes is null or trim(assistance_notes) = '' then v_note
             else assistance_notes || E'\n\nClaims Desk: ' || v_note
           end,
           assigned_to = coalesce(assigned_to, p_resolved_by),
           updated_at = v_now
     where id = p_claim_id
       and assistance_status = 'requested'
       and claim_service_mode = 'self_managed';
  else
    if p_entry_status is not null then
      raise exception 'An internal intake stage is not allowed when declining assistance.';
    end if;
    v_next_status := v_claim.current_status;
    v_event_type := 'claim_assistance_declined';
    v_event_title := 'Claim assistance declined';

    update public.claims
       set assistance_status = 'declined',
           claim_service_mode = 'self_managed',
           assistance_resolved_at = v_now,
           assistance_resolved_by = p_resolved_by,
           assistance_notes = case
             when assistance_notes is null or trim(assistance_notes) = '' then v_note
             else assistance_notes || E'\n\nClaims Desk: ' || v_note
           end,
           updated_at = v_now
     where id = p_claim_id
       and assistance_status = 'requested'
       and claim_service_mode = 'self_managed';
  end if;

  if not found then
    raise exception 'The assistance request changed before this decision was saved.';
  end if;

  insert into public.claim_stage_details (claim_id, stage, details, created_by)
  values (
    p_claim_id,
    v_next_status,
    jsonb_build_object(
      'verification_type', 'claim_assistance_intake',
      'decision', v_decision,
      'entry_status', case when v_decision = 'accepted' then v_next_status else null end,
      'review_note', v_note,
      'reviewed_at', v_now,
      'reviewed_by', p_resolved_by
    ),
    p_resolved_by
  );

  insert into public.claim_status_history (claim_id, from_status, to_status, notes, changed_by)
  values (
    p_claim_id,
    v_claim.current_status,
    v_next_status,
    format('Assistance %s after Operations intake review. %s', v_decision, v_note),
    p_resolved_by
  );

  if v_claim.customer_id is not null then
    insert into public.customer_activity_events (
      customer_id, claim_id, event_type, title, message, priority, status, metadata
    )
    values (
      v_claim.customer_id,
      p_claim_id,
      v_event_type,
      v_event_title,
      case
        when v_decision = 'accepted' then 'The claims desk has accepted responsibility for this claim.'
        else 'The claims desk reviewed the assistance request. The claim remains self-managed.'
      end,
      case when v_decision = 'accepted' then 'high' else 'medium' end,
      'new',
      jsonb_build_object(
        'decision', v_decision,
        'entry_status', case when v_decision = 'accepted' then v_next_status else null end,
        'reviewed_at', v_now
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'decision', v_decision,
    'claim_service_mode', case when v_decision = 'accepted' then 'broker_managed' else 'self_managed' end,
    'next_status', v_next_status
  );
end;
$$;

revoke all on function public.resolve_claim_assistance_intake(uuid, text, public.claim_status, text, uuid) from public;
grant execute on function public.resolve_claim_assistance_intake(uuid, text, public.claim_status, text, uuid) to authenticated;

-- The older resolver cannot record the reviewed internal entry stage.
revoke execute on function public.resolve_claim_assistance(uuid, text, text) from authenticated;
