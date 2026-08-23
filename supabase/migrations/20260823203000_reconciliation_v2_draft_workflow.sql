alter table public.reconciliation_cycles
  add column if not exists statement_date date,
  add column if not exists accounting_period_start date,
  add column if not exists accounting_period_end date,
  add column if not exists settlement_cycle text,
  add column if not exists source_method text not null default 'manual',
  add column if not exists draft_payload jsonb,
  add column if not exists draft_saved_at timestamptz;

alter table public.reconciliation_cycles
  drop constraint if exists reconciliation_cycles_status_check;
alter table public.reconciliation_cycles
  add constraint reconciliation_cycles_status_check
  check (status in ('Draft','Submitted','Under Review','Reconciled','Closed','Reopened'));

alter table public.reconciliation_cycles
  drop constraint if exists reconciliation_cycles_source_method_check;
alter table public.reconciliation_cycles
  add constraint reconciliation_cycles_source_method_check
  check (source_method in ('manual','excel_paste','template_import','expected_policies'));

alter table public.reconciliation_cycles
  drop constraint if exists reconciliation_cycles_accounting_period_check;
alter table public.reconciliation_cycles
  add constraint reconciliation_cycles_accounting_period_check
  check (
    accounting_period_start is null
    or accounting_period_end is null
    or accounting_period_end >= accounting_period_start
  );

alter table public.reconciliation_cycles
  alter column status set default 'Draft',
  alter column submitted_at drop not null,
  alter column submitted_at drop default;

create index if not exists reconciliation_cycles_status_updated_idx
  on public.reconciliation_cycles(status, updated_at desc);
create index if not exists reconciliation_cycles_draft_owner_idx
  on public.reconciliation_cycles(created_by, status, draft_saved_at desc);
