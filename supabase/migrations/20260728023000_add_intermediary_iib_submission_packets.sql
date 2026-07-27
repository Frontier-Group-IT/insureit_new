begin;

create table if not exists public.intermediary_iib_submission_packets (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.intermediary_onboarding_applications(id) on delete cascade,
  intermediary_id uuid references public.intermediaries(id) on delete set null,
  intermediary_type text not null check (intermediary_type in ('posp','misp')),
  status text not null default 'draft' check (status in ('draft','ready','handoff_started','submitted','registered','rejected')),
  payload jsonb not null default '{}'::jsonb,
  missing_fields text[] not null default '{}',
  prepared_at timestamptz,
  prepared_by uuid,
  handoff_started_at timestamptz,
  handoff_started_by uuid,
  submitted_at timestamptz,
  submission_reference text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intermediary_iib_submission_packets_status_idx
  on public.intermediary_iib_submission_packets(status);

alter table public.intermediary_iib_submission_packets enable row level security;

comment on table public.intermediary_iib_submission_packets is
'Validated IIB portal submission payload prepared after agreement signing. CAPTCHA and final portal submission remain manual.';

commit;
