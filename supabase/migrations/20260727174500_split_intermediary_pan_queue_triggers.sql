begin;

create or replace function public.reset_posp_misp_iib_route_when_pan_changes()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_new_pan text:=case when new.partner_type='misp' then new.dp_pan_number else new.pan_number end;
  v_old_pan text:=case when old.partner_type='misp' then old.dp_pan_number else old.pan_number end;
begin
  v_new_pan:=upper(regexp_replace(coalesce(v_new_pan,''),'\s','','g'));
  v_old_pan:=upper(regexp_replace(coalesce(v_old_pan,''),'\s','','g'));
  if tg_op='UPDATE' and v_old_pan is distinct from v_new_pan then
    new.iib_remarks:=null;
    new.final_account_type:=null;
    new.partner_decision:='not_applicable';
    new.partner_decision_at:=null;
    new.partner_decision_by:=null;
    new.partner_decision_remark:=null;
    new.iib_upload_status:='pending';
    new.iib_uploaded:=false;
    new.iib_uploaded_at:=null;
    new.iib_completed_at:=null;
  end if;
  return new;
end;
$$;

create or replace function public.queue_posp_misp_pan_on_profile_ready()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_pan text:=case when new.partner_type='misp' then new.dp_pan_number else new.pan_number end;
begin
  v_pan:=upper(regexp_replace(coalesce(v_pan,''),'\s','','g'));
  if new.workflow_stage='pre_iib' and new.bank_id is not null and v_pan~'^[A-Z]{5}[0-9]{4}[A-Z]$'
     and exists(select 1 from public.intermediary_onboarding_applications app where app.id=new.application_id and app.status in('submitted','under_review','changes_requested')) then
    insert into public.pan_verification_jobs(application_id,onboarding_profile_id,partner_type,pan_number,status,result_code,result_message,last_error,checked_by_device,requested_at,started_at,completed_at,attempt_count,updated_at)
    values(new.application_id,new.id,new.partner_type,v_pan,'pending',null,null,null,null,now(),null,null,0,now())
    on conflict(application_id) do update set onboarding_profile_id=excluded.onboarding_profile_id,partner_type=excluded.partner_type,pan_number=excluded.pan_number,status='pending',result_code=null,result_message=null,last_error=null,checked_by_device=null,requested_at=now(),started_at=null,completed_at=null,attempt_count=0,updated_at=now()
    where public.pan_verification_jobs.pan_number is distinct from excluded.pan_number
       or public.pan_verification_jobs.status in('failed','invalid');
  end if;
  return new;
end;
$$;

drop trigger if exists reset_posp_misp_iib_route_before_pan_change on public.posp_misp_onboarding_profiles;
create trigger reset_posp_misp_iib_route_before_pan_change
before update of pan_number,dp_pan_number
on public.posp_misp_onboarding_profiles
for each row execute function public.reset_posp_misp_iib_route_when_pan_changes();

drop trigger if exists queue_posp_misp_pan_when_ready on public.posp_misp_onboarding_profiles;
create trigger queue_posp_misp_pan_when_ready
after insert or update of pan_number,dp_pan_number,bank_id,workflow_stage
on public.posp_misp_onboarding_profiles
for each row execute function public.queue_posp_misp_pan_on_profile_ready();

commit;
