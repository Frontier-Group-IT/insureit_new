begin;

alter table if exists public.intermediary_onboarding_applications
  drop constraint if exists intermediary_onboarding_applications_requested_type_check;

alter table if exists public.intermediary_onboarding_applications
  add constraint intermediary_onboarding_applications_requested_type_check
  check (requested_type in ('partner', 'posp', 'misp'));

commit;
