-- Short-lived, server-only tickets for Partner App -> Operations Policy Intake.
-- This table contains AES-GCM sealed session tokens, never plaintext tokens.
-- No grants/policies to anon/authenticated; only the service-role backend can access it.
create table if not exists public.partner_policy_intake_web_handoff_tickets (
  code_hash text primary key,
  intake_id uuid not null references public.policy_intake_requests(id) on delete cascade,
  auth_user_id uuid not null,
  expected_reviewer_id uuid,
  take_over boolean not null default false,
  sealed_session text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists partner_policy_intake_web_handoff_expiry_idx
  on public.partner_policy_intake_web_handoff_tickets (expires_at);

alter table public.partner_policy_intake_web_handoff_tickets enable row level security;
revoke all on public.partner_policy_intake_web_handoff_tickets from public, anon, authenticated;
-- Strictly no user-facing policies. Service role bypasses RLS and uses an atomic DELETE RETURNING.
comment on table public.partner_policy_intake_web_handoff_tickets is
  'Server-side single-use, 90-second app-to-website handoff ticket. Expired rows should be periodically pruned.';
