begin;

alter table public.posp_misp_onboarding_profiles
  add column if not exists pos_first_name text,
  add column if not exists pos_middle_name text,
  add column if not exists pos_last_name text;

comment on column public.posp_misp_onboarding_profiles.pos_first_name is 'POSP first name used for IIB portal submission.';
comment on column public.posp_misp_onboarding_profiles.pos_middle_name is 'Optional POSP middle name used for IIB portal submission.';
comment on column public.posp_misp_onboarding_profiles.pos_last_name is 'POSP last name used for IIB portal submission.';

commit;
