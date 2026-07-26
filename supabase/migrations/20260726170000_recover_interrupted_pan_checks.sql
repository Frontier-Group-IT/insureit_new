begin;

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
       or (
         job.status = 'checking'
         and nullif(trim(p_worker_device), '') is not null
         and job.checked_by_device = nullif(trim(p_worker_device), '')
         and coalesce(job.updated_at, job.started_at, job.requested_at) < now() - interval '45 seconds'
       )
       or (
         job.status = 'checking'
         and coalesce(job.updated_at, job.started_at, job.requested_at) < now() - interval '15 minutes'
       )
    order by
      case
        when job.status = 'checking' and job.checked_by_device = nullif(trim(p_worker_device), '') then 0
        when job.status in ('pending', 'queued') then 1
        when job.status = 'failed' then 2
        else 3
      end,
      job.requested_at asc
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

create index if not exists pan_verification_jobs_checking_recovery_idx
  on public.pan_verification_jobs(status, checked_by_device, updated_at)
  where status = 'checking';

commit;
