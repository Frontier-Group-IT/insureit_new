create table if not exists public.partner_payables (
  id uuid primary key default gen_random_uuid(),
  policy_payout_id uuid not null references public.policy_intermediary_payouts(id),
  policy_id uuid not null references public.policies(id),
  intermediary_type text,
  intermediary_code text,
  agreed_amount numeric(14,2) not null check (agreed_amount >= 0),
  outstanding_amount numeric(14,2) not null check (outstanding_amount >= 0),
  status text not null default 'Eligible' check (status in ('Eligible','Payable Approved','Payment Initiated','Paid','Closed','Held')),
  eligibility_reason text not null,
  hold_reason text,
  created_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(policy_payout_id)
);
create index if not exists partner_payables_policy_idx on public.partner_payables(policy_id);
create index if not exists partner_payables_partner_status_idx on public.partner_payables(intermediary_code,status,created_at desc);
create index if not exists partner_payables_created_by_idx on public.partner_payables(created_by);
create index if not exists partner_payables_approved_by_idx on public.partner_payables(approved_by) where approved_by is not null;
create index if not exists partner_payables_closed_by_idx on public.partner_payables(closed_by) where closed_by is not null;

create table if not exists public.partner_payments (
  id uuid primary key default gen_random_uuid(),
  intermediary_type text,
  intermediary_code text not null,
  payment_date date not null,
  payment_reference text not null,
  payment_amount numeric(14,2) not null check (payment_amount > 0),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index if not exists partner_payments_reference_uidx on public.partner_payments(upper(intermediary_code),upper(payment_reference));
create index if not exists partner_payments_partner_date_idx on public.partner_payments(intermediary_code,payment_date desc);
create index if not exists partner_payments_created_by_idx on public.partner_payments(created_by);

create table if not exists public.partner_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.partner_payments(id) on delete cascade,
  payable_id uuid not null references public.partner_payables(id),
  allocated_amount numeric(14,2) not null check (allocated_amount > 0),
  created_at timestamptz not null default now(),
  unique(payment_id,payable_id)
);
create index if not exists partner_payment_allocations_payable_idx on public.partner_payment_allocations(payable_id);

