begin;

create or replace function public.queue_posp_misp_pan_on_profile_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.pan_number is distinct from new.pan_number then
    update public.posp_misp_onboarding_profiles
    set iib_remarks = null,
        final_account_type = null,
        partner_decision = 'not_applicable',
        partner_decision_at = null,
        partner_decision_by = null,
        partner_decision_remark = null,
        updated_at = now()
    where id = new.id;
  end if;

  if new.workflow_stage = 'pre_iib'
     and new.bank_id is not null
     and new.pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'
     and exists (
       select 1
       from public.customer_onboarding_applications app
       where app.id = new.application_id
         and app.status in ('submitted','under_review','changes_requested')
     ) then
    insert into public.pan_verification_jobs (
      application_id,
      onboarding_profile_id,
      partner_type,
      pan_number,
      status,
      result_code,
      result_message,
      last_error,
      checked_by_device,
      requested_at,
      started_at,
      completed_at,
      attempt_count,
      updated_at
    ) values (
      new.application_id,
      new.id,
      new.partner_type,
      new.pan_number,
      'pending',
      null,
      null,
      null,
      null,
      now(),
      null,
      null,
      0,
      now()
    )
    on conflict (application_id) do update
    set onboarding_profile_id = excluded.onboarding_profile_id,
        partner_type = excluded.partner_type,
        pan_number = excluded.pan_number,
        status = 'pending',
        result_code = null,
        result_message = null,
        last_error = null,
        checked_by_device = null,
        requested_at = now(),
        started_at = null,
        completed_at = null,
        attempt_count = 0,
        updated_at = now()
    where public.pan_verification_jobs.pan_number is distinct from excluded.pan_number;
  end if;

  return new;
end;
$$;

update public.posp_misp_onboarding_profiles profile
set iib_remarks = null,
    final_account_type = null,
    partner_decision = 'not_applicable',
    partner_decision_at = null,
    partner_decision_by = null,
    partner_decision_remark = null,
    updated_at = now()
from public.pan_verification_jobs job
where job.application_id = profile.application_id
  and upper(regexp_replace(coalesce(job.pan_number, ''), '\s', '', 'g'))
      is distinct from upper(regexp_replace(coalesce(profile.pan_number, ''), '\s', '', 'g'));

update public.pan_verification_jobs job
set onboarding_profile_id = profile.id,
    partner_type = profile.partner_type,
    pan_number = profile.pan_number,
    status = 'pending',
    result_code = null,
    result_message = null,
    last_error = null,
    checked_by_device = null,
    requested_at = now(),
    started_at = null,
    completed_at = null,
    attempt_count = 0,
    updated_at = now()
from public.posp_misp_onboarding_profiles profile
where job.application_id = profile.application_id
  and profile.pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'
  and upper(regexp_replace(coalesce(job.pan_number, ''), '\s', '', 'g'))
      is distinct from upper(regexp_replace(coalesce(profile.pan_number, ''), '\s', '', 'g'));

commit;
