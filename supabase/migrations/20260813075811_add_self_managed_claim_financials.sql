create table if not exists public.claim_financials (
  claim_id uuid primary key references public.claims(id) on delete cascade,
  estimate_amount numeric,
  approved_amount numeric,
  bill_amount numeric,
  do_amount numeric,
  customer_paid_amount numeric,
  payment_received_amount numeric,
  further_deduction_amount numeric,
  cashless boolean,
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claim_financials_non_negative check (
    coalesce(estimate_amount,0) >= 0 and coalesce(approved_amount,0) >= 0 and
    coalesce(bill_amount,0) >= 0 and coalesce(do_amount,0) >= 0 and
    coalesce(customer_paid_amount,0) >= 0 and coalesce(payment_received_amount,0) >= 0 and
    coalesce(further_deduction_amount,0) >= 0
  )
);

alter table public.claim_financials enable row level security;

drop policy if exists claim_financials_read_accessible_customer on public.claim_financials;
create policy claim_financials_read_accessible_customer on public.claim_financials
for select using (
  exists (
    select 1 from public.claims c
    where c.id = claim_financials.claim_id
      and public.can_access_customer(c.customer_id)
  )
);

drop policy if exists claim_financials_customer_write_self_managed on public.claim_financials;
create policy claim_financials_customer_write_self_managed on public.claim_financials
for all using (
  exists (
    select 1 from public.claims c
    where c.id = claim_financials.claim_id
      and c.claim_service_mode = 'self_managed'
      and public.can_access_customer(c.customer_id)
  )
) with check (
  exists (
    select 1 from public.claims c
    where c.id = claim_financials.claim_id
      and c.claim_service_mode = 'self_managed'
      and public.can_access_customer(c.customer_id)
  )
);

create or replace function public.set_claim_financials_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_claim_financials_updated_at on public.claim_financials;
create trigger trg_claim_financials_updated_at before update on public.claim_financials
for each row execute function public.set_claim_financials_updated_at();
