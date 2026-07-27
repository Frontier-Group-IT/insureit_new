begin;

alter table public.intermediary_training_exam_assignments
  add column if not exists agreement_opened_at timestamptz;

comment on column public.intermediary_training_exam_assignments.agreement_opened_at is
  'Time when the agreement was recorded as opened by the intermediary.';

commit;
