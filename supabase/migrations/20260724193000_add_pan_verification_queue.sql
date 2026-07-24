begin;

create table if not exists public.pan_verification_jobs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.customer_onboarding_applications(id) on delete cascade,
  onboarding_profile_id uuid references public.posp_misp_onboarding_profiles(id) on delete cascade,
  partner_type text not null check (partner_type in ('posp', 'misp')),
  pan_number text not null,
  status text not null default 'pending' check (status in (
    'pending', 'queued', 'checking', 'matched', 'not_found', 'invalid', 'failed', 'manual_review'
  )),
  result_code text,
  result_message text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  checked_by_device text,
  requested_by uuid references public.profiles(id) on delete set null,
  override_reason text,
  overridden_by uuid references public.profiles(id) on delete set null,
  overridden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id)
);

create index if not exists pan_verification_jobs_status_requested_idx
  on public.pan_verification_jobs(status, requested_at);

create index if not exists pan_verification_jobs_profile_idx
  on public.pan_verification_jobs(onboarding_profile_id);

alter table public.pan_verification_jobs enable row level security;

comment on table public.pan_verification_jobs is
  'Local N.M. PAN checker work queue for POSP/MISP onboarding. Access is intentionally service-role only.';

create or replace function public.claim_pan_verification_jobs(
  p_limit integer default 20,
  p_worker_device text default null
)
returns table (
  id uuid,
  application_id uuid,
  onboarding_profile_id uuid,
  partner_type text,
  pan_number text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select job.id
    from public.pan_verification_jobs job
    where job.status in ('pending', 'queued', 'failed')
    order by job.requested_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  ), updated as (
    update public.pan_verification_jobs job
    set status = 'checking',
        started_at = now(),
        completed_at = null,
        attempt_count = job.attempt_count + 1,
        checked_by_device = nullif(trim(p_worker_device), ''),
        last_error = null,
        updated_at = now()
    from candidates
    where job.id = candidates.id
    returning job.id, job.application_id, job.onboarding_profile_id,
      job.partner_type, job.pan_number, job.attempt_count
  )
  select updated.id, updated.application_id, updated.onboarding_profile_id,
    updated.partner_type, updated.pan_number, updated.attempt_count
  from updated;
end;
$$;

revoke all on function public.claim_pan_verification_jobs(integer, text) from public;
revoke all on function public.claim_pan_verification_jobs(integer, text) from anon;
revoke all on function public.claim_pan_verification_jobs(integer, text) from authenticated;
grant execute on function public.claim_pan_verification_jobs(integer, text) to service_role;

commit;
