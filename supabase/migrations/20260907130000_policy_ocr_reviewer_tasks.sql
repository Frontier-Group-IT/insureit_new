begin;

create table if not exists public.policy_ocr_training_review_tasks (
  id uuid primary key default gen_random_uuid(),
  training_label_id uuid not null unique
    references public.policy_ocr_training_labels(id) on delete cascade,
  assigned_reviewer_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  assigned_by_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  assignment_version integer not null default 1
    check (assignment_version > 0),
  status text not null default 'assigned'
    check (status in ('assigned', 'in_review', 'completed', 'rejected', 'cancelled')),
  checklist jsonb not null default '{}'::jsonb,
  reviewer_note text,
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists policy_ocr_training_review_tasks_reviewer_idx
  on public.policy_ocr_training_review_tasks(assigned_reviewer_profile_id, status, updated_at desc);

create index if not exists policy_ocr_training_review_tasks_label_idx
  on public.policy_ocr_training_review_tasks(training_label_id);

alter table public.policy_ocr_training_review_tasks enable row level security;
revoke all on table public.policy_ocr_training_review_tasks from public, anon, authenticated;
grant all on table public.policy_ocr_training_review_tasks to service_role;

create table if not exists public.policy_ocr_training_review_notifications (
  id uuid primary key default gen_random_uuid(),
  review_task_id uuid not null
    references public.policy_ocr_training_review_tasks(id) on delete cascade,
  assignment_version integer not null
    check (assignment_version > 0),
  recipient_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  idempotency_key text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0
    check (attempts >= 0),
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(review_task_id, assignment_version)
);

create index if not exists policy_ocr_training_review_notifications_task_idx
  on public.policy_ocr_training_review_notifications(review_task_id, assignment_version);

alter table public.policy_ocr_training_review_notifications enable row level security;
revoke all on table public.policy_ocr_training_review_notifications from public, anon, authenticated;
grant all on table public.policy_ocr_training_review_notifications to service_role;

drop trigger if exists policy_ocr_training_review_tasks_updated_at
  on public.policy_ocr_training_review_tasks;
create trigger policy_ocr_training_review_tasks_updated_at
before update on public.policy_ocr_training_review_tasks
for each row execute function public.set_updated_at();

drop trigger if exists policy_ocr_training_review_notifications_updated_at
  on public.policy_ocr_training_review_notifications;
create trigger policy_ocr_training_review_notifications_updated_at
before update on public.policy_ocr_training_review_notifications
for each row execute function public.set_updated_at();

comment on table public.policy_ocr_training_review_tasks is
  'Assigned human review state for policy OCR training. Policy files and raw OCR remain in private portal storage.';
comment on table public.policy_ocr_training_review_notifications is
  'Server-side Resend notification audit with assignment-scoped idempotency. No email content or policy data is stored.';

commit;
