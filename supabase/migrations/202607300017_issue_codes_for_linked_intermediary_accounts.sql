begin;

with linked_profiles as (
  select
    profile.application_id,
    app.draft_data ->> 'account_context' as account_context,
    public.next_registration_code(app.draft_data ->> 'account_context') as issued_code
  from public.posp_misp_onboarding_profiles profile
  join public.intermediary_onboarding_applications app on app.id = profile.application_id
  where app.draft_data ->> 'account_context' in ('posp', 'misp')
    and (
      profile.external_onboarding_id is null
      or profile.external_onboarding_id = ''
      or profile.external_onboarding_id like 'PENDING-%'
    )
),
updated_profiles as (
  update public.posp_misp_onboarding_profiles profile
  set external_onboarding_id = linked_profiles.issued_code,
      updated_at = now()
  from linked_profiles
  where profile.application_id = linked_profiles.application_id
  returning profile.application_id, profile.external_onboarding_id
)
update public.intermediary_registrations registration
set registration_code = updated_profiles.external_onboarding_id,
    updated_at = now()
from updated_profiles
where registration.application_id = updated_profiles.application_id
  and (
    registration.registration_code is null
    or registration.registration_code = ''
    or registration.registration_code like 'PENDING-%'
  );

update public.intermediary_registrations registration
set registration_code = profile.external_onboarding_id,
    updated_at = now()
from public.posp_misp_onboarding_profiles profile
join public.intermediary_onboarding_applications app on app.id = profile.application_id
where registration.application_id = profile.application_id
  and app.draft_data ->> 'account_context' in ('posp', 'misp')
  and profile.external_onboarding_id is not null
  and profile.external_onboarding_id <> ''
  and profile.external_onboarding_id not like 'PENDING-%'
  and registration.registration_code is distinct from profile.external_onboarding_id;

commit;
