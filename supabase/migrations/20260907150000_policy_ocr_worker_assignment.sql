begin;

-- Automated workers have no human portal profile. Keep the human assignee
-- mandatory while allowing the assignment actor to be the protected worker.
alter table public.policy_ocr_training_review_tasks
  alter column assigned_by_profile_id drop not null;

comment on column public.policy_ocr_training_review_tasks.assigned_by_profile_id is
  'Human operator profile for manual assignment, or null when the protected OCR worker creates the task.';

commit;
