alter table public.intermediary_training_exam_assignments
  add column if not exists icall_environment text;

alter table public.intermediary_training_exam_assignments
  drop constraint if exists intermediary_training_exam_assignments_icall_environment_check;

alter table public.intermediary_training_exam_assignments
  add constraint intermediary_training_exam_assignments_icall_environment_check
  check (icall_environment is null or icall_environment in ('uat', 'production'));

update public.intermediary_training_exam_assignments
set icall_environment = 'uat'
where icall_environment is null
  and icall_login_id is not null;

comment on column public.intermediary_training_exam_assignments.icall_environment is
  'Provider environment for the persisted iCall training snapshot. Existing linked snapshots are backfilled as UAT; new production registrations must write production.';
