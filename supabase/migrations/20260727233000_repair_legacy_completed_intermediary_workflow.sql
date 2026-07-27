begin;

-- Older releases marked onboarding completed immediately after documents.
-- Repair only POSP/MISP applications that have not started training, exam,
-- agreement signing, or IIB registration.
update public.intermediary_onboarding_applications app
set registration_status = 'training_pending',
    status = case when app.status = 'approved' then 'under_review' else app.status end,
    completed_at = null,
    updated_at = now()
from public.posp_misp_onboarding_profiles profile
where profile.application_id = app.id
  and app.requested_type in ('posp','misp')
  and app.final_type is distinct from 'partner'
  and profile.workflow_stage = 'completed'
  and app.registration_status = 'iib_submission_pending'
  and not exists (
    select 1
    from public.intermediary_training_exam_assignments assignment
    where assignment.application_id = app.id
      and (
        coalesce(assignment.training_status,'not_assigned') <> 'not_assigned'
        or coalesce(assignment.exam_status,'not_allotted') <> 'not_allotted'
        or coalesce(assignment.agreement_status,'not_generated') <> 'not_generated'
        or coalesce(assignment.iib_registration_status,'not_ready') <> 'not_ready'
      )
  );

update public.posp_misp_onboarding_profiles profile
set workflow_stage = 'training',
    training_status = 'not_assigned',
    exam_status = 'not_allotted',
    updated_at = now()
from public.intermediary_onboarding_applications app
where app.id = profile.application_id
  and app.requested_type in ('posp','misp')
  and app.final_type is distinct from 'partner'
  and profile.workflow_stage = 'completed'
  and app.registration_status = 'training_pending'
  and not exists (
    select 1
    from public.intermediary_training_exam_assignments assignment
    where assignment.application_id = app.id
      and (
        coalesce(assignment.training_status,'not_assigned') <> 'not_assigned'
        or coalesce(assignment.exam_status,'not_allotted') <> 'not_allotted'
        or coalesce(assignment.agreement_status,'not_generated') <> 'not_generated'
        or coalesce(assignment.iib_registration_status,'not_ready') <> 'not_ready'
      )
  );

-- Ensure every repaired application has the Stage 3 assignment container.
insert into public.intermediary_training_exam_assignments (application_id)
select app.id
from public.intermediary_onboarding_applications app
join public.posp_misp_onboarding_profiles profile
  on profile.application_id = app.id
where app.registration_status = 'training_pending'
  and profile.workflow_stage = 'training'
on conflict (application_id) do nothing;

-- Repaired records remain under onboarding until IIB registration succeeds.
update public.intermediaries intermediary
set account_status = 'under_onboarding',
    activated_at = null,
    updated_at = now()
from public.intermediary_onboarding_applications app
where app.id = intermediary.application_id
  and app.registration_status <> 'iib_registered'
  and intermediary.account_status = 'active';

commit;
