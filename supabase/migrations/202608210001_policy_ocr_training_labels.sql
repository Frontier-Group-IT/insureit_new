-- Store only human-approved OCR ground truth for policy-copy training.
-- Raw policy files and OCR text remain in private storage and are never copied into fixtures.

create table if not exists public.policy_ocr_training_labels (
  id uuid primary key default gen_random_uuid(),
  policy_document_id uuid not null references public.policy_documents(id) on delete cascade,
  insurer_name text,
  policy_product text,
  policy_number text,
  valid_from date,
  valid_upto date,
  idv numeric,
  od_premium numeric,
  tp_premium numeric,
  cpa_opted boolean,
  cpa_premium numeric,
  printed_net_premium numeric,
  printed_gst numeric,
  printed_gross_premium numeric,
  evidence_note text,
  status text not null default 'needs_review'
    check (status in ('needs_review', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint policy_ocr_training_labels_document_unique unique (policy_document_id)
);

create index if not exists policy_ocr_training_labels_status_idx
  on public.policy_ocr_training_labels(status);

alter table public.policy_ocr_training_labels enable row level security;

drop policy if exists "policy OCR training labels operations manage"
  on public.policy_ocr_training_labels;
create policy "policy OCR training labels operations manage"
on public.policy_ocr_training_labels for all
to authenticated
using (public.is_operations_role())
with check (public.is_operations_role());

drop trigger if exists policy_ocr_training_labels_updated_at
  on public.policy_ocr_training_labels;
create trigger policy_ocr_training_labels_updated_at
before update on public.policy_ocr_training_labels
for each row execute function public.set_updated_at();
