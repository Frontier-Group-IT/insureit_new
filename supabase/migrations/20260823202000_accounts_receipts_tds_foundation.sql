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

create or replace function public.post_accounts_receipt(
  p_insurer_id uuid,
  p_receipt_date date,
  p_bank_reference text,
  p_bank_amount numeric,
  p_notes text,
  p_created_by uuid,
  p_allocations jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt_id uuid;
  v_alloc jsonb;
  v_invoice public.accounts_invoices%rowtype;
  v_amount numeric(14,2);
  v_total numeric(14,2) := 0;
  v_next numeric(14,2);
  v_next_status text;
begin
  if p_bank_amount <= 0 or nullif(btrim(p_bank_reference),'') is null then raise exception 'Positive bank amount and bank reference are required'; end if;
  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations)=0 then raise exception 'At least one allocation is required'; end if;
  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    v_amount := round(coalesce((v_alloc->>'amount')::numeric,0),2);
    if v_amount <= 0 then raise exception 'Allocation amount must be positive'; end if;
    select * into v_invoice from public.accounts_invoices where id=(v_alloc->>'invoiceId')::uuid for update;
    if not found then raise exception 'Invoice not found'; end if;
    if v_invoice.insurer_id <> p_insurer_id or v_invoice.status not in ('Raised','Partially Received') then raise exception 'Invoice not eligible for receipt allocation'; end if;
    if v_amount > v_invoice.outstanding_amount then raise exception 'Allocation exceeds invoice outstanding'; end if;
    v_total := v_total + v_amount;
  end loop;
  if round(v_total,2) <> round(p_bank_amount,2) then raise exception 'Allocations must equal bank amount'; end if;

  insert into public.accounts_receipts(insurer_id,receipt_date,bank_reference,bank_amount,notes,created_by)
  values(p_insurer_id,p_receipt_date,btrim(p_bank_reference),round(p_bank_amount,2),nullif(btrim(coalesce(p_notes,'')),''),p_created_by)
  returning id into v_receipt_id;

  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    v_amount := round((v_alloc->>'amount')::numeric,2);
    select * into v_invoice from public.accounts_invoices where id=(v_alloc->>'invoiceId')::uuid for update;
    insert into public.accounts_receipt_allocations(receipt_id,invoice_id,allocated_amount) values(v_receipt_id,v_invoice.id,v_amount);
    insert into public.accounts_receivable_entries(insurer_id,invoice_id,entry_date,entry_type,document_reference,debit_amount,credit_amount,description,created_by)
    values(p_insurer_id,v_invoice.id,p_receipt_date,'Receipt',btrim(p_bank_reference),0,v_amount,'Bank receipt allocated',p_created_by);
    v_next := round(v_invoice.outstanding_amount-v_amount,2);
    v_next_status := case when v_next=0 then 'Received' else 'Partially Received' end;
    update public.accounts_invoices set outstanding_amount=v_next,status=v_next_status,updated_at=now() where id=v_invoice.id;
    insert into public.accounts_invoice_events(invoice_id,event_type,from_status,to_status,event_data,actor_profile_id)
    values(v_invoice.id,'Receipt allocated',v_invoice.status,v_next_status,jsonb_build_object('receipt_id',v_receipt_id,'amount',v_amount,'bank_reference',btrim(p_bank_reference)),p_created_by);
  end loop;
  return v_receipt_id;
end;
$$;

create or replace function public.post_accounts_tds(
  p_invoice_id uuid,
  p_tds_date date,
  p_tds_amount numeric,
  p_certificate_period text,
  p_certificate_reference text,
  p_matched_status text,
  p_notes text,
  p_created_by uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.accounts_invoices%rowtype;
  v_tds_id uuid;
  v_amount numeric(14,2) := round(p_tds_amount,2);
  v_next numeric(14,2);
  v_next_status text;
begin
  select * into v_invoice from public.accounts_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.status not in ('Raised','Partially Received') or v_amount<=0 or v_amount>v_invoice.outstanding_amount then raise exception 'TDS exceeds eligible invoice balance or is invalid'; end if;
  if p_matched_status not in ('Pending','Matched','Mismatch') then raise exception 'Invalid TDS match status'; end if;
  insert into public.accounts_tds_entries(insurer_id,invoice_id,tds_date,tds_amount,certificate_period,certificate_reference,matched_status,notes,created_by)
  values(v_invoice.insurer_id,v_invoice.id,p_tds_date,v_amount,nullif(btrim(coalesce(p_certificate_period,'')),''),nullif(btrim(coalesce(p_certificate_reference,'')),''),p_matched_status,nullif(btrim(coalesce(p_notes,'')),''),p_created_by)
  returning id into v_tds_id;
  insert into public.accounts_receivable_entries(insurer_id,invoice_id,entry_date,entry_type,document_reference,debit_amount,credit_amount,description,created_by)
  values(v_invoice.insurer_id,v_invoice.id,p_tds_date,'TDS',coalesce(nullif(btrim(coalesce(p_certificate_reference,'')),''),nullif(btrim(coalesce(p_certificate_period,'')),''),'TDS'),0,v_amount,'TDS receivable recognized',p_created_by);
  v_next := round(v_invoice.outstanding_amount-v_amount,2);
  v_next_status := case when v_next=0 then 'Received' else 'Partially Received' end;
  update public.accounts_invoices set outstanding_amount=v_next,status=v_next_status,updated_at=now() where id=v_invoice.id;
  insert into public.accounts_invoice_events(invoice_id,event_type,from_status,to_status,event_data,actor_profile_id)
  values(v_invoice.id,'TDS recorded',v_invoice.status,v_next_status,jsonb_build_object('tds_id',v_tds_id,'amount',v_amount),p_created_by);
  return v_tds_id;
end;
$$;

revoke all on function public.post_accounts_receipt(uuid,date,text,numeric,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.post_accounts_tds(uuid,date,numeric,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.post_accounts_receipt(uuid,date,text,numeric,text,uuid,jsonb) to service_role;
grant execute on function public.post_accounts_tds(uuid,date,numeric,text,text,text,text,uuid) to service_role;
