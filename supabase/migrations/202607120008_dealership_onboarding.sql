create table if not exists public.dealership_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  dealership_type text not null check (dealership_type in ('posp','misp')),
  dealership_name text not null,
  owner_name text not null,
  oem_name text,
  yearly_sales_band text check (yearly_sales_band in ('less_than_500','500_to_1000','more_than_1000')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dealership_representatives (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  representative_type text not null check (representative_type in ('posp','misp')),
  representative_name text not null,
  mobile text not null,
  email text,
  aadhaar_last_four text,
  aadhaar_hash text,
  pan_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dealership_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  contact_role text not null check (contact_role in ('sales_head','bodyshop_head','insurance_head','insurance_spoc')),
  contact_name text,
  mobile text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(customer_id, contact_role)
);

create index if not exists dealership_contacts_customer_idx on public.dealership_contacts(customer_id);

alter table public.dealership_profiles enable row level security;
alter table public.dealership_representatives enable row level security;
alter table public.dealership_contacts enable row level security;
