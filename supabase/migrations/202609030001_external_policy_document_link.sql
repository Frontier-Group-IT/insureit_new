-- Link customer-uploaded policy copies to the external policy they belong to.
-- Existing rows remain valid and can still be resolved through document_storage_path.
alter table public.customer_documents
  add column if not exists external_policy_id uuid null references public.external_policies(id) on delete cascade;

create index if not exists customer_documents_external_policy_id_idx
  on public.customer_documents(external_policy_id);
