begin;

-- Partner identity uniqueness now belongs to public.partners. A linked POSP/MISP
-- account reuses the parent Partner identity details, so these legacy profile
-- uniqueness indexes incorrectly block the child registration profile.
drop index if exists public.posp_misp_onboarding_profiles_partner_id_uidx;
drop index if exists public.posp_misp_onboarding_profiles_partner_pan_uidx;
drop index if exists public.posp_misp_onboarding_profiles_partner_aadhaar_uidx;

create index if not exists posp_misp_onboarding_profiles_partner_id_idx
  on public.posp_misp_onboarding_profiles (partner_id)
  where partner_id is not null and btrim(partner_id) <> '';

create index if not exists posp_misp_onboarding_profiles_partner_pan_idx
  on public.posp_misp_onboarding_profiles (upper(pan_number))
  where pan_number is not null and btrim(pan_number) <> '';

create index if not exists posp_misp_onboarding_profiles_partner_aadhaar_idx
  on public.posp_misp_onboarding_profiles (aadhaar_hash)
  where aadhaar_hash is not null;

commit;
