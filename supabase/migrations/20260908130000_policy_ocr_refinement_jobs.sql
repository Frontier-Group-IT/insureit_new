begin;

create table if not exists public.policy_ocr_refinement_jobs (
  id uuid primary key default gen_random_uuid(),
  training_candidate_id uuid not null references public.policy_ocr_training_candidates(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'claimed', 'pr_open', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  branch_name text,
  pull_request_number integer,
  error_message text,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (training_candidate_id)
);

alter table public.policy_ocr_refinement_jobs enable row level security;
revoke all on public.policy_ocr_refinement_jobs from public, anon, authenticated;

create or replace function public.enqueue_policy_ocr_refinement_job(p_candidate_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
begin
  insert into public.policy_ocr_refinement_jobs (training_candidate_id)
  values (p_candidate_id)
  on conflict (training_candidate_id) do update
    set updated_at = now()
  returning id into v_job_id;
  return v_job_id;
end;
$$;

revoke all on function public.enqueue_policy_ocr_refinement_job(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_policy_ocr_refinement_job(uuid) to service_role;

commit;
