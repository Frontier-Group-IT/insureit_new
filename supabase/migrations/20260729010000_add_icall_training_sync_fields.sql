alter table public.intermediary_training_exam_assignments
  add column if not exists icall_login_id text,
  add column if not exists icall_candidate_name text,
  add column if not exists icall_mobile_number text,
  add column if not exists icall_internal_pos_code text,
  add column if not exists icall_issue_date date,
  add column if not exists icall_expiry_date date,
  add column if not exists icall_hours_allotted text,
  add column if not exists icall_hours_completed text,
  add column if not exists icall_hours_remaining text,
  add column if not exists icall_last_synced_at timestamptz;

comment on column public.intermediary_training_exam_assignments.icall_hours_allotted is 'Raw duration returned by the iCall API, for example 15:00.';
comment on column public.intermediary_training_exam_assignments.icall_hours_completed is 'Raw completed duration returned by the iCall API, for example 00:00:00.';
comment on column public.intermediary_training_exam_assignments.icall_hours_remaining is 'Raw remaining duration returned by the iCall API, for example 15:00:00.';
