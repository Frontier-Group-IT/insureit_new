create table if not exists public.reconciliation_cycles (
  id uuid primary key default gen_random_uuid(),
  insurer_id uuid not null references public.insurance_companies(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  statement_reference text null,
  status text not null default 'Submitted' check (status in ('Submitted','Under Review','Reconciled','Closed','Reopened')),
  row_count integer not null default 0,
  matched_row_count integer not null default 0,
  variance_row_count integer not null default 0,
  projected_total numeric(18,2) not null default 0,
  actual_total numeric(18,2) not null default 0,
  adjustment_total numeric(18,2) not null default 0,
  tds_total numeric(18,2) not null default 0,
  variance_total numeric(18,2) not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid null references public.profiles(id) on delete restrict,
  reviewed_at timestamptz null,
  closed_by uuid null references public.profiles(id) on delete restrict,
  closed_at timestamptz null,
  reopened_by uuid null references public.profiles(id) on delete restrict,
  reopened_at timestamptz null,
  reopen_reason text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.reconciliation_lines (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.reconciliation_cycles(id) on delete cascade,
  source_row_no integer not null,
  input_policy_no text not null,
  normalized_policy_no text not null,
  policy_id uuid null references public.policies(id) on delete restrict,
  match_status text not null check (match_status in ('Matched','Unmatched')),
  projected_payin_snapshot numeric(18,2) null,
  actual_recognized_payin numeric(18,2) not null,
  tds_amount numeric(18,2) not null default 0,
  adjustment_amount numeric(18,2) not null default 0,
  variance_amount numeric(18,2) null,
  transaction_type text not null default 'Commission',
  variance_reason text null,
  insurer_reference text null,
  remarks text null,
  review_status text not null default 'Pending' check (review_status in ('Pending','Accepted','Follow-up','Resolved')),
  reviewed_by uuid null references public.profiles(id) on delete restrict,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  unique(cycle_id, source_row_no)
);

create table if not exists public.reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.reconciliation_cycles(id) on delete cascade,
  line_id uuid null references public.reconciliation_lines(id) on delete cascade,
  event_type text not null,
  from_status text null,
  to_status text null,
  reason text null,
  event_data jsonb not null default '{}'::jsonb,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists reconciliation_cycles_insurer_period_idx on public.reconciliation_cycles(insurer_id, period_start, period_end);
create index if not exists reconciliation_cycles_status_idx on public.reconciliation_cycles(status, submitted_at desc);
create index if not exists reconciliation_lines_cycle_idx on public.reconciliation_lines(cycle_id, source_row_no);
create index if not exists reconciliation_lines_policy_idx on public.reconciliation_lines(policy_id);
create index if not exists reconciliation_lines_normalized_policy_idx on public.reconciliation_lines(normalized_policy_no);
create index if not exists reconciliation_lines_review_idx on public.reconciliation_lines(cycle_id, review_status);
create index if not exists reconciliation_events_cycle_idx on public.reconciliation_events(cycle_id, created_at);

alter table public.reconciliation_cycles enable row level security;
alter table public.reconciliation_lines enable row level security;
alter table public.reconciliation_events enable row level security;

revoke all on table public.reconciliation_cycles from anon, authenticated;
revoke all on table public.reconciliation_lines from anon, authenticated;
revoke all on table public.reconciliation_events from anon, authenticated;
grant all on table public.reconciliation_cycles to service_role;
grant all on table public.reconciliation_lines to service_role;
grant all on table public.reconciliation_events to service_role;
