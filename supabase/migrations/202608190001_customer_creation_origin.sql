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

comment on column public.customers.creation_channel is
  'Immutable creation workflow for the customer. Existing rows remain legacy unless a reliable origin is known.';

comment on column public.customers.origin_customer_id is
  'Customer account (group/corporate/dealership) under which this customer was originally created. This is creation provenance, not current membership.';

commit;
