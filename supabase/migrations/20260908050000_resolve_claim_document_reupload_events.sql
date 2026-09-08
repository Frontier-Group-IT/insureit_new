-- Resolve customer-facing reupload requests as soon as a fresh replacement
-- document is saved. Keep request/replacement activity as audit history while
-- separating resolved events from active replacement requests.

alter table public.customer_activity_events
  drop constraint if exists customer_activity_events_event_type_check;

alter table public.customer_activity_events
  add constraint customer_activity_events_event_type_check
  check (
    event_type = any (array[
      'claim_submitted'::text,
      'claim_document_uploaded'::text,
      'claim_document_reuploaded'::text,
      'claim_document_reupload_resolved'::text,
      'claim_documents_completed'::text,
      'claim_assistance_accepted'::text,
      'claim_assistance_declined'::text,
      'spot_surveyor_deputed'::text,
      'support_ticket_created'::text,
      'support_ticket_message_sent'::text,
      'support_ticket_attachment_uploaded'::text,
      'customer_kyc_uploaded'::text,
      'customer_kyc_deleted'::text,
      'endorsement_requested'::text,
      'roadside_call_started'::text,
      'notification_unread'::text
    ])
  );

-- Replacement uploads previously reused claim_document_reuploaded, which is
-- also the event type used by Operations to request a replacement. Emit a
-- separate resolved event and close the corresponding active request instead.
create or replace function public.capture_claim_document_customer_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_claim public.claims%rowtype;
  v_was_reupload boolean;
  v_event_type text;
  v_priority text;
begin
  select * into v_claim
  from public.claims
  where id = new.claim_id;

  select exists (
    select 1
    from public.claim_documents cd
    where cd.claim_id = new.claim_id
      and cd.customer_id = new.customer_id
      and lower(cd.document_type) = lower(new.document_type)
      and cd.verification_status = 'rejected'
      and cd.id <> new.id
  ) into v_was_reupload;

  v_event_type := case
    when v_was_reupload then 'claim_document_reupload_resolved'
    else 'claim_document_uploaded'
  end;
  v_priority := case when v_was_reupload then 'high' else 'medium' end;

  if v_was_reupload then
    update public.customer_activity_events as event
    set
      event_type = 'claim_document_reupload_resolved',
      metadata = coalesce(event.metadata, '{}'::jsonb) || jsonb_build_object(
        'resolved_at', now(),
        'resolved_by_document_id', new.id
      )
    where event.claim_id = new.claim_id
      and event.event_type = 'claim_document_reuploaded'
      and event.title ilike '%reupload requested%'
      and lower(btrim(event.metadata ->> 'document_type')) = lower(btrim(new.document_type));
  end if;

  perform public.insert_customer_activity_event(
    new.customer_id,
    new.claim_id,
    v_claim.vehicle_id,
    v_claim.policy_id,
    null,
    'claim_documents',
    new.id,
    v_event_type,
    case when v_was_reupload then 'Replacement document received' else 'Customer uploaded document' end,
    concat(new.document_type, ' uploaded for control no. ', coalesce(v_claim.claim_no, '-')),
    v_priority,
    jsonb_build_object(
      'document_type', new.document_type,
      'file_name', new.file_name,
      'storage_bucket', new.storage_bucket,
      'storage_path', new.storage_path,
      'mime_type', new.mime_type,
      'file_size', new.file_size,
      'was_reupload', v_was_reupload,
      'claim_no', v_claim.claim_no,
      'current_status', v_claim.current_status
    )
  );

  return new;
end;
$function$;

-- Existing replacement-received activity is already resolved history and must
-- no longer be read by the Customer Claim Tracker as an active request.
update public.customer_activity_events
set event_type = 'claim_document_reupload_resolved'
where event_type = 'claim_document_reuploaded'
  and (
    title = 'Replacement document received'
    or lower(coalesce(metadata ->> 'was_reupload', 'false')) = 'true'
  );

-- Resolve older request rows when a later replacement-received activity exists
-- for the same claim and document type. The request row remains in history.
with resolved_requests as (
  select
    request.id as request_id,
    replacement.source_id as replacement_document_id,
    replacement.created_at as resolved_at
  from public.customer_activity_events as request
  join lateral (
    select
      replacement.source_id,
      replacement.created_at
    from public.customer_activity_events as replacement
    where replacement.claim_id = request.claim_id
      and replacement.event_type = 'claim_document_reupload_resolved'
      and replacement.title = 'Replacement document received'
      and replacement.created_at >= request.created_at
      and lower(btrim(replacement.metadata ->> 'document_type')) = lower(btrim(request.metadata ->> 'document_type'))
    order by replacement.created_at desc
    limit 1
  ) as replacement on true
  where request.event_type = 'claim_document_reuploaded'
    and request.title ilike '%reupload requested%'
    and nullif(btrim(request.metadata ->> 'document_type'), '') is not null
)
update public.customer_activity_events as request
set
  event_type = 'claim_document_reupload_resolved',
  metadata = coalesce(request.metadata, '{}'::jsonb) || jsonb_build_object(
    'resolved_at', resolved_requests.resolved_at,
    'resolved_by_document_id', resolved_requests.replacement_document_id
  )
from resolved_requests
where request.id = resolved_requests.request_id;
