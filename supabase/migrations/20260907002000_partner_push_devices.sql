create table if not exists public.partner_push_devices (
  id uuid primary key default gen_random_uuid(),
  expo_push_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  actor_kind text not null check (actor_kind in ('employee', 'intermediary')),
  actor_id uuid not null,
  intermediary_id uuid null,
  eas_project_id text not null,
  app_version text not null,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_push_devices_intermediary_shape_check check (
    (actor_kind = 'intermediary' and intermediary_id is not null)
    or
    (actor_kind = 'employee')
  )
);

create index if not exists partner_push_devices_actor_idx
  on public.partner_push_devices (actor_kind, actor_id, active);

create index if not exists partner_push_devices_intermediary_idx
  on public.partner_push_devices (intermediary_id, active)
  where intermediary_id is not null;

alter table public.partner_push_devices enable row level security;

revoke all on table public.partner_push_devices from anon, authenticated;
grant all on table public.partner_push_devices to service_role;

comment on table public.partner_push_devices is
  'Server-mediated Expo push-device registrations for authenticated INSUREIT Partner actors. No direct mobile table access.';
