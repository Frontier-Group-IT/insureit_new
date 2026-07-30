begin;

update public.intermediary_onboarding_applications app
set registration_status = 'training_pending',
    updated_at = now()
where app.requested_type = 'misp'
  and app.partner_status = 'active_partner'
  and app.registration_status = 'agreement_pending'
  and app.draft_data ->> 'account_context' = 'misp';

update public.posp_misp_onboarding_profiles profile
set workflow_stage = 'training',
    training_status = case
      when profile.training_status is null or profile.training_status = 'not_required' then 'pending'
      else profile.training_status
    end,
    exam_status = case
      when profile.exam_status is null or profile.exam_status = 'not_required' then 'not_allotted'
      else profile.exam_status
    end,
    updated_at = now()
from public.intermediary_onboarding_applications app
where app.id = profile.application_id
  and app.requested_type = 'misp'
  and app.partner_status = 'active_partner'
  and app.draft_data ->> 'account_context' = 'misp'
  and app.registration_status in ('training_pending', 'training_assigned', 'training_in_progress', 'training_completed', 'exam_pending', 'exam_allotted', 'exam_in_progress', 'exam_failed', 'exam_passed');

update public.intermediary_registrations registration
set training_status = case
      when registration.training_status is null or registration.training_status = 'not_required' then 'not_assigned'
      else registration.training_status
    end,
    exam_status = case
      when registration.exam_status is null or registration.exam_status = 'not_required' then 'not_allotted'
      else registration.exam_status
    end,
    registration_status = case
      when registration.registration_status = 'agreement_pending' then 'training_pending'
      else registration.registration_status
    end,
    updated_at = now()
from public.intermediary_onboarding_applications app
where app.registration_record_id = registration.id
  and app.requested_type = 'misp'
  and app.partner_status = 'active_partner'
  and app.draft_data ->> 'account_context' = 'misp';

commit;
