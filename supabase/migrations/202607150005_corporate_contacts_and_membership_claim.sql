-- Permanent customer contacts and first-login membership activation.

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  contact_role text not null,
  full_name text not null,
  phone text not null,
  email text,
  profile_id uuid references public.profiles(id) on delete set null,
  login_required boolean not null default true,
  access_status text not null default 'pending' check (access_status in ('pending','active','suspended','revoked')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, contact_role)
);

create index if not exists customer_contacts_customer_idx on public.customer_contacts(customer_id);
create index if not exists customer_contacts_profile_idx on public.customer_contacts(profile_id);
create index if not exists customer_contacts_phone_idx on public.customer_contacts(phone);

alter table public.customer_contacts enable row level security;

drop policy if exists customer_contacts_read_member on public.customer_contacts;
create policy customer_contacts_read_member
on public.customer_contacts for select
to authenticated
using (
  exists (
    select 1 from public.customer_memberships membership
    where membership.customer_id = customer_contacts.customer_id
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
  )
);

drop policy if exists customer_contacts_manage_staff on public.customer_contacts;
create policy customer_contacts_manage_staff
on public.customer_contacts for all
to authenticated
using (
  public.current_app_role()::text in ('super_admin','admin','manager','it_super_user','sales_operations_head','backoffice_executive')
)
with check (
  public.current_app_role()::text in ('super_admin','admin','manager','it_super_user','sales_operations_head','backoffice_executive')
);

create or replace function public.claim_pending_customer_memberships()
returns setof public.customer_memberships
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_phone text;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

  select case
    when coalesce(nullif(phone, ''), nullif(raw_user_meta_data ->> 'phone', '')) is null then null
    when regexp_replace(coalesce(nullif(phone, ''), nullif(raw_user_meta_data ->> 'phone', '')), '\D', '', 'g') ~ '^91[0-9]{10}$'
      then '+' || regexp_replace(coalesce(nullif(phone, ''), nullif(raw_user_meta_data ->> 'phone', '')), '\D', '', 'g')
    when regexp_replace(coalesce(nullif(phone, ''), nullif(raw_user_meta_data ->> 'phone', '')), '\D', '', 'g') ~ '^[0-9]{10}$'
      then '+91' || regexp_replace(coalesce(nullif(phone, ''), nullif(raw_user_meta_data ->> 'phone', '')), '\D', '', 'g')
    else coalesce(nullif(phone, ''), nullif(raw_user_meta_data ->> 'phone', ''))
  end into normalized_phone
  from auth.users where id = auth.uid();

  if normalized_phone is null then return; end if;

  update public.customer_memberships
  set profile_id = auth.uid(), status = 'active', updated_at = now()
  where profile_id is null and status = 'pending' and invited_phone = normalized_phone;

  update public.customer_contacts
  set profile_id = auth.uid(), access_status = 'active', updated_at = now()
  where profile_id is null and access_status = 'pending' and phone = normalized_phone;

  update public.customer_onboarding_contacts
  set linked_profile_id = auth.uid(), membership_status = 'active', updated_at = now()
  where linked_profile_id is null and membership_status = 'pending' and phone = normalized_phone;

  return query select * from public.customer_memberships
  where profile_id = auth.uid() and status = 'active';
end;
$$;

revoke all on function public.claim_pending_customer_memberships() from public;
grant execute on function public.claim_pending_customer_memberships() to authenticated;
