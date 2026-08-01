begin;

update public.posp_misp_onboarding_profiles p
set partner_id = coalesce(
      p.partner_id,
      nullif(a.draft_data->>'legacy_partner_code', '')
    ),
    external_onboarding_id = coalesce(
      p.external_onboarding_id,
      nullif(a.draft_data->>'legacy_registration_code', '')
    ),
    existing_registration_code = coalesce(
      p.existing_registration_code,
      nullif(a.draft_data->>'legacy_registration_code', '')
    ),
    existing_registration_confirmed = case
      when a.draft_data->>'onboarding_mode' = 'legacy_existing_partner' then true
      else p.existing_registration_confirmed
    end,
    updated_at = now()
from public.intermediary_onboarding_applications a
where a.id = p.application_id
  and a.draft_data->>'onboarding_mode' = 'legacy_existing_partner'
  and (
    p.partner_id is null
    or p.external_onboarding_id is null
    or p.existing_registration_code is null
    or p.existing_registration_confirmed is distinct from true
  );

commit;
