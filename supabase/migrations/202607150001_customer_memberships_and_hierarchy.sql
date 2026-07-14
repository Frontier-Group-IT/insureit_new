-- Additive foundation for multi-login customer accounts and group hierarchies.
-- Existing customers.profile_id remains supported during the transition.

create table if not exists public.customer_memberships (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  invited_phone text,
  invited_email text,
  membership_role text not null,
  is_primary boolean not null default false,
  status text not null default 'pending' check (status in ('pending','active','suspended','revoked')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, profile_id)
);

create unique index if not exists customer_memberships_primary_per_customer
  on public.customer_memberships(customer_id)
  where is_primary and status <> 'revoked';

create unique index if not exists customer_memberships_pending_phone_per_customer
  on public.customer_memberships(customer_id, invited_phone)
  where profile_id is null and invited_phone is not null and status = 'pending';

create table if not exists public.customer_relationships (
  id uuid primary key default gen_random_uuid(),
  parent_customer_id uuid not null references public.customers(id) on delete cascade,
  child_customer_id uuid not null references public.customers(id) on delete cascade,
  relationship_type text not null default 'group_member',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (parent_customer_id <> child_customer_id),
  unique (parent_customer_id, child_customer_id, relationship_type)
);

create table if not exists public.customer_onboarding_contacts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.customer_onboarding_applications(id) on delete cascade,
  contact_role text not null,
  full_name text not null,
  phone text not null,
  email text,
  login_required boolean not null default true,
  linked_profile_id uuid references public.profiles(id),
  membership_status text not null default 'pending' check (membership_status in ('pending','active','suspended','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, contact_role)
);

create index if not exists customer_memberships_profile_idx on public.customer_memberships(profile_id, status);
create index if not exists customer_relationships_parent_idx on public.customer_relationships(parent_customer_id, is_active);
create index if not exists customer_relationships_child_idx on public.customer_relationships(child_customer_id, is_active);
create index if not exists customer_onboarding_contacts_application_idx on public.customer_onboarding_contacts(application_id);
create index if not exists customer_onboarding_contacts_phone_idx on public.customer_onboarding_contacts(phone);

-- Preserve all existing one-profile customers as active primary memberships.
insert into public.customer_memberships (customer_id, profile_id, membership_role, is_primary, status, created_by)
select
  customer.id,
  customer.profile_id,
  case
    when customer.partner_type = 'group' then 'group_owner'
    when customer.partner_type = 'dealership' then 'dealership_owner'
    when customer.partner_type = 'corporate' then 'ceo_head'
    else 'owner'
  end,
  true,
  'active',
  customer.created_by
from public.customers customer
where customer.profile_id is not null
on conflict (customer_id, profile_id) do nothing;

alter table public.customer_memberships enable row level security;
alter table public.customer_relationships enable row level security;
alter table public.customer_onboarding_contacts enable row level security;

-- Customers can read their own memberships. Existing manager/service-role access remains unaffected.
drop policy if exists customer_memberships_read_own on public.customer_memberships;
create policy customer_memberships_read_own
on public.customer_memberships for select
to authenticated
using (profile_id = auth.uid());

-- Applicants can read the contacts attached to their own onboarding application.
drop policy if exists onboarding_contacts_read_applicant on public.customer_onboarding_contacts;
create policy onboarding_contacts_read_applicant
on public.customer_onboarding_contacts for select
to authenticated
using (
  exists (
    select 1
    from public.customer_onboarding_applications application
    where application.id = customer_onboarding_contacts.application_id
      and application.profile_id = auth.uid()
  )
);

-- Claim a pending membership on first successful OTP login by exact normalized phone.
create or replace function public.claim_pending_customer_memberships()
returns setof public.customer_memberships
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_phone text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select coalesce(nullif(phone, ''), nullif(raw_user_meta_data ->> 'phone', ''))
    into normalized_phone
  from auth.users
  where id = auth.uid();

  if normalized_phone is null then
    return;
  end if;

  update public.customer_memberships
  set profile_id = auth.uid(), status = 'active', updated_at = now()
  where profile_id is null
    and status = 'pending'
    and invited_phone = normalized_phone;

  return query
  select * from public.customer_memberships
  where profile_id = auth.uid() and status = 'active';
end;
$$;

revoke all on function public.claim_pending_customer_memberships() from public;
grant execute on function public.claim_pending_customer_memberships() to authenticated;
