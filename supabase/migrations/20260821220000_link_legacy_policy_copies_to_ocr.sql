-- Safely expose legacy customer-uploaded policy copies to the policy OCR queue.
-- Only copies with an unambiguous policy match are linked automatically.

create or replace function public.link_customer_policy_copy_for_ocr()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_policy_id uuid;
  candidate_count integer;
  filename_match_count integer;
begin
  if lower(coalesce(new.document_type, '')) <> 'policy_copy' then
    return new;
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where (
        nullif(trim(policy.policy_no), '') is not null
        and lower(new.file_name) like '%' || lower(trim(policy.policy_no)) || '%'
      )
      or (
        nullif(trim(policy.policy_code), '') is not null
        and lower(new.file_name) like '%' || lower(trim(policy.policy_code)) || '%'
      )
    )::integer
  into candidate_count, filename_match_count
  from public.policies policy
  where policy.customer_id = new.customer_id;

  if candidate_count = 1 then
    select policy.id
    into matched_policy_id
    from public.policies policy
    where policy.customer_id = new.customer_id
    limit 1;
  elsif filename_match_count = 1 then
    select policy.id
    into matched_policy_id
    from public.policies policy
    where policy.customer_id = new.customer_id
      and (
        (
          nullif(trim(policy.policy_no), '') is not null
          and lower(new.file_name) like '%' || lower(trim(policy.policy_no)) || '%'
        )
        or (
          nullif(trim(policy.policy_code), '') is not null
          and lower(new.file_name) like '%' || lower(trim(policy.policy_code)) || '%'
        )
      )
    limit 1;
  end if;

  if matched_policy_id is null then
    return new;
  end if;

  insert into public.policy_documents (
    policy_id,
    document_type,
    file_name,
    storage_bucket,
    storage_path,
    mime_type,
    file_size,
    uploaded_by,
    created_at,
    updated_at
  )
  values (
    matched_policy_id,
    'policy_copy',
    new.file_name,
    new.storage_bucket,
    new.storage_path,
    new.mime_type,
    new.file_size,
    new.uploaded_by,
    new.created_at,
    new.updated_at
  )
  on conflict (storage_bucket, storage_path) do update
    set policy_id = excluded.policy_id,
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        file_size = excluded.file_size,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists link_customer_policy_copy_for_ocr
  on public.customer_documents;
create trigger link_customer_policy_copy_for_ocr
after insert or update of document_type, file_name, storage_bucket, storage_path, mime_type, file_size
on public.customer_documents
for each row
execute function public.link_customer_policy_copy_for_ocr();

insert into public.policy_documents (
  policy_id,
  document_type,
  file_name,
  storage_bucket,
  storage_path,
  mime_type,
  file_size,
  uploaded_by,
  created_at,
  updated_at
)
select
  matched.policy_id,
  'policy_copy',
  matched.file_name,
  matched.storage_bucket,
  matched.storage_path,
  matched.mime_type,
  matched.file_size,
  matched.uploaded_by,
  matched.created_at,
  matched.updated_at
from (
  select
    customer_document.file_name,
    customer_document.storage_bucket,
    customer_document.storage_path,
    customer_document.mime_type,
    customer_document.file_size,
    customer_document.uploaded_by,
    customer_document.created_at,
    customer_document.updated_at,
    policy.id as policy_id,
    count(*) over (partition by customer_document.id) as candidate_count,
    count(*) filter (
      where (
        nullif(trim(policy.policy_no), '') is not null
        and lower(customer_document.file_name) like '%' || lower(trim(policy.policy_no)) || '%'
      )
      or (
        nullif(trim(policy.policy_code), '') is not null
        and lower(customer_document.file_name) like '%' || lower(trim(policy.policy_code)) || '%'
      )
    ) over (partition by customer_document.id) as filename_match_count,
    (
      (
        nullif(trim(policy.policy_no), '') is not null
        and lower(customer_document.file_name) like '%' || lower(trim(policy.policy_no)) || '%'
      )
      or (
        nullif(trim(policy.policy_code), '') is not null
        and lower(customer_document.file_name) like '%' || lower(trim(policy.policy_code)) || '%'
      )
    ) as filename_matches
  from public.customer_documents customer_document
  join public.policies policy on policy.customer_id = customer_document.customer_id
  where lower(coalesce(customer_document.document_type, '')) = 'policy_copy'
) matched
where matched.candidate_count = 1
   or (matched.filename_match_count = 1 and matched.filename_matches)
on conflict (storage_bucket, storage_path) do update
  set policy_id = excluded.policy_id,
      file_name = excluded.file_name,
      mime_type = excluded.mime_type,
      file_size = excluded.file_size,
      updated_at = now();
