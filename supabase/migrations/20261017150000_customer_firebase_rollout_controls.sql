-- PREPARED / SOURCE ONLY — NEVER APPLIED TO PRODUCTION WITHOUT OWNER APPROVAL.
-- Stacked on 20261017120000_customer_firebase_operator_review_and_collisions.sql.
-- This only stores a disabled kill-switch; it creates no Auth users/UID links.
begin;
create table if not exists public.customer_firebase_rollout_control (
  singleton boolean primary key default true check (singleton is true),
  enabled boolean not null default false,
  paused boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete restrict,
  reason_code text not null default 'not_approved'
);
alter table public.customer_firebase_rollout_control enable row level security;
revoke all on public.customer_firebase_rollout_control from public, anon, authenticated;
grant select on public.customer_firebase_rollout_control to service_role;
-- No UPDATE grant to service_role. Changes must go through a separately
-- authorized operator-controlled function in a later explicitly approved PR.
insert into public.customer_firebase_rollout_control(singleton,enabled,paused)
values(true,false,true) on conflict(singleton) do nothing;
comment on table public.customer_firebase_rollout_control is
 'Firebase rollout default DISABLED; service role read-only; no automatic activation; no public access';
commit;
