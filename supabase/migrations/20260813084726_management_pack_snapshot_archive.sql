create table if not exists public.management_pack_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  scope_mode text not null check (scope_mode in ('organization','hierarchy','self','none')),
  snapshot_version integer not null default 1 check (snapshot_version > 0),
  snapshot jsonb not null,
  captured_at timestamptz not null default now(),
  constraint management_pack_snapshots_month_first_day check (extract(day from month) = 1),
  constraint management_pack_snapshots_owner_month_unique unique (owner_profile_id, month)
);

create index if not exists management_pack_snapshots_owner_captured_idx
  on public.management_pack_snapshots(owner_profile_id, captured_at desc);

alter table public.management_pack_snapshots enable row level security;

revoke all on table public.management_pack_snapshots from public;
revoke all on table public.management_pack_snapshots from anon;
revoke all on table public.management_pack_snapshots from authenticated;
grant all on table public.management_pack_snapshots to service_role;

comment on table public.management_pack_snapshots is 'Immutable per-viewer month-end management pack snapshots. Access is server-side only after portal authorization.';
