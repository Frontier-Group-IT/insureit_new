begin;

-- A Partner is the parent identity. Its POSP/MISP onboarding profile is a separate
-- application and therefore the same Partner code must be allowed on both profiles.
drop index if exists public.posp_misp_onboarding_profiles_partner_id_uidx;

create index if not exists posp_misp_onboarding_profiles_partner_id_idx
  on public.posp_misp_onboarding_profiles (partner_id)
  where partner_id is not null and btrim(partner_id) <> '';

-- Keep only one child registration application of a given type for a Partner.
-- Legacy/current Partner applications do not have account_context and are excluded.
drop index if exists public.intermediary_apps_partner_registration_type_uidx;
create unique index intermediary_apps_partner_registration_type_uidx
  on public.intermediary_onboarding_applications (partner_record_id, requested_type)
  where partner_record_id is not null
    and requested_type in ('posp','misp')
    and draft_data ->> 'account_context' in ('posp','misp');

commit;
