create table if not exists public.accounts_receipts (
  id uuid primary key default gen_random_uuid(),
  insurer_id uuid not null references public.insurance_companies(id),
  receipt_date date not null,
  bank_reference text not null,
  bank_amount numeric(14,2) not null check (bank_amount > 0),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index if not exists accounts_receipts_insurer_bank_ref_uidx on public.accounts_receipts(insurer_id,upper(bank_reference));
create index if not exists accounts_receipts_insurer_date_idx on public.accounts_receipts(insurer_id,receipt_date desc);
create index if not exists accounts_receipts_created_by_idx on public.accounts_receipts(created_by);

create table if not exists public.accounts_receipt_allocations (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.accounts_receipts(id) on delete cascade,
  invoice_id uuid not null references public.accounts_invoices(id),
  allocated_amount numeric(14,2) not null check (allocated_amount > 0),
  created_at timestamptz not null default now(),
  unique(receipt_id,invoice_id)
);
create index if not exists accounts_receipt_allocations_invoice_idx on public.accounts_receipt_allocations(invoice_id);

create table if not exists public.accounts_tds_entries (
  id uuid primary key default gen_random_uuid(),
  insurer_id uuid not null references public.insurance_companies(id),
  invoice_id uuid not null references public.accounts_invoices(id),
  tds_date date not null,
  tds_amount numeric(14,2) not null check (tds_amount > 0),
  certificate_period text,
  certificate_reference text,
  matched_status text not null default 'Pending' check (matched_status in ('Pending','Matched','Mismatch')),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists accounts_tds_entries_insurer_date_idx on public.accounts_tds_entries(insurer_id,tds_date desc);
create index if not exists accounts_tds_entries_invoice_idx on public.accounts_tds_entries(invoice_id);
create index if not exists accounts_tds_entries_created_by_idx on public.accounts_tds_entries(created_by);

alter table public.accounts_receipts enable row level security;
alter table public.accounts_receipt_allocations enable row level security;
alter table public.accounts_tds_entries enable row level security;
revoke all on table public.accounts_receipts from anon,authenticated;
revoke all on table public.accounts_receipt_allocations from anon,authenticated;
revoke all on table public.accounts_tds_entries from anon,authenticated;
grant all on table public.accounts_receipts to service_role;
grant all on table public.accounts_receipt_allocations to service_role;
grant all on table public.accounts_tds_entries to service_role;
