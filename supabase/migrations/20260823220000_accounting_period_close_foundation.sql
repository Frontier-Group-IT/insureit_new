create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status text not null default 'Open' check (status in ('Open','Ready','Closed','Reopened')),
  readiness_snapshot jsonb not null default '{}'::jsonb,
  close_reason text,
  reopen_reason text,
  created_by uuid not null references public.profiles(id),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  reopened_by uuid references public.profiles(id),
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_periods_dates_check check (period_end >= period_start),
  unique(period_start,period_end)
);
create index if not exists accounting_periods_status_dates_idx on public.accounting_periods(status,period_start,period_end);
create index if not exists accounting_periods_created_by_idx on public.accounting_periods(created_by);
create index if not exists accounting_periods_closed_by_idx on public.accounting_periods(closed_by) where closed_by is not null;
create index if not exists accounting_periods_reopened_by_idx on public.accounting_periods(reopened_by) where reopened_by is not null;

create table if not exists public.accounting_period_events (
  id uuid primary key default gen_random_uuid(),
  accounting_period_id uuid not null references public.accounting_periods(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  reason text,
  event_data jsonb not null default '{}'::jsonb,
  actor_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists accounting_period_events_period_created_idx on public.accounting_period_events(accounting_period_id,created_at desc);
create index if not exists accounting_period_events_actor_idx on public.accounting_period_events(actor_profile_id);

alter table public.accounting_periods enable row level security;
alter table public.accounting_period_events enable row level security;
revoke all on table public.accounting_periods from anon,authenticated;
revoke all on table public.accounting_period_events from anon,authenticated;
grant all on table public.accounting_periods to service_role;
grant all on table public.accounting_period_events to service_role;

create or replace function public.accounting_date_is_closed(p_date date) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.accounting_periods where status='Closed' and p_date between period_start and period_end)
$$;
revoke all on function public.accounting_date_is_closed(date) from public,anon,authenticated;
grant execute on function public.accounting_date_is_closed(date) to service_role;

create or replace function public.guard_closed_accounting_date() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_date date;
begin
  v_date := case TG_ARGV[0]
    when 'entry_date' then NEW.entry_date
    when 'receipt_date' then NEW.receipt_date
    when 'tds_date' then NEW.tds_date
    when 'payment_date' then NEW.payment_date
    when 'invoice_date' then NEW.invoice_date
    else null end;
  if v_date is not null and public.accounting_date_is_closed(v_date) then raise exception 'Accounting period is closed for %',v_date; end if;
  return NEW;
end $$;

create or replace function public.guard_closed_invoice_document() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if TG_OP='INSERT' then
    if NEW.invoice_date is not null and public.accounting_date_is_closed(NEW.invoice_date) then raise exception 'Accounting period is closed for invoice date %',NEW.invoice_date; end if;
  elsif NEW.invoice_no is distinct from OLD.invoice_no or NEW.invoice_date is distinct from OLD.invoice_date or NEW.due_date is distinct from OLD.due_date or NEW.accounting_period_start is distinct from OLD.accounting_period_start or NEW.accounting_period_end is distinct from OLD.accounting_period_end or NEW.brokerage_subtotal is distinct from OLD.brokerage_subtotal or NEW.tax_amount is distinct from OLD.tax_amount or NEW.gross_invoice_amount is distinct from OLD.gross_invoice_amount or NEW.tax_treatment is distinct from OLD.tax_treatment then
    if coalesce(NEW.invoice_date,OLD.invoice_date) is not null and public.accounting_date_is_closed(coalesce(NEW.invoice_date,OLD.invoice_date)) then raise exception 'Closed-period invoice document cannot be changed'; end if;
  end if;
  return NEW;
end $$;

drop trigger if exists accounts_receivable_closed_period_guard on public.accounts_receivable_entries;
create trigger accounts_receivable_closed_period_guard before insert on public.accounts_receivable_entries for each row execute function public.guard_closed_accounting_date('entry_date');
drop trigger if exists accounts_receipts_closed_period_guard on public.accounts_receipts;
create trigger accounts_receipts_closed_period_guard before insert on public.accounts_receipts for each row execute function public.guard_closed_accounting_date('receipt_date');
drop trigger if exists accounts_tds_closed_period_guard on public.accounts_tds_entries;
create trigger accounts_tds_closed_period_guard before insert on public.accounts_tds_entries for each row execute function public.guard_closed_accounting_date('tds_date');
drop trigger if exists partner_payments_closed_period_guard on public.partner_payments;
create trigger partner_payments_closed_period_guard before insert on public.partner_payments for each row execute function public.guard_closed_accounting_date('payment_date');
drop trigger if exists accounts_invoice_document_closed_period_guard on public.accounts_invoices;
create trigger accounts_invoice_document_closed_period_guard before insert or update on public.accounts_invoices for each row execute function public.guard_closed_invoice_document();

create or replace function public.guard_reconciliation_cycle_closed_period() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_start date; v_end date;
begin
  v_start:=coalesce(NEW.accounting_period_start,NEW.period_start); v_end:=coalesce(NEW.accounting_period_end,NEW.period_end);
  if exists(select 1 from public.accounting_periods p where p.status='Closed' and daterange(v_start,v_end,'[]') && daterange(p.period_start,p.period_end,'[]')) then raise exception 'Reconciliation accounting period overlaps a closed period'; end if;
  return NEW;
end $$;
drop trigger if exists reconciliation_cycle_closed_period_guard on public.reconciliation_cycles;
create trigger reconciliation_cycle_closed_period_guard before insert or update on public.reconciliation_cycles for each row execute function public.guard_reconciliation_cycle_closed_period();

create or replace function public.guard_reconciliation_line_closed_period() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_cycle uuid; v_start date; v_end date;
begin
  v_cycle:=coalesce(NEW.cycle_id,OLD.cycle_id);
  select coalesce(accounting_period_start,period_start),coalesce(accounting_period_end,period_end) into v_start,v_end from public.reconciliation_cycles where id=v_cycle;
  if exists(select 1 from public.accounting_periods p where p.status='Closed' and daterange(v_start,v_end,'[]') && daterange(p.period_start,p.period_end,'[]')) then raise exception 'Closed-period reconciliation transactions cannot be changed'; end if;
  return coalesce(NEW,OLD);
end $$;
drop trigger if exists reconciliation_line_closed_period_guard on public.reconciliation_lines;
create trigger reconciliation_line_closed_period_guard before insert or update or delete on public.reconciliation_lines for each row execute function public.guard_reconciliation_line_closed_period();

create or replace function public.create_accounting_period(p_start date,p_end date,p_actor uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if p_end<p_start then raise exception 'Period end must be on or after start'; end if;
  if exists(select 1 from public.accounting_periods where daterange(period_start,period_end,'[]') && daterange(p_start,p_end,'[]')) then raise exception 'Accounting period overlaps an existing period'; end if;
  insert into public.accounting_periods(period_start,period_end,status,created_by) values(p_start,p_end,'Open',p_actor) returning id into v_id;
  insert into public.accounting_period_events(accounting_period_id,event_type,to_status,actor_profile_id) values(v_id,'Period created','Open',p_actor);
  return v_id;
end $$;

create or replace function public.close_accounting_period(p_period_id uuid,p_snapshot jsonb,p_reason text,p_actor uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_row public.accounting_periods%rowtype;
begin
  if nullif(btrim(p_reason),'') is null then raise exception 'Close reason is required'; end if;
  select * into v_row from public.accounting_periods where id=p_period_id for update;
  if not found or v_row.status not in ('Open','Ready','Reopened') then raise exception 'Period is not open for close'; end if;
  update public.accounting_periods set status='Closed',readiness_snapshot=coalesce(p_snapshot,'{}'::jsonb),close_reason=btrim(p_reason),closed_by=p_actor,closed_at=now(),reopen_reason=null,reopened_by=null,reopened_at=null,updated_at=now() where id=p_period_id;
  insert into public.accounting_period_events(accounting_period_id,event_type,from_status,to_status,reason,event_data,actor_profile_id) values(p_period_id,'Period closed',v_row.status,'Closed',btrim(p_reason),coalesce(p_snapshot,'{}'::jsonb),p_actor);
end $$;

create or replace function public.reopen_accounting_period(p_period_id uuid,p_reason text,p_actor uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_row public.accounting_periods%rowtype;
begin
  if nullif(btrim(p_reason),'') is null then raise exception 'Reopen reason is required'; end if;
  select * into v_row from public.accounting_periods where id=p_period_id for update;
  if not found or v_row.status<>'Closed' then raise exception 'Only Closed periods can be reopened'; end if;
  update public.accounting_periods set status='Reopened',reopen_reason=btrim(p_reason),reopened_by=p_actor,reopened_at=now(),updated_at=now() where id=p_period_id;
  insert into public.accounting_period_events(accounting_period_id,event_type,from_status,to_status,reason,actor_profile_id) values(p_period_id,'Period reopened','Closed','Reopened',btrim(p_reason),p_actor);
end $$;

revoke all on function public.create_accounting_period(date,date,uuid) from public,anon,authenticated;
revoke all on function public.close_accounting_period(uuid,jsonb,text,uuid) from public,anon,authenticated;
revoke all on function public.reopen_accounting_period(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.create_accounting_period(date,date,uuid) to service_role;
grant execute on function public.close_accounting_period(uuid,jsonb,text,uuid) to service_role;
grant execute on function public.reopen_accounting_period(uuid,text,uuid) to service_role;
