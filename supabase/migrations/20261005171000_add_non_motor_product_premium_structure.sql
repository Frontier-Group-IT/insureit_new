create table if not exists public.non_motor_product_configurations (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  product_key text not null unique,
  premium_structure text not null default 'standard',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint non_motor_product_configurations_product_name_nonempty check (btrim(product_name) <> ''),
  constraint non_motor_product_configurations_product_key_nonempty check (btrim(product_key) <> ''),
  constraint non_motor_product_configurations_premium_structure_check check (premium_structure in ('standard', 'od_tp'))
);

comment on table public.non_motor_product_configurations is
  'Product-level premium structure configuration for Non-Motor policy onboarding. Standard products hide OD/TP; od_tp products expose the breakup.';

comment on column public.non_motor_product_configurations.product_key is
  'Lower-case whitespace-normalized product name used as the stable lookup key.';

with existing_products as (
  select
    min(btrim(policy_product)) as product_name,
    lower(regexp_replace(btrim(policy_product), '\s+', ' ', 'g')) as product_key
  from public.policies
  where business_line = 'Non Motor'
    and nullif(btrim(policy_product), '') is not null
  group by lower(regexp_replace(btrim(policy_product), '\s+', ' ', 'g'))
)
insert into public.non_motor_product_configurations (product_name, product_key, premium_structure, is_active)
select product_name, product_key, 'standard', true
from existing_products
on conflict (product_key) do nothing;

alter table public.non_motor_product_configurations enable row level security;

-- This configuration is intentionally server-managed through the web portal's
-- privileged Supabase client. No authenticated direct-table policy is added.
-- Existing Non-Motor products are seeded as Standard; new products default to
-- Standard unless OD + TP is selected when the product is first configured.
