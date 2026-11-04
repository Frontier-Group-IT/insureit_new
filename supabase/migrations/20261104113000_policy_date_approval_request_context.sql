-- Preserve requester identity and the explanation supplied when initiating
-- policy-date email approval. Existing approval rows remain valid.
alter table public.policy_date_otp_approvals
  add column if not exists requester_name text,
  add column if not exists approval_reason text,
  add column if not exists requester_justification text;

-- New records are validated by the authorized server action (12..500 chars).
-- Do not add NOT NULL for historical rows issued before this feature.
comment on column public.policy_date_otp_approvals.requester_name
  is 'Authenticated employee display name captured at approval request time';
comment on column public.policy_date_otp_approvals.approval_reason
  is 'Server-generated India-calendar policy date approval rule';
comment on column public.policy_date_otp_approvals.requester_justification
  is 'Required employee explanation captured with the OTP request for audit';

-- Preserve existing RLS and service-role-only privileges. No new grants.
