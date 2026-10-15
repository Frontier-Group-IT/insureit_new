begin;
-- Additive contact metadata for the primary Group administrator.
-- Existing Group identities and memberships are never rewritten.
create table if not exists public.group_administrator_contacts(
 group_id uuid primary key references public.intermediary_groups(id) on delete restrict,
 profile_id uuid not null references public.profiles(id) on delete restrict,
 admin_name text not null,
 admin_email text not null,
 admin_mobile text not null,
 address text not null,
 city text not null,
 state text not null,
 postal_code text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles(id) on delete set null
);
alter table public.group_administrator_contacts enable row level security;
revoke all on public.group_administrator_contacts from public,anon,authenticated;
grant select,insert,update on public.group_administrator_contacts to service_role;
-- Preserve existing Group Administrator records; add scoped associate role options.
alter table public.group_portal_associate_accounts drop constraint if exists group_portal_associate_accounts_role_check;
alter table public.group_portal_associate_accounts
 add constraint group_portal_associate_accounts_role_check
 check (role in ('group_admin','insurance_head','claim_head','bodyshop_manager'));
commit;