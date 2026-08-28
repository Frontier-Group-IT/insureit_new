begin;

alter table public.policy_intake_requests
  alter column submitted_by_profile_id drop not null;

alter table public.policy_intake_requests
  add column if not exists submitted_by_portal_account_id uuid
    references public.intermediary_portal_accounts(id) on delete restrict;

alter table public.policy_intake_requests
  drop constraint if exists policy_intake_requests_exactly_one_submitter_check;

alter table public.policy_intake_requests
  add constraint policy_intake_requests_exactly_one_submitter_check
  check (num_nonnulls(submitted_by_profile_id, submitted_by_portal_account_id) = 1);

create index if not exists policy_intake_requests_submitted_by_portal_account_idx
  on public.policy_intake_requests(submitted_by_portal_account_id, created_at desc)
  where submitted_by_portal_account_id is not null;

alter table public.policy_intake_documents
  add column if not exists uploaded_by_portal_account_id uuid
    references public.intermediary_portal_accounts(id) on delete set null;

alter table public.policy_intake_documents
  drop constraint if exists policy_intake_documents_single_uploader_check;

alter table public.policy_intake_documents
  add constraint policy_intake_documents_single_uploader_check
  check (num_nonnulls(uploaded_by_profile_id, uploaded_by_portal_account_id) <= 1);

create index if not exists policy_intake_documents_uploaded_by_portal_account_idx
  on public.policy_intake_documents(uploaded_by_portal_account_id, created_at desc)
  where uploaded_by_portal_account_id is not null;

commit;
