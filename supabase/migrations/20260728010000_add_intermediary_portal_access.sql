begin;

alter table public.intermediaries
  add column if not exists portal_access_status text not null default 'not_created';

alter table public.intermediaries
  drop constraint if exists intermediaries_portal_access_status_check;

alter table public.intermediaries
  add constraint intermediaries_portal_access_status_check
  check (portal_access_status in ('not_created','invited','active','disabled'));

create table if not exists public.intermediary_portal_accounts (
  id uuid primary key default gen_random_uuid(),
  intermediary_id uuid not null unique references public.intermediaries(id) on delete cascade,
  application_id uuid references public.intermediary_onboarding_applications(id) on delete set null,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null,
  status text not null default 'invited'
    check (status in ('invited','active','disabled')),
  invited_at timestamptz,
  activated_at timestamptz,
  disabled_at timestamptz,
  invited_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intermediary_portal_accounts_auth_user_idx
  on public.intermediary_portal_accounts(auth_user_id);
create index if not exists intermediary_portal_accounts_status_idx
  on public.intermediary_portal_accounts(status);

-- The portal uses a text role column. Replace only the known role check when present.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'profiles'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%role%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'super_admin','admin','manager','claims_head','sales_operations_head',
    'backoffice_executive','claim_processor','field_executive','relationship_manager',
    'director','sales_head','zonal_head','asm','sales_manager','agent','customer',
    'it_super_user','intermediary'
  ));

alter table public.intermediary_portal_accounts enable row level security;

drop policy if exists intermediary_portal_account_self_read on public.intermediary_portal_accounts;
create policy intermediary_portal_account_self_read
on public.intermediary_portal_accounts
for select
to authenticated
using (auth_user_id = auth.uid());

comment on table public.intermediary_portal_accounts is
'Authentication link between a POSP/MISP intermediary and the intermediary-facing portal.';

commit;
