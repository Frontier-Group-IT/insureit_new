begin;

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
  with owned_candidates as (
    select job.id
    from public.pan_verification_jobs job
    where job.status = 'checking'
      and nullif(trim(coalesce(p_worker_device, '')), '') is not null
      and job.checked_by_device = nullif(trim(p_worker_device), '')
      and coalesce(job.lease_expires_at, now() + interval '1 minute') >= now()
    order by job.started_at asc nulls first
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 3), 10))
  ), resumed as (
    update public.pan_verification_jobs job
    set lease_expires_at = now() + interval '10 minutes',
        last_worker_heartbeat_at = now(),
        updated_at = now()
    from owned_candidates
    where job.id = owned_candidates.id
    returning job.id, job.application_id, job.onboarding_profile_id,
      job.partner_type, job.pan_number, job.attempt_count
  ), remaining_limit as (
    select greatest(0, greatest(1, least(coalesce(p_limit, 3), 10)) - count(*))::integer as value
    from resumed
  ), pending_candidates as (
    select job.id
    from public.pan_verification_jobs job, remaining_limit remaining
    where job.status in ('pending', 'queued', 'failed')
      and remaining.value > 0
    order by job.requested_at asc
    for update of job skip locked
    limit (select value from remaining_limit)
  ), claimed as (
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
    from pending_candidates
    where job.id = pending_candidates.id
    returning job.id, job.application_id, job.onboarding_profile_id,
      job.partner_type, job.pan_number, job.attempt_count
  )
  select resumed.id, resumed.application_id, resumed.onboarding_profile_id,
    resumed.partner_type, resumed.pan_number, resumed.attempt_count
  from resumed
  union all
  select claimed.id, claimed.application_id, claimed.onboarding_profile_id,
    claimed.partner_type, claimed.pan_number, claimed.attempt_count
  from claimed;
end;
$$;

revoke all on function public.claim_pan_verification_jobs(integer, text) from public;
revoke all on function public.claim_pan_verification_jobs(integer, text) from anon;
revoke all on function public.claim_pan_verification_jobs(integer, text) from authenticated;
grant execute on function public.claim_pan_verification_jobs(integer, text) to service_role;

comment on function public.claim_pan_verification_jobs(integer, text) is
'Resumes non-expired checking jobs already owned by the same extension device before claiming fresh PAN work.';

commit;
