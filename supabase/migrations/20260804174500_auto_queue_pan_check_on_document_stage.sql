begin;

create or replace function public.queue_intermediary_pan_verification_on_document_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  verification_pan text;
  request_time timestamptz := now();
begin
  if new.workflow_stage <> 'iib_processing' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.workflow_stage = 'iib_processing'
     and coalesce(old.pan_number, '') = coalesce(new.pan_number, '')
     and coalesce(old.dp_pan_number, '') = coalesce(new.dp_pan_number, '') then
    return new;
  end if;

  verification_pan := upper(regexp_replace(
    case
      when new.partner_type = 'misp' then coalesce(new.dp_pan_number, '')
      else coalesce(new.pan_number, '')
    end,
    '\s',
    '',
    'g'
  ));

  if verification_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then
    return new;
  end if;

  insert into public.pan_verification_jobs (
    application_id,
    onboarding_profile_id,
    partner_type,
    pan_number,
    status,
    result_code,
    result_message,
    requested_at,
    started_at,
    completed_at,
    attempt_count,
    last_error,
    checked_by_device,
    requested_by,
    override_reason,
    overridden_by,
    overridden_at,
    worker_session_id,
    lease_expires_at,
    last_worker_heartbeat_at,
    updated_at
  ) values (
    new.application_id,
    new.id,
    new.partner_type,
    verification_pan,
    'pending',
    null,
    null,
    request_time,
    null,
    null,
    0,
    null,
    null,
    new.updated_by,
    null,
    null,
    null,
    null,
    null,
    null,
    request_time
  )
  on conflict (application_id) do update set
    onboarding_profile_id = excluded.onboarding_profile_id,
    partner_type = excluded.partner_type,
    pan_number = excluded.pan_number,
    status = 'pending',
    result_code = null,
    result_message = null,
    requested_at = excluded.requested_at,
    started_at = null,
    completed_at = null,
    attempt_count = 0,
    last_error = null,
    checked_by_device = null,
    requested_by = excluded.requested_by,
    override_reason = null,
    overridden_by = null,
    overridden_at = null,
    worker_session_id = null,
    lease_expires_at = null,
    last_worker_heartbeat_at = null,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists queue_intermediary_pan_verification_on_document_stage
  on public.posp_misp_onboarding_profiles;

create trigger queue_intermediary_pan_verification_on_document_stage
after insert or update of workflow_stage, pan_number, dp_pan_number
on public.posp_misp_onboarding_profiles
for each row
execute function public.queue_intermediary_pan_verification_on_document_stage();

insert into public.pan_verification_jobs (
  application_id,
  onboarding_profile_id,
  partner_type,
  pan_number,
  status,
  result_code,
  result_message,
  requested_at,
  started_at,
  completed_at,
  attempt_count,
  last_error,
  checked_by_device,
  requested_by,
  override_reason,
  overridden_by,
  overridden_at,
  worker_session_id,
  lease_expires_at,
  last_worker_heartbeat_at,
  updated_at
)
select
  profile.application_id,
  profile.id,
  profile.partner_type,
  upper(regexp_replace(
    case
      when profile.partner_type = 'misp' then coalesce(profile.dp_pan_number, '')
      else coalesce(profile.pan_number, '')
    end,
    '\s',
    '',
    'g'
  )),
  'pending',
  null,
  null,
  now(),
  null,
  null,
  0,
  null,
  null,
  profile.updated_by,
  null,
  null,
  null,
  null,
  null,
  null,
  now()
from public.posp_misp_onboarding_profiles profile
left join public.pan_verification_jobs job
  on job.application_id = profile.application_id
where profile.workflow_stage = 'iib_processing'
  and job.id is null
  and upper(regexp_replace(
    case
      when profile.partner_type = 'misp' then coalesce(profile.dp_pan_number, '')
      else coalesce(profile.pan_number, '')
    end,
    '\s',
    '',
    'g'
  )) ~ '^[A-Z]{5}[0-9]{4}[A-Z]$';

comment on function public.queue_intermediary_pan_verification_on_document_stage() is
  'Automatically queues the POSP PAN or MISP designated-person PAN when onboarding advances to the document stage, including normal and existing-account onboarding.';

commit;
