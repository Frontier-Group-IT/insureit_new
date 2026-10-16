-- PREPARED ONLY. DO NOT APPLY TO PRODUCTION WITHOUT SEPARATE REVIEW.
-- Non-PII administrative enrollment journal; no Auth identity, Firebase UID or phone is stored.
-- Applications and public clients receive no privileges.
begin;
create table if not exists public.customer_firebase_migration_audit (
  id bigint generated always as identity primary key,
  customer_profile_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('enrollment_review','enrollment_approved','alias_preflight','alias_applied','rollback_verified')),
  operator_id uuid not null,
  evidence_digest text not null check (evidence_digest ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz not null default now(),
  constraint customer_firebase_migration_audit_immutable_action_chk check (length(action)>0)
);
alter table public.customer_firebase_migration_audit enable row level security;
revoke all on public.customer_firebase_migration_audit from public, anon, authenticated;
revoke all on sequence public.customer_firebase_migration_audit_id_seq from public, anon, authenticated;
grant select, insert on public.customer_firebase_migration_audit to service_role;
grant usage, select on sequence public.customer_firebase_migration_audit_id_seq to service_role;
create index if not exists customer_firebase_migration_audit_customer_time_idx
  on public.customer_firebase_migration_audit(customer_profile_id, recorded_at desc);
comment on table public.customer_firebase_migration_audit is
  'Restricted enrollment/alias migration journal. Store a digest of protected external evidence only. Never store OTP, tokens, raw UID, phone, passwords or recoverable snapshots here.';
commit;
