alter table public.policy_intake_requests
  alter column storage_bucket drop not null,
  alter column storage_path drop not null,
  alter column file_name drop not null;

alter table public.policy_intake_requests
  drop constraint if exists policy_intake_requests_required_source_document_check;

alter table public.policy_intake_requests
  add constraint policy_intake_requests_required_source_document_check
  check (
    policy_type in ('life', 'health')
    or (
      storage_bucket is not null
      and nullif(btrim(storage_bucket), '') is not null
      and storage_path is not null
      and nullif(btrim(storage_path), '') is not null
      and file_name is not null
      and nullif(btrim(file_name), '') is not null
    )
  );

comment on constraint policy_intake_requests_required_source_document_check
  on public.policy_intake_requests is
  'Motor, Non-Motor and historical intake rows require a source document; Life and Health intake rows may be submitted without a proposal form.';
