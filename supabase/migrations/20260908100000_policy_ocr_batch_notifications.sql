begin;

create table if not exists public.policy_ocr_training_batch_notifications (
  id uuid primary key default gen_random_uuid(),
  orchestrator_id uuid not null unique
    references public.policy_ocr_training_orchestrators(id) on delete cascade,
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
  updated_at timestamptz not null default now()
);

alter table public.policy_ocr_training_batch_notifications enable row level security;
revoke all on table public.policy_ocr_training_batch_notifications from public, anon, authenticated;
grant all on table public.policy_ocr_training_batch_notifications to service_role;

drop trigger if exists policy_ocr_training_batch_notifications_updated_at
  on public.policy_ocr_training_batch_notifications;
create trigger policy_ocr_training_batch_notifications_updated_at
before update on public.policy_ocr_training_batch_notifications
for each row execute function public.set_updated_at();

comment on table public.policy_ocr_training_batch_notifications is
  'One idempotent reviewer notification per orchestrator run. Email body is generated from protected task metadata and is not stored.';

commit;
