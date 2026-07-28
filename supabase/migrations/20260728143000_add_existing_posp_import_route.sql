begin;

alter table public.posp_misp_onboarding_profiles
  add column if not exists record_source text not null default 'new_onboarding',
  add column if not exists existing_registration_confirmed boolean not null default false,
  add column if not exists existing_registration_confirmed_by uuid null,
  add column if not exists existing_registration_confirmed_at timestamptz null,
  add column if not exists existing_registration_code text null,
  add column if not exists existing_registration_date date null,
  add column if not exists existing_registration_remarks text null;

create index if not exists posp_misp_profiles_existing_registration_idx
  on public.posp_misp_onboarding_profiles(existing_registration_confirmed)
  where existing_registration_confirmed = true;

commit;
