-- Add the intermediary role before opening the main transaction.
-- PostgreSQL enum values added with ALTER TYPE become usable only after that
-- statement commits, so this block must remain outside BEGIN/COMMIT below.
do $$
declare
  role_type_schema text;
  role_type_name text;
begin
  select enum_namespace.nspname, role_type.typname
    into role_type_schema, role_type_name
  from pg_attribute attribute
  join pg_class profile_table
    on profile_table.oid = attribute.attrelid
  join pg_namespace table_namespace
    on table_namespace.oid = profile_table.relnamespace
  join pg_type role_type
    on role_type.oid = attribute.atttypid
  join pg_namespace enum_namespace
    on enum_namespace.oid = role_type.typnamespace
  where table_namespace.nspname = 'public'
    and profile_table.relname = 'profiles'
    and attribute.attname = 'role'
    and attribute.attnum > 0
    and not attribute.attisdropped
    and role_type.typtype = 'e'
  limit 1;

  if role_type_name is null then
    raise exception 'Could not resolve the enum type used by public.profiles.role';
  end if;

  if not exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace enum_namespace on enum_namespace.oid = enum_type.typnamespace
    where enum_namespace.nspname = role_type_schema
      and enum_type.typname = role_type_name
      and enum_value.enumlabel = 'intermediary'
  ) then
    execute format(
      'alter type %I.%I add value %L',
      role_type_schema,
      role_type_name,
      'intermediary'
    );
  end if;
end
$$;

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
