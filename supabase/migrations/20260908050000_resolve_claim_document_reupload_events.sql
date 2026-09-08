-- Resolve customer-facing reupload requests as soon as a fresh replacement
-- document is saved. Keep the original activity row as audit history by
-- changing its event type instead of deleting it.

create or replace function public.resolve_claim_document_reupload_events()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- A rejected row is itself an active replacement request, not a resolution.
  if coalesce(new.verification_status::text, '') = 'rejected' then
    return new;
  end if;

  update public.customer_activity_events as event
  set
    event_type = 'claim_document_reupload_resolved',
    metadata = coalesce(event.metadata, '{}'::jsonb) || jsonb_build_object(
      'resolved_at', now(),
      'resolved_by_document_id', new.id
    )
  where event.claim_id = new.claim_id
    and event.event_type = 'claim_document_reuploaded'
    and nullif(btrim(event.metadata ->> 'document_type'), '') is not null
    and lower(btrim(event.metadata ->> 'document_type')) = lower(btrim(new.document_type));

  return new;
end;
$function$;

drop trigger if exists resolve_claim_document_reupload_events on public.claim_documents;
create trigger resolve_claim_document_reupload_events
after insert or update of verification_status, document_type
on public.claim_documents
for each row
execute function public.resolve_claim_document_reupload_events();

-- Backfill stale historical requests where a newer replacement already exists.
with latest_matching_document as (
  select distinct on (event.id)
    event.id as event_id,
    document.id as document_id,
    document.verification_status,
    document.created_at as document_created_at
  from public.customer_activity_events as event
  join public.claim_documents as document
    on document.claim_id = event.claim_id
   and nullif(btrim(event.metadata ->> 'document_type'), '') is not null
   and lower(btrim(document.document_type)) = lower(btrim(event.metadata ->> 'document_type'))
  where event.event_type = 'claim_document_reuploaded'
  order by event.id, document.created_at desc, document.id desc
), resolved as (
  select
    event.id as event_id,
    latest.document_id
  from public.customer_activity_events as event
  join latest_matching_document as latest on latest.event_id = event.id
  where event.event_type = 'claim_document_reuploaded'
    and coalesce(latest.verification_status::text, '') <> 'rejected'
    and latest.document_created_at > event.created_at
)
update public.customer_activity_events as event
set
  event_type = 'claim_document_reupload_resolved',
  metadata = coalesce(event.metadata, '{}'::jsonb) || jsonb_build_object(
    'resolved_at', now(),
    'resolved_by_document_id', resolved.document_id
  )
from resolved
where event.id = resolved.event_id;
