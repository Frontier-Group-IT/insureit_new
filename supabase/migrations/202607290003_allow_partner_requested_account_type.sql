begin;

alter table if exists public.posp_misp_onboarding_profiles
  drop constraint if exists posp_misp_onboarding_profiles_requested_account_type_check;

alter table if exists public.posp_misp_onboarding_profiles
  add constraint posp_misp_onboarding_profiles_requested_account_type_check
  check (requested_account_type is null or requested_account_type in ('partner','posp','misp'));

commit;
