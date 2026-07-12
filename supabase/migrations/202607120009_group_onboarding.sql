create table if not exists public.group_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  group_name text not null,
  owner_name text not null,
  company_name text not null,
  company_pan_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  contact_role text not null check (contact_role in ('ceo_head','admin_head','dedicated_spoc')),
  contact_name text,
  mobile text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(customer_id, contact_role)
);

create index if not exists group_contacts_customer_idx on public.group_contacts(customer_id);
alter table public.group_profiles enable row level security;
alter table public.group_contacts enable row level security;
