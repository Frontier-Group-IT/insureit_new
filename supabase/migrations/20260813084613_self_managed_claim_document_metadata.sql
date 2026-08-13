alter table public.claim_documents
  add column if not exists milestone_key public.claim_milestone_key null;

alter table public.claim_documents
  add column if not exists verification_required boolean not null default true;

create index if not exists claim_documents_claim_milestone_idx
  on public.claim_documents (claim_id, milestone_key, created_at desc);

comment on column public.claim_documents.milestone_key is
  'Self-managed claim milestone this document belongs to. Null for legacy/general claim documents.';

comment on column public.claim_documents.verification_required is
  'True for documents entering the Sankalp verification workflow; false for customer-owned self-managed claim records.';
