begin;

create or replace function public.inherit_partner_documents_to_linked_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.intermediary_onboarding_documents (
    id,
    application_id,
    document_type,
    file_name,
    storage_bucket,
    storage_path,
    mime_type,
    file_size,
    verification_status,
    uploaded_by,
    verified_by,
    verified_at,
    created_at,
    updated_at
  )
  select
    gen_random_uuid(),
    child.id,
    new.document_type,
    new.file_name,
    new.storage_bucket,
    new.storage_path,
    new.mime_type,
    new.file_size,
    new.verification_status,
    new.uploaded_by,
    new.verified_by,
    new.verified_at,
    now(),
    now()
  from public.intermediary_onboarding_applications child
  where child.draft_data ->> 'parent_partner_application_id' = new.application_id::text
    and child.draft_data ->> 'account_context' in ('posp', 'misp')
  on conflict (application_id, document_type) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_inherit_partner_documents_to_linked_accounts
  on public.intermediary_onboarding_documents;

create trigger trg_inherit_partner_documents_to_linked_accounts
after insert or update of file_name, storage_bucket, storage_path, mime_type, file_size, verification_status, verified_by, verified_at
on public.intermediary_onboarding_documents
for each row
execute function public.inherit_partner_documents_to_linked_accounts();

insert into public.intermediary_onboarding_documents (
  id,
  application_id,
  document_type,
  file_name,
  storage_bucket,
  storage_path,
  mime_type,
  file_size,
  verification_status,
  uploaded_by,
  verified_by,
  verified_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  child.id,
  parent_doc.document_type,
  parent_doc.file_name,
  parent_doc.storage_bucket,
  parent_doc.storage_path,
  parent_doc.mime_type,
  parent_doc.file_size,
  parent_doc.verification_status,
  parent_doc.uploaded_by,
  parent_doc.verified_by,
  parent_doc.verified_at,
  now(),
  now()
from public.intermediary_onboarding_applications child
join public.intermediary_onboarding_documents parent_doc
  on parent_doc.application_id::text = child.draft_data ->> 'parent_partner_application_id'
where child.draft_data ->> 'account_context' in ('posp', 'misp')
  and child.draft_data ->> 'parent_partner_application_id' is not null
on conflict (application_id, document_type) do nothing;

commit;
