begin;

alter table public.pan_verification_jobs
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_worker_heartbeat_at timestamptz;

create index if not exists pan_verification_jobs_lease_idx
  on public.pan_verification_jobs(status, lease_expires_at);

create or replace function public.claim_pan_verification_jobs(
  p_limit integer default 3,
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
  update public.pan_verification_jobs job
  set status = 'pending',
      started_at = null,
      lease_expires_at = null,
      checked_by_device = null,
      last_error = coalesce(job.last_error, 'Previous worker lease expired before completion.'),
      updated_at = now()
  where job.status = 'checking'
    and coalesce(job.lease_expires_at, job.started_at + interval '10 minutes') < now();

  return query
  with candidates as (
    select job.id
    from public.pan_verification_jobs job
    where job.status in ('pending', 'queued', 'failed')
    order by job.requested_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 3), 10))
  ), updated as (
    update public.pan_verification_jobs job
    set status = 'checking',
        started_at = now(),
        completed_at = null,
        attempt_count = job.attempt_count + 1,
        checked_by_device = nullif(trim(p_worker_device), ''),
        lease_expires_at = now() + interval '10 minutes',
        last_worker_heartbeat_at = now(),
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

comment on column public.pan_verification_jobs.lease_expires_at is
'Time after which an interrupted checking job may safely return to the pending queue.';

commit;
