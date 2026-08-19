begin;

alter table public.customers
  add column if not exists creation_channel text not null default 'legacy',
  add column if not exists origin_customer_id uuid null;

alter table public.customers
  drop constraint if exists customers_creation_channel_check;

alter table public.customers
  add constraint customers_creation_channel_check
  check (
    creation_channel in (
      'legacy',
      'direct_customer_onboarding',
      'policy_onboarding',
      'group_onboarding',
      'corporate_onboarding',
      'dealership_onboarding',
      'group_customer_onboarding',
      'corporate_customer_onboarding',
      'dealership_customer_onboarding'
    )
  );

alter table public.customers
  drop constraint if exists customers_origin_customer_id_fkey;

alter table public.customers
  add constraint customers_origin_customer_id_fkey
  foreign key (origin_customer_id)
  references public.customers(id)
  on delete set null;

create index if not exists customers_creation_channel_idx
  on public.customers (creation_channel);

create index if not exists customers_origin_customer_id_idx
  on public.customers (origin_customer_id)
  where origin_customer_id is not null;

create or replace function public.protect_customer_creation_provenance()
returns trigger
language plpgsql
as $$
begin
  if old.creation_channel <> 'legacy' then
    new.creation_channel := old.creation_channel;
    new.origin_customer_id := old.origin_customer_id;
    return new;
  end if;

  -- Existing rows are deliberately introduced as legacy. Allow exactly one
  -- later classification from legacy to a known source, which is required for
  -- policy onboarding because the customer is created inside an existing RPC
  -- before the application receives the new customer id.
  if new.creation_channel = 'legacy' then
    new.origin_customer_id := old.origin_customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_customer_creation_provenance on public.customers;
create trigger protect_customer_creation_provenance
before update of creation_channel, origin_customer_id on public.customers
for each row execute function public.protect_customer_creation_provenance();

comment on column public.customers.creation_channel is
  'Immutable creation workflow for the customer. Existing rows remain legacy unless a reliable origin is known.';

comment on column public.customers.origin_customer_id is
  'Customer account (group/corporate/dealership) under which this customer was originally created. This is creation provenance, not current membership.';

commit;
