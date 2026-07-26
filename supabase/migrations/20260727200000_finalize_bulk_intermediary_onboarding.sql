begin;

-- Ensure the dedicated application can hold its final intermediary link.
alter table public.intermediary_onboarding_applications
  add column if not exists intermediary_id uuid references public.intermediaries(id) on delete set null;

-- Ensure intermediary document master references the dedicated onboarding document table.
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_attribute att on att.attrelid=rel.oid and att.attnum=any(con.conkey)
    where con.contype='f' and rel.relname='intermediary_documents' and att.attname='application_document_id'
  loop
    execute format('alter table public.intermediary_documents drop constraint if exists %I',r.conname);
  end loop;
end $$;

alter table public.intermediary_documents
  add constraint intermediary_documents_onboarding_document_fk_final
  foreign key (application_document_id) references public.intermediary_onboarding_documents(id) on delete set null;

-- Clear stale IIB route fields before a changed PAN is stored.
create or replace function public.reset_intermediary_iib_before_pan_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_new_pan text:=upper(regexp_replace(coalesce(case when new.partner_type='misp' then new.dp_pan_number else new.pan_number end,''),'\s','','g'));
  v_old_pan text:=upper(regexp_replace(coalesce(case when old.partner_type='misp' then old.dp_pan_number else old.pan_number end,''),'\s','','g'));
begin
  if tg_op='UPDATE' and v_old_pan is distinct from v_new_pan then
    new.iib_remarks:=null;
    new.iib_upload_status:='pending';
    new.iib_uploaded:=false;
    new.iib_uploaded_at:=null;
    new.iib_completed_at:=null;
    new.final_account_type:=null;
    new.partner_decision:='not_applicable';
    new.partner_decision_at:=null;
    new.partner_decision_by:=null;
    new.partner_decision_remark:=null;
  end if;
  return new;
end;
$$;

-- Queue only after the profile exists, preventing bulk-submission FK failures.
create or replace function public.queue_intermediary_pan_after_profile_save()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_pan text:=upper(regexp_replace(coalesce(case when new.partner_type='misp' then new.dp_pan_number else new.pan_number end,''),'\s','','g'));
begin
  if new.workflow_stage='pre_iib'
     and new.bank_id is not null
     and v_pan~'^[A-Z]{5}[0-9]{4}[A-Z]$'
     and exists(select 1 from public.intermediary_onboarding_applications where id=new.application_id and status in('submitted','under_review','changes_requested')) then
    insert into public.pan_verification_jobs(
      application_id,onboarding_profile_id,partner_type,pan_number,status,
      result_code,result_message,last_error,checked_by_device,requested_at,
      started_at,completed_at,attempt_count,updated_at
    ) values (
      new.application_id,new.id,new.partner_type,v_pan,'pending',
      null,null,null,null,now(),null,null,0,now()
    )
    on conflict(application_id) do update set
      onboarding_profile_id=excluded.onboarding_profile_id,
      partner_type=excluded.partner_type,
      pan_number=excluded.pan_number,
      status='pending',result_code=null,result_message=null,last_error=null,
      checked_by_device=null,requested_at=now(),started_at=null,completed_at=null,
      attempt_count=0,updated_at=now()
    where public.pan_verification_jobs.pan_number is distinct from excluded.pan_number
       or public.pan_verification_jobs.status in('failed','invalid');
  end if;
  return new;
end;
$$;

drop trigger if exists queue_posp_misp_pan_when_ready on public.posp_misp_onboarding_profiles;
drop trigger if exists reset_intermediary_iib_before_pan_change on public.posp_misp_onboarding_profiles;
drop trigger if exists queue_intermediary_pan_after_profile_save on public.posp_misp_onboarding_profiles;

create trigger reset_intermediary_iib_before_pan_change
before update of pan_number,dp_pan_number on public.posp_misp_onboarding_profiles
for each row execute function public.reset_intermediary_iib_before_pan_change();

create trigger queue_intermediary_pan_after_profile_save
after insert or update of pan_number,dp_pan_number,bank_id,workflow_stage
on public.posp_misp_onboarding_profiles
for each row execute function public.queue_intermediary_pan_after_profile_save();

-- Validate identity and contact fields consistently for manual and Excel onboarding.
create or replace function public.validate_intermediary_onboarding_profile()
returns trigger
language plpgsql
as $$
begin
  if new.partner_type='posp' then
    if nullif(trim(coalesce(new.applicant_email,'')),'') is null then raise exception 'POSP Email is required.'; end if;
    if new.date_of_birth is null then raise exception 'POSP Date of Birth is required.'; end if;
    if nullif(trim(coalesce(new.aadhaar_number_encrypted,'')),'') is null or new.aadhaar_last_four is null then raise exception 'POSP Aadhaar Number is required.'; end if;
  elsif new.partner_type='misp' then
    if nullif(trim(coalesce(new.dp_email,'')),'') is null then raise exception 'DP Email is required.'; end if;
    if new.dp_date_of_birth is null then raise exception 'DP Date of Birth is required.'; end if;
    if nullif(trim(coalesce(new.dp_aadhaar_number_encrypted,'')),'') is null or new.dp_aadhaar_last_four is null then raise exception 'DP Aadhaar Number is required.'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_intermediary_onboarding_profile on public.posp_misp_onboarding_profiles;
create trigger validate_intermediary_onboarding_profile
before insert or update on public.posp_misp_onboarding_profiles
for each row execute function public.validate_intermediary_onboarding_profile();

-- Requeue only profiles that are valid and do not already have a completed result.
insert into public.pan_verification_jobs(
  application_id,onboarding_profile_id,partner_type,pan_number,status,
  requested_at,attempt_count,updated_at
)
select p.application_id,p.id,p.partner_type,
       upper(regexp_replace(case when p.partner_type='misp' then p.dp_pan_number else p.pan_number end,'\s','','g')),
       'pending',now(),0,now()
from public.posp_misp_onboarding_profiles p
join public.intermediary_onboarding_applications a on a.id=p.application_id
left join public.pan_verification_jobs j on j.application_id=p.application_id
where p.workflow_stage='pre_iib'
  and p.bank_id is not null
  and upper(regexp_replace(coalesce(case when p.partner_type='misp' then p.dp_pan_number else p.pan_number end,''),'\s','','g'))~'^[A-Z]{5}[0-9]{4}[A-Z]$'
  and a.status in('submitted','under_review','changes_requested')
  and (j.id is null or j.status in('failed','invalid'))
on conflict(application_id) do update set
  onboarding_profile_id=excluded.onboarding_profile_id,
  partner_type=excluded.partner_type,
  pan_number=excluded.pan_number,
  status='pending',result_code=null,result_message=null,last_error=null,
  requested_at=now(),started_at=null,completed_at=null,attempt_count=0,updated_at=now();

commit;
