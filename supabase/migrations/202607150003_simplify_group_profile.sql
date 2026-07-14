-- Group onboarding now represents only the umbrella entity and owner contact.
-- Corporate registration details belong to Corporate child customers instead.

alter table if exists public.group_profiles
  alter column company_name drop not null;

alter table if exists public.group_profiles
  alter column company_pan_number drop not null;
