begin;

alter table public.external_renewal_opportunities
  add column if not exists ai_profile_overrides jsonb not null default '{}'::jsonb,
  add column if not exists ai_profile_updated_at timestamptz,
  add column if not exists ai_profile_updated_by uuid;

alter table public.external_renewal_voice_attempts
  add column if not exists cohort_context jsonb not null default '{}'::jsonb;

comment on column public.external_renewal_opportunities.ai_profile_overrides is
  'IT-Super-User corrections used only for External Renewal AI calling. Original imported and AuthBridge evidence remains preserved separately.';
comment on column public.external_renewal_voice_attempts.cohort_context is
  'Privacy-minimized immutable snapshot of the approved prospect values used to construct this Sarvam cohort. Never stores raw provider payloads or transcripts.';

create index if not exists external_renewal_ai_profile_updated_idx
  on public.external_renewal_opportunities (ai_profile_updated_at desc)
  where ai_profile_updated_at is not null;

commit;