create table if not exists public.partner_payable_events (
  id uuid primary key default gen_random_uuid(),
  payable_id uuid not null references public.partner_payables(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  reason text,
  event_data jsonb not null default '{}'::jsonb,
  actor_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists partner_payable_events_payable_created_idx on public.partner_payable_events(payable_id,created_at desc);
create index if not exists partner_payable_events_actor_idx on public.partner_payable_events(actor_profile_id);

alter table public.partner_payables enable row level security;
alter table public.partner_payments enable row level security;
alter table public.partner_payment_allocations enable row level security;
alter table public.partner_payable_events enable row level security;
revoke all on table public.partner_payables from anon,authenticated;
revoke all on table public.partner_payments from anon,authenticated;
revoke all on table public.partner_payment_allocations from anon,authenticated;
revoke all on table public.partner_payable_events from anon,authenticated;
grant all on table public.partner_payables to service_role;
grant all on table public.partner_payments to service_role;
grant all on table public.partner_payment_allocations to service_role;
grant all on table public.partner_payable_events to service_role;

create or replace function public.create_partner_payable(p_policy_payout_id uuid,p_reason text,p_actor uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_source public.policy_intermediary_payouts%rowtype; v_id uuid;
begin
  if nullif(btrim(p_reason),'') is null then raise exception 'Eligibility reason is required'; end if;
  select * into v_source from public.policy_intermediary_payouts where id=p_policy_payout_id for update;
  if not found then raise exception 'Partner commercial not found'; end if;
  if v_source.commercial_status not in ('entered','reviewed') then raise exception 'Partner commercial must be entered/reviewed before eligibility'; end if;
  if v_source.status <> 'Pending' then raise exception 'Historical/non-pending payout cannot be converted automatically'; end if;
  if v_source.gross_payout <= 0 then raise exception 'Zero agreed payout does not create a payable'; end if;
  insert into public.partner_payables(policy_payout_id,policy_id,intermediary_type,intermediary_code,agreed_amount,outstanding_amount,status,eligibility_reason,created_by)
  values(v_source.id,v_source.policy_id,v_source.intermediary_type,v_source.intermediary_code,v_source.gross_payout,v_source.gross_payout,'Eligible',btrim(p_reason),p_actor)
  returning id into v_id;
  insert into public.partner_payable_events(payable_id,event_type,to_status,reason,event_data,actor_profile_id)
  values(v_id,'Marked eligible','Eligible',btrim(p_reason),jsonb_build_object('agreed_amount',v_source.gross_payout),p_actor);
  return v_id;
end $$;

create or replace function public.approve_partner_payable(p_payable_id uuid,p_actor uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_row public.partner_payables%rowtype;
begin
  select * into v_row from public.partner_payables where id=p_payable_id for update;
  if not found or v_row.status<>'Eligible' then raise exception 'Only Eligible payables can be approved'; end if;
  update public.partner_payables set status='Payable Approved',approved_by=p_actor,approved_at=now(),updated_at=now() where id=p_payable_id;
  insert into public.partner_payable_events(payable_id,event_type,from_status,to_status,actor_profile_id) values(p_payable_id,'Payable approved','Eligible','Payable Approved',p_actor);
end $$;

create or replace function public.set_partner_payable_hold(p_payable_id uuid,p_hold boolean,p_reason text,p_actor uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_row public.partner_payables%rowtype; v_next text;
begin
  select * into v_row from public.partner_payables where id=p_payable_id for update;
  if not found then raise exception 'Payable not found'; end if;
  if p_hold then
    if v_row.status not in ('Eligible','Payable Approved') then raise exception 'Only unpaid payables can be held'; end if;
    if nullif(btrim(p_reason),'') is null then raise exception 'Hold reason is required'; end if;
    v_next:='Held';
    update public.partner_payables set status=v_next,hold_reason=btrim(p_reason),updated_at=now() where id=p_payable_id;
  else
    if v_row.status<>'Held' then raise exception 'Payable is not held'; end if;
    v_next:=case when v_row.approved_at is null then 'Eligible' else 'Payable Approved' end;
    update public.partner_payables set status=v_next,hold_reason=null,updated_at=now() where id=p_payable_id;
  end if;
  insert into public.partner_payable_events(payable_id,event_type,from_status,to_status,reason,actor_profile_id) values(p_payable_id,case when p_hold then 'Payable held' else 'Hold released' end,v_row.status,v_next,nullif(btrim(coalesce(p_reason,'')),''),p_actor);
end $$;

create or replace function public.post_partner_payment(p_intermediary_code text,p_intermediary_type text,p_payment_date date,p_payment_reference text,p_payment_amount numeric,p_notes text,p_actor uuid,p_allocations jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_payment uuid; v_alloc jsonb; v_row public.partner_payables%rowtype; v_amount numeric(14,2); v_total numeric(14,2):=0; v_next numeric(14,2); v_status text;
begin
  if nullif(btrim(p_intermediary_code),'') is null or nullif(btrim(p_payment_reference),'') is null or p_payment_amount<=0 then raise exception 'Partner, payment reference and positive amount are required'; end if;
  if jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)=0 then raise exception 'At least one payable allocation is required'; end if;
  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    v_amount:=round(coalesce((v_alloc->>'amount')::numeric,0),2);
    select * into v_row from public.partner_payables where id=(v_alloc->>'payableId')::uuid for update;
    if not found or v_row.status not in ('Payable Approved','Payment Initiated') then raise exception 'Payable is not approved for payment'; end if;
    if coalesce(v_row.intermediary_code,'')<>p_intermediary_code or v_amount<=0 or v_amount>v_row.outstanding_amount then raise exception 'Payment allocation does not match partner or outstanding'; end if;
    v_total:=v_total+v_amount;
  end loop;
  if round(v_total,2)<>round(p_payment_amount,2) then raise exception 'Allocations must equal payment amount'; end if;
  insert into public.partner_payments(intermediary_type,intermediary_code,payment_date,payment_reference,payment_amount,notes,created_by)
  values(nullif(btrim(coalesce(p_intermediary_type,'')),''),btrim(p_intermediary_code),p_payment_date,btrim(p_payment_reference),round(p_payment_amount,2),nullif(btrim(coalesce(p_notes,'')),''),p_actor)
  returning id into v_payment;
  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    v_amount:=round((v_alloc->>'amount')::numeric,2);
    select * into v_row from public.partner_payables where id=(v_alloc->>'payableId')::uuid for update;
    insert into public.partner_payment_allocations(payment_id,payable_id,allocated_amount) values(v_payment,v_row.id,v_amount);
    v_next:=round(v_row.outstanding_amount-v_amount,2);
    v_status:=case when v_next=0 then 'Paid' else 'Payment Initiated' end;
    update public.partner_payables set outstanding_amount=v_next,status=v_status,updated_at=now() where id=v_row.id;
    insert into public.partner_payable_events(payable_id,event_type,from_status,to_status,event_data,actor_profile_id)
    values(v_row.id,'Payment allocated',v_row.status,v_status,jsonb_build_object('payment_id',v_payment,'amount',v_amount,'payment_reference',btrim(p_payment_reference)),p_actor);
  end loop;
  return v_payment;
end $$;

create or replace function public.close_partner_payable(p_payable_id uuid,p_actor uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_row public.partner_payables%rowtype;
begin
  select * into v_row from public.partner_payables where id=p_payable_id for update;
  if not found or v_row.status<>'Paid' or v_row.outstanding_amount<>0 then raise exception 'Only fully Paid payables can be closed'; end if;
  update public.partner_payables set status='Closed',closed_by=p_actor,closed_at=now(),updated_at=now() where id=p_payable_id;
  insert into public.partner_payable_events(payable_id,event_type,from_status,to_status,actor_profile_id) values(p_payable_id,'Payable closed','Paid','Closed',p_actor);
end $$;

revoke all on function public.create_partner_payable(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.approve_partner_payable(uuid,uuid) from public,anon,authenticated;
revoke all on function public.set_partner_payable_hold(uuid,boolean,text,uuid) from public,anon,authenticated;
revoke all on function public.post_partner_payment(text,text,date,text,numeric,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.close_partner_payable(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_partner_payable(uuid,text,uuid) to service_role;
grant execute on function public.approve_partner_payable(uuid,uuid) to service_role;
grant execute on function public.set_partner_payable_hold(uuid,boolean,text,uuid) to service_role;
grant execute on function public.post_partner_payment(text,text,date,text,numeric,text,uuid,jsonb) to service_role;
grant execute on function public.close_partner_payable(uuid,uuid) to service_role;
