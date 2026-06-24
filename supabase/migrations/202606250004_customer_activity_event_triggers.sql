-- Automatic customer activity capture
-- These triggers make the manager dashboard receive customer updates even if the mobile UI
-- does not explicitly call recordCustomerActivity().

create or replace function public.insert_customer_activity_event(
  p_customer_id uuid,
  p_claim_id uuid,
  p_vehicle_id uuid,
  p_policy_id uuid,
  p_support_ticket_id uuid,
  p_source_table text,
  p_source_id uuid,
  p_event_type text,
  p_title text,
  p_message text,
  p_priority text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customer_activity_events (
    customer_id,
    claim_id,
    vehicle_id,
    policy_id,
    support_ticket_id,
    source_table,
    source_id,
    event_type,
    title,
    message,
    priority,
    status,
    metadata
  ) values (
    p_customer_id,
    p_claim_id,
    p_vehicle_id,
    p_policy_id,
    p_support_ticket_id,
    p_source_table,
    p_source_id,
    p_event_type,
    p_title,
    p_message,
    coalesce(p_priority, 'medium'),
    'new',
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- Claim document upload / reupload
create or replace function public.capture_claim_document_customer_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  v_event_type := case when v_was_reupload then 'claim_document_reuploaded' else 'claim_document_uploaded' end;
  v_priority := case when v_was_reupload then 'high' else 'medium' end;

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
$$;

drop trigger if exists trg_capture_claim_document_customer_activity on public.claim_documents;
create trigger trg_capture_claim_document_customer_activity
after insert on public.claim_documents
for each row
execute function public.capture_claim_document_customer_activity();

-- Support ticket creation
create or replace function public.capture_support_ticket_customer_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims%rowtype;
begin
  if new.claim_id is not null then
    select * into v_claim
    from public.claims
    where id = new.claim_id;
  end if;

  perform public.insert_customer_activity_event(
    new.customer_id,
    new.claim_id,
    v_claim.vehicle_id,
    v_claim.policy_id,
    new.id,
    'support_tickets',
    new.id,
    'support_ticket_created',
    'New support ticket raised',
    concat(new.category, ' support ticket: ', new.subject),
    case when new.priority = 'high' then 'high' else 'medium' end,
    jsonb_build_object(
      'ticket_no', new.ticket_no,
      'category', new.category,
      'priority', new.priority,
      'subject', new.subject,
      'description', new.description,
      'claim_no', v_claim.claim_no,
      'current_status', v_claim.current_status
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_capture_support_ticket_customer_activity on public.support_tickets;
create trigger trg_capture_support_ticket_customer_activity
after insert on public.support_tickets
for each row
execute function public.capture_support_ticket_customer_activity();

-- Customer support message replies
create or replace function public.capture_support_message_customer_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_claim public.claims%rowtype;
  v_is_customer_message boolean;
begin
  select * into v_ticket
  from public.support_tickets
  where id = new.ticket_id;

  if not found then
    return new;
  end if;

  select exists (
    select 1
    from public.customers c
    where c.id = v_ticket.customer_id
      and c.profile_id = new.sender_id
  ) into v_is_customer_message;

  if not v_is_customer_message then
    return new;
  end if;

  if v_ticket.claim_id is not null then
    select * into v_claim
    from public.claims
    where id = v_ticket.claim_id;
  end if;

  perform public.insert_customer_activity_event(
    v_ticket.customer_id,
    v_ticket.claim_id,
    v_claim.vehicle_id,
    v_claim.policy_id,
    v_ticket.id,
    'support_ticket_messages',
    new.id,
    'support_ticket_message_sent',
    'Customer replied on support ticket',
    left(new.message, 180),
    'high',
    jsonb_build_object(
      'ticket_no', v_ticket.ticket_no,
      'category', v_ticket.category,
      'ticket_priority', v_ticket.priority,
      'message_preview', left(new.message, 180),
      'claim_no', v_claim.claim_no,
      'current_status', v_claim.current_status
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_capture_support_message_customer_activity on public.support_ticket_messages;
create trigger trg_capture_support_message_customer_activity
after insert on public.support_ticket_messages
for each row
execute function public.capture_support_message_customer_activity();

-- Support ticket attachment upload by customer
create or replace function public.capture_support_attachment_customer_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_claim public.claims%rowtype;
  v_is_customer_upload boolean;
begin
  select * into v_ticket
  from public.support_tickets
  where id = new.ticket_id;

  if not found then
    return new;
  end if;

  select exists (
    select 1
    from public.customers c
    where c.id = v_ticket.customer_id
      and c.profile_id = new.uploaded_by
  ) into v_is_customer_upload;

  if not v_is_customer_upload then
    return new;
  end if;

  if v_ticket.claim_id is not null then
    select * into v_claim
    from public.claims
    where id = v_ticket.claim_id;
  end if;

  perform public.insert_customer_activity_event(
    v_ticket.customer_id,
    v_ticket.claim_id,
    v_claim.vehicle_id,
    v_claim.policy_id,
    v_ticket.id,
    'support_ticket_attachments',
    new.id,
    'support_ticket_attachment_uploaded',
    'Customer uploaded support attachment',
    concat(new.file_name, ' uploaded on ticket ', coalesce(v_ticket.ticket_no, '-')),
    'medium',
    jsonb_build_object(
      'ticket_no', v_ticket.ticket_no,
      'file_name', new.file_name,
      'storage_bucket', new.storage_bucket,
      'storage_path', new.storage_path,
      'mime_type', new.mime_type,
      'file_size', new.file_size,
      'claim_no', v_claim.claim_no
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_capture_support_attachment_customer_activity on public.support_ticket_attachments;
create trigger trg_capture_support_attachment_customer_activity
after insert on public.support_ticket_attachments
for each row
execute function public.capture_support_attachment_customer_activity();

-- Customer KYC/profile document upload
create or replace function public.capture_customer_document_upload_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.insert_customer_activity_event(
    new.customer_id,
    null,
    null,
    null,
    null,
    'customer_documents',
    new.id,
    'customer_kyc_uploaded',
    'Customer uploaded KYC document',
    concat(coalesce(new.document_type, 'Document'), ' uploaded in customer profile'),
    'medium',
    jsonb_build_object(
      'document_type', new.document_type,
      'file_name', new.file_name,
      'storage_bucket', new.storage_bucket,
      'storage_path', new.storage_path,
      'mime_type', new.mime_type,
      'file_size', new.file_size
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_capture_customer_document_upload_activity on public.customer_documents;
create trigger trg_capture_customer_document_upload_activity
after insert on public.customer_documents
for each row
execute function public.capture_customer_document_upload_activity();

-- Customer KYC/profile document deletion
create or replace function public.capture_customer_document_delete_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.insert_customer_activity_event(
    old.customer_id,
    null,
    null,
    null,
    null,
    'customer_documents',
    old.id,
    'customer_kyc_deleted',
    'Customer deleted KYC document',
    concat(coalesce(old.document_type, 'Document'), ' removed from customer profile'),
    'medium',
    jsonb_build_object(
      'document_type', old.document_type,
      'file_name', old.file_name,
      'storage_bucket', old.storage_bucket,
      'storage_path', old.storage_path,
      'mime_type', old.mime_type,
      'file_size', old.file_size
    )
  );

  return old;
end;
$$;

drop trigger if exists trg_capture_customer_document_delete_activity on public.customer_documents;
create trigger trg_capture_customer_document_delete_activity
after delete on public.customer_documents
for each row
execute function public.capture_customer_document_delete_activity();
