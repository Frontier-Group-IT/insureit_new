-- Permanent structured verification history for claim documents.
-- Stores RC / Insurance verification details so the team can refer to them later.

create extension if not exists pgcrypto;

create table if not exists public.claim_document_verifications (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  document_id uuid references public.claim_documents(id) on delete set null,
  document_type text not null,
  verification_type text not null,
  incident_date date,
  is_valid boolean not null default true,
  invalid_reason text,
  details jsonb not null default '{}'::jsonb,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claim_document_verifications_type_check
    check (verification_type in ('rc', 'insurance', 'document', 'detail'))
);

create index if not exists idx_claim_document_verifications_claim_id
  on public.claim_document_verifications(claim_id, created_at desc);

create index if not exists idx_claim_document_verifications_document_id
  on public.claim_document_verifications(document_id, created_at desc);

create index if not exists idx_claim_document_verifications_validity
  on public.claim_document_verifications(is_valid, created_at desc);

create or replace function public.set_claim_document_verifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_claim_document_verifications_updated_at on public.claim_document_verifications;
create trigger trg_claim_document_verifications_updated_at
before update on public.claim_document_verifications
for each row
execute function public.set_claim_document_verifications_updated_at();

alter table public.claim_document_verifications enable row level security;

drop policy if exists "Portal claim users can read claim document verifications" on public.claim_document_verifications;
create policy "Portal claim users can read claim document verifications"
on public.claim_document_verifications
for select
using (public.is_claim_portal_user());

drop policy if exists "Portal claim users can insert claim document verifications" on public.claim_document_verifications;
create policy "Portal claim users can insert claim document verifications"
on public.claim_document_verifications
for insert
with check (public.is_claim_portal_user());

drop policy if exists "Portal claim users can update claim document verifications" on public.claim_document_verifications;
create policy "Portal claim users can update claim document verifications"
on public.claim_document_verifications
for update
using (public.is_claim_portal_user())
with check (public.is_claim_portal_user());

comment on table public.claim_document_verifications is 'Permanent structured audit trail of claim document verification data such as RC validity, insurance validity, NCB, GVW and invalid reasons.';
