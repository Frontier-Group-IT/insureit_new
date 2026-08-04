begin;

alter table public.pan_verification_jobs
  add column if not exists worker_session_id text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_worker_heartbeat_at timestamptz;

create index if not exists pan_verification_jobs_lease_idx
  on public.pan_verification_jobs(status, lease_expires_at);

create or replace function public.claim_pan_verification_jobs(
  p_limit integer default 3,
  p_worker_device text default null,
  p_worker_session_id text default null,
  p_lease_minutes integer default 5
)
returns table (
  id uuid,
  application_id uuid,
  onboarding_profile_id uuid,
  partner_type text,
  pan_number text,
  attempt_count integer,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_lease interval := make_interval(mins => greatest(2, least(coalesce(p_lease_minutes, 5), 15)));
begin
  if nullif(trim(p_worker_session_id), '') is null then
    raise exception 'worker_session_required';
  end if;

  return query
  with candidates as (
    select job.id
    from public.pan_verification_jobs job
    where job.status in ('pending', 'queued', 'failed')
       or (
         job.status = 'checking'
         and coalesce(job.lease_expires_at, job.started_at + interval '5 minutes', job.updated_at + interval '5 minutes') < v_now
       )
    order by
      case when job.status = 'checking' then 0 else 1 end,
      job.requested_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 3), 10))
  ), updated as (
    update public.pan_verification_jobs job
    set status = 'checking',
        started_at = v_now,
        completed_at = null,
        attempt_count = job.attempt_count + 1,
        checked_by_device = nullif(trim(p_worker_device), ''),
        worker_session_id = trim(p_worker_session_id),
        lease_expires_at = v_now + v_lease,
        last_worker_heartbeat_at = v_now,
        last_error = null,
        updated_at = v_now
    from candidates
    where job.id = candidates.id
    returning job.id, job.application_id, job.onboarding_profile_id,
      job.partner_type, job.pan_number, job.attempt_count, job.lease_expires_at
  )
  select updated.id, updated.application_id, updated.onboarding_profile_id,
    updated.partner_type, updated.pan_number, updated.attempt_count, updated.lease_expires_at
  from updated;
end;
$$;

revoke all on function public.claim_pan_verification_jobs(integer, text, text, integer) from public;
revoke all on function public.claim_pan_verification_jobs(integer, text, text, integer) from anon;
revoke all on function public.claim_pan_verification_jobs(integer, text, text, integer) from authenticated;
grant execute on function public.claim_pan_verification_jobs(integer, text, text, integer) to service_role;

create or replace function public.heartbeat_pan_verification_jobs(
  p_job_ids uuid[],
  p_worker_session_id text,
  p_worker_device text default null,
  p_lease_minutes integer default 5
)
returns table (id uuid, lease_expires_at timestamptz)
language sql
security definer
set search_path = public
as $$
  update public.pan_verification_jobs job
  set lease_expires_at = now() + make_interval(mins => greatest(2, least(coalesce(p_lease_minutes, 5), 15))),
      last_worker_heartbeat_at = now(),
      checked_by_device = coalesce(nullif(trim(p_worker_device), ''), job.checked_by_device),
      updated_at = now()
  where job.id = any(coalesce(p_job_ids, array[]::uuid[]))
    and job.status = 'checking'
    and job.worker_session_id = nullif(trim(p_worker_session_id), '')
    and coalesce(job.lease_expires_at, now()) >= now() - interval '30 seconds'
  returning job.id, job.lease_expires_at;
$$;

revoke all on function public.heartbeat_pan_verification_jobs(uuid[], text, text, integer) from public;
revoke all on function public.heartbeat_pan_verification_jobs(uuid[], text, text, integer) from anon;
revoke all on function public.heartbeat_pan_verification_jobs(uuid[], text, text, integer) from authenticated;
grant execute on function public.heartbeat_pan_verification_jobs(uuid[], text, text, integer) to service_role;

commit;
