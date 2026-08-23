alter table public.policy_payin_details
  add column if not exists commercial_status text not null default 'needs_review',
  add column if not exists commercial_note text,
  add column if not exists commercial_reviewed_at timestamptz,
  add column if not exists commercial_reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.policy_intermediary_payouts
  add column if not exists commercial_status text not null default 'needs_review',
  add column if not exists commercial_note text,
  add column if not exists commercial_reviewed_at timestamptz,
  add column if not exists commercial_reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.policy_payin_details
  drop constraint if exists policy_payin_details_commercial_status_check;
alter table public.policy_payin_details
  add constraint policy_payin_details_commercial_status_check
  check (commercial_status in ('needs_review','entered','reviewed','not_applicable'));

alter table public.policy_intermediary_payouts
  drop constraint if exists policy_intermediary_payouts_commercial_status_check;
alter table public.policy_intermediary_payouts
  add constraint policy_intermediary_payouts_commercial_status_check
  check (commercial_status in ('needs_review','entered','reviewed','not_applicable'));

update public.policy_payin_details
set commercial_status = case
  when coalesce(projected_od_percent,0) <> 0
    or coalesce(projected_tp_percent,0) <> 0
    or coalesce(insurer_scheme_amount,0) <> 0
  then 'entered'
  else 'needs_review'
end
where commercial_status = 'needs_review';

update public.policy_intermediary_payouts
set commercial_status = case
  when coalesce(od_payout_percent,0) <> 0
    or coalesce(tp_payout_percent,0) <> 0
    or coalesce(gross_payout,0) <> 0
  then 'entered'
  else 'needs_review'
end
where commercial_status = 'needs_review';

create table if not exists public.commercial_control_events (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  commercial_side text not null check (commercial_side in ('insurer','partner')),
  action text not null check (action in ('values_updated','status_changed','marked_not_applicable','reviewed')),
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  note text,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists commercial_control_events_policy_created_idx
  on public.commercial_control_events(policy_id, created_at desc);
create index if not exists commercial_control_events_actor_idx
  on public.commercial_control_events(actor_profile_id);
create index if not exists policy_payin_details_commercial_status_idx
  on public.policy_payin_details(commercial_status);
create index if not exists policy_intermediary_payouts_commercial_status_idx
  on public.policy_intermediary_payouts(commercial_status);

alter table public.commercial_control_events enable row level security;
revoke all on table public.commercial_control_events from anon, authenticated;
