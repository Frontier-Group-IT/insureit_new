begin;

alter table public.intermediary_onboarding_applications
  add column if not exists registration_status text not null default 'primary_pending';

alter table public.intermediary_onboarding_applications
  drop constraint if exists intermediary_onboarding_applications_registration_status_check;

alter table public.intermediary_onboarding_applications
  add constraint intermediary_onboarding_applications_registration_status_check
  check (registration_status in (
    'primary_pending',
    'pan_checking',
    'documents_pending',
    'training_pending',
    'training_assigned',
    'training_in_progress',
    'training_completed',
    'exam_pending',
    'exam_allotted',
    'exam_in_progress',
    'exam_failed',
    'exam_passed',
    'agreement_pending',
    'agreement_sent',
    'agreement_signed',
    'iib_submission_pending',
    'iib_submitted',
    'iib_registered',
    'rejected'
  ));

create table if not exists public.intermediary_training_exam_assignments (
  application_id uuid primary key references public.intermediary_onboarding_applications(id) on delete cascade,
  training_title text,
  training_url text,
  training_instructions text,
  training_assigned_at timestamptz,
  training_deadline date,
  training_status text not null default 'not_assigned'
    check (training_status in ('not_assigned','assigned','opened','in_progress','completed','expired')),
  training_started_at timestamptz,
  training_completed_at timestamptz,
  exam_title text,
  exam_url text,
  passing_percentage numeric(5,2),
  maximum_attempts integer,
  exam_duration_minutes integer,
  exam_available_from timestamptz,
  exam_available_until timestamptz,
  exam_allotted_at timestamptz,
  exam_status text not null default 'not_allotted'
    check (exam_status in ('not_allotted','allotted','locked','available','in_progress','passed','failed','attempts_exhausted')),
  exam_score numeric(6,2),
  exam_attempts_used integer not null default 0,
  exam_started_at timestamptz,
  exam_completed_at timestamptz,
  exam_passed_at timestamptz,
  agreement_status text not null default 'not_generated'
    check (agreement_status in ('not_generated','generated','sent','opened','signed','declined','expired','failed')),
  agreement_signing_url text,
  agreement_sent_at timestamptz,
  agreement_signed_at timestamptz,
  signed_agreement_path text,
  iib_registration_status text not null default 'not_ready'
    check (iib_registration_status in ('not_ready','ready_for_submission','submission_in_progress','submitted','registered','failed','manual_review')),
  iib_submission_started_at timestamptz,
  iib_submitted_at timestamptz,
  iib_registered_at timestamptz,
  iib_last_error text,
  assigned_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intermediary_training_exam_training_status_idx
  on public.intermediary_training_exam_assignments(training_status);
create index if not exists intermediary_training_exam_exam_status_idx
  on public.intermediary_training_exam_assignments(exam_status);
create index if not exists intermediary_training_exam_iib_status_idx
  on public.intermediary_training_exam_assignments(iib_registration_status);

insert into public.intermediary_training_exam_assignments (application_id)
select app.id
from public.intermediary_onboarding_applications app
join public.posp_misp_onboarding_profiles profile on profile.application_id = app.id
where app.requested_type in ('posp','misp')
on conflict (application_id) do nothing;

update public.intermediary_onboarding_applications app
set registration_status = case
  when profile.workflow_stage = 'pre_iib' and profile.iib_remarks is null then 'pan_checking'
  when profile.workflow_stage = 'pre_iib' then 'primary_pending'
  when profile.workflow_stage = 'iib_processing' then 'documents_pending'
  when profile.workflow_stage = 'training' then 'training_pending'
  when profile.workflow_stage = 'completed' then 'iib_submission_pending'
  else app.registration_status
end
from public.posp_misp_onboarding_profiles profile
where profile.application_id = app.id
  and app.registration_status = 'primary_pending';

update public.intermediaries i
set account_status = 'under_onboarding',
    activated_at = null,
    updated_at = now()
from public.intermediary_onboarding_applications app
where app.id = i.application_id
  and app.requested_type in ('posp','misp')
  and coalesce(app.registration_status,'') <> 'iib_registered'
  and i.account_status = 'active';

comment on table public.intermediary_training_exam_assignments is
'External-link training, examination, agreement and IIB registration workflow for POSP and MISP onboarding.';

commit;
