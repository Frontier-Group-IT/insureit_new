create table if not exists public.accounts_invoices (
  id uuid primary key default gen_random_uuid(),
  insurer_id uuid not null references public.insurance_companies(id),
  reconciliation_cycle_id uuid references public.reconciliation_cycles(id),
  invoice_no text,
  invoice_date date,
  due_date date,
  accounting_period_start date,
  accounting_period_end date,
  status text not null default 'Draft' check (status in ('Draft','Raised','Partially Received','Received','Adjusted','Cancelled')),
  brokerage_subtotal numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  gross_invoice_amount numeric(14,2) not null default 0,
  outstanding_amount numeric(14,2) not null default 0,
  tax_treatment text,
  notes text,
  created_by uuid not null references public.profiles(id),
  raised_by uuid references public.profiles(id),
  raised_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_invoices_period_check check (accounting_period_start is null or accounting_period_end is null or accounting_period_end >= accounting_period_start),
  constraint accounts_invoices_due_check check (invoice_date is null or due_date is null or due_date >= invoice_date),
  constraint accounts_invoices_amounts_check check (tax_amount >= 0 and gross_invoice_amount >= 0 and outstanding_amount >= 0)
);

create unique index if not exists accounts_invoices_invoice_no_uidx on public.accounts_invoices (upper(invoice_no)) where invoice_no is not null and btrim(invoice_no) <> '';
create index if not exists accounts_invoices_insurer_status_idx on public.accounts_invoices (insurer_id,status,invoice_date desc);
create index if not exists accounts_invoices_cycle_idx on public.accounts_invoices (reconciliation_cycle_id) where reconciliation_cycle_id is not null;
create index if not exists accounts_invoices_created_by_idx on public.accounts_invoices (created_by);
create index if not exists accounts_invoices_raised_by_idx on public.accounts_invoices (raised_by) where raised_by is not null;

create table if not exists public.accounts_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.accounts_invoices(id) on delete cascade,
  reconciliation_line_id uuid references public.reconciliation_lines(id),
  policy_id uuid references public.policies(id),
  policy_no text,
  line_type text not null default 'Brokerage' check (line_type in ('Brokerage','Adjustment')),
  recognized_brokerage_amount numeric(14,2) not null default 0,
  adjustment_amount numeric(14,2) not null default 0,
  invoice_line_amount numeric(14,2) not null default 0,
  description text,
  created_at timestamptz not null default now()
);

create unique index if not exists accounts_invoice_lines_recon_uidx on public.accounts_invoice_lines (reconciliation_line_id) where reconciliation_line_id is not null;
create index if not exists accounts_invoice_lines_invoice_idx on public.accounts_invoice_lines (invoice_id);
create index if not exists accounts_invoice_lines_policy_idx on public.accounts_invoice_lines (policy_id) where policy_id is not null;

create table if not exists public.accounts_receivable_entries (
  id uuid primary key default gen_random_uuid(),
  insurer_id uuid not null references public.insurance_companies(id),
  invoice_id uuid references public.accounts_invoices(id),
  entry_date date not null,
  entry_type text not null check (entry_type in ('Invoice','Receipt','TDS','Adjustment','Credit Note','Debit Note','Reversal')),
  document_reference text,
  debit_amount numeric(14,2) not null default 0,
  credit_amount numeric(14,2) not null default 0,
  description text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint accounts_receivable_nonnegative_check check (debit_amount >= 0 and credit_amount >= 0),
  constraint accounts_receivable_one_side_check check ((debit_amount > 0 and credit_amount = 0) or (credit_amount > 0 and debit_amount = 0))
);

create unique index if not exists accounts_receivable_invoice_post_uidx on public.accounts_receivable_entries (invoice_id,entry_type) where invoice_id is not null and entry_type='Invoice';
create index if not exists accounts_receivable_insurer_date_idx on public.accounts_receivable_entries (insurer_id,entry_date,id);
create index if not exists accounts_receivable_invoice_idx on public.accounts_receivable_entries (invoice_id) where invoice_id is not null;
create index if not exists accounts_receivable_created_by_idx on public.accounts_receivable_entries (created_by);

create table if not exists public.accounts_invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.accounts_invoices(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  reason text,
  event_data jsonb not null default '{}'::jsonb,
  actor_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists accounts_invoice_events_invoice_created_idx on public.accounts_invoice_events (invoice_id,created_at desc);
create index if not exists accounts_invoice_events_actor_idx on public.accounts_invoice_events (actor_profile_id);

alter table public.accounts_invoices enable row level security;
alter table public.accounts_invoice_lines enable row level security;
alter table public.accounts_receivable_entries enable row level security;
alter table public.accounts_invoice_events enable row level security;

revoke all on table public.accounts_invoices from anon, authenticated;
revoke all on table public.accounts_invoice_lines from anon, authenticated;
revoke all on table public.accounts_receivable_entries from anon, authenticated;
revoke all on table public.accounts_invoice_events from anon, authenticated;

grant all on table public.accounts_invoices to service_role;
grant all on table public.accounts_invoice_lines to service_role;
grant all on table public.accounts_receivable_entries to service_role;
grant all on table public.accounts_invoice_events to service_role;
