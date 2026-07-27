-- Run 20260728005900_add_intermediary_app_role.sql first.
-- The enum addition must commit in a separate migration before this file runs.

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
