begin;

create table if not exists public.role_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  capability text not null,
  access_level text not null check (access_level in ('none','view','edit','approve')),
  scope_type text not null default 'role_default' check (scope_type in ('role_default','self','hierarchy','organization')),
  reason text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(role, capability)
);

create table if not exists public.employee_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null,
  access_level text not null check (access_level in ('inherit','none','view','edit','approve')),
  scope_type text not null default 'inherit' check (scope_type in ('inherit','self','hierarchy','organization')),
  reason text not null,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, capability)
);

create table if not exists public.permission_change_logs (
  id uuid primary key default gen_random_uuid(),
  changed_by_profile_id uuid references public.profiles(id) on delete set null,
  target_profile_id uuid references public.profiles(id) on delete set null,
  target_role text,
  capability text not null,
  previous_access text,
  new_access text not null,
  previous_scope text,
  new_scope text,
  change_type text not null check (change_type in ('employee_override','employee_reset','role_override','role_reset')),
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists employee_permission_overrides_profile_idx on public.employee_permission_overrides(profile_id);
create index if not exists permission_change_logs_target_profile_idx on public.permission_change_logs(target_profile_id, created_at desc);
create index if not exists permission_change_logs_created_at_idx on public.permission_change_logs(created_at desc);

alter table public.role_permission_overrides enable row level security;
alter table public.employee_permission_overrides enable row level security;
alter table public.permission_change_logs enable row level security;

comment on table public.role_permission_overrides is 'Optional role-level overrides. Existing code permissions remain the fallback when no row exists.';
comment on table public.employee_permission_overrides is 'Employee-specific access overrides layered over existing role permissions.';
comment on table public.permission_change_logs is 'Append-only audit history for permission changes.';

commit;
