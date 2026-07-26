begin;

alter table public.intermediary_onboarding_applications
  add column if not exists intermediary_id uuid references public.intermediaries(id) on delete set null;

-- Repoint intermediary document master references to the dedicated onboarding document table.
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
  add constraint intermediary_documents_onboarding_document_fk
  foreign key (application_document_id) references public.intermediary_onboarding_documents(id) on delete set null;

create or replace function public.sync_posp_misp_profile_to_intermediary()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_type text;
  v_name text;
  v_iib_status text;
  v_compliance text;
  v_account text;
  v_visibility text;
  v_code text;
  v_intermediary_id uuid;
  v_bank_last_four text;
begin
  v_type:=case when new.final_account_type='partner' then 'partner' else new.partner_type end;
  v_name:=coalesce(nullif(new.pos_name,''),nullif(new.misp_name,''),nullif(new.dp_name,''),nullif(new.associate_name,''),'Unnamed intermediary');
  v_iib_status:=case when new.iib_remarks='No Data Found In POS System' then 'cleared' when new.iib_remarks='Matching Record Found In DataBase' then 'existing_record' else 'pending' end;
  v_compliance:=case when v_type='partner' then 'restricted_partner' when new.iib_remarks='No Data Found In POS System' then case when new.workflow_stage='completed' then 'approved' else 'eligible' end when new.iib_remarks='Matching Record Found In DataBase' then 'existing_iib_record' else 'pending' end;
  v_account:=case when new.partner_decision='do_not_proceed' then 'rejected' when new.workflow_stage='completed' then 'active' else 'under_onboarding' end;
  v_visibility:=case when v_type='partner' then 'restricted' else 'standard' end;
  v_code:=coalesce(nullif(new.external_onboarding_id,''),'INT-'||upper(substr(replace(new.id::text,'-',''),1,10)));
  v_bank_last_four:=nullif(right(regexp_replace(coalesce(new.bank_account_number,''),'\s','','g'),4),'');

  insert into public.intermediaries(application_id,onboarding_profile_id,intermediary_code,requested_type,intermediary_type,display_name,legal_name,onboarding_id,mobile,email,pan_number,gst_number,address,city,state,postal_code,bank_id,bank_name,bank_account_last_four,bank_ifsc_code,associate_employee_id,associate_profile_id,iib_status,compliance_status,account_status,portal_access_status,visibility_level,source,activated_at,created_by,updated_by,updated_at)
  values(new.application_id,new.id,v_code,coalesce(new.requested_account_type,new.partner_type),v_type,v_name,case when new.partner_type='misp' then new.misp_name else new.pos_name end,new.external_onboarding_id,new.applicant_phone,new.applicant_email,case when new.partner_type='misp' then new.dp_pan_number else new.pan_number end,new.gst_number,new.address,new.city,new.state,new.postal_code,new.bank_id,new.bank_name,v_bank_last_four,new.bank_ifsc_code,new.associate_employee_id,new.associate_profile_id,v_iib_status,v_compliance,v_account,'not_created',v_visibility,new.source,case when new.workflow_stage='completed' then coalesce(new.training_completed_at,now()) else null end,new.created_by,new.updated_by,now())
  on conflict(onboarding_profile_id) do update set application_id=excluded.application_id,intermediary_code=excluded.intermediary_code,requested_type=excluded.requested_type,intermediary_type=excluded.intermediary_type,display_name=excluded.display_name,legal_name=excluded.legal_name,onboarding_id=excluded.onboarding_id,mobile=excluded.mobile,email=excluded.email,pan_number=excluded.pan_number,gst_number=excluded.gst_number,address=excluded.address,city=excluded.city,state=excluded.state,postal_code=excluded.postal_code,bank_id=excluded.bank_id,bank_name=excluded.bank_name,bank_account_last_four=excluded.bank_account_last_four,bank_ifsc_code=excluded.bank_ifsc_code,associate_employee_id=excluded.associate_employee_id,associate_profile_id=excluded.associate_profile_id,iib_status=excluded.iib_status,compliance_status=excluded.compliance_status,account_status=excluded.account_status,visibility_level=excluded.visibility_level,activated_at=coalesce(public.intermediaries.activated_at,excluded.activated_at),updated_by=excluded.updated_by,updated_at=now()
  returning id into v_intermediary_id;

  update public.intermediary_onboarding_applications
  set intermediary_id=v_intermediary_id,
      final_type=v_type,
      updated_at=now()
  where id=new.application_id;
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
  v_old_pan text:=case when old.partner_type='misp' then old.dp_pan_number else old.pan_number end;
begin
  v_pan:=upper(regexp_replace(coalesce(v_pan,''),'\s','','g'));
  v_old_pan:=upper(regexp_replace(coalesce(v_old_pan,''),'\s','','g'));
  if tg_op='UPDATE' and v_old_pan is distinct from v_pan then
    new.iib_remarks:=null;
    new.final_account_type:=null;
    new.partner_decision:='not_applicable';
    new.partner_decision_at:=null;
    new.partner_decision_by:=null;
    new.partner_decision_remark:=null;
  end if;
  if new.workflow_stage='pre_iib' and new.bank_id is not null and v_pan~'^[A-Z]{5}[0-9]{4}[A-Z]$'
     and exists(select 1 from public.intermediary_onboarding_applications app where app.id=new.application_id and app.status in('submitted','under_review','changes_requested')) then
    insert into public.pan_verification_jobs(application_id,onboarding_profile_id,partner_type,pan_number,status,result_code,result_message,last_error,checked_by_device,requested_at,started_at,completed_at,attempt_count,updated_at)
    values(new.application_id,new.id,new.partner_type,v_pan,'pending',null,null,null,null,now(),null,null,0,now())
    on conflict(application_id) do update set onboarding_profile_id=excluded.onboarding_profile_id,partner_type=excluded.partner_type,pan_number=excluded.pan_number,status='pending',result_code=null,result_message=null,last_error=null,checked_by_device=null,requested_at=now(),started_at=null,completed_at=null,attempt_count=0,updated_at=now()
    where public.pan_verification_jobs.pan_number is distinct from excluded.pan_number;
  end if;
  return new;
end;
$$;

-- Ensure the queue trigger is BEFORE so PAN changes can clear stale route fields on NEW.
drop trigger if exists queue_posp_misp_pan_when_ready on public.posp_misp_onboarding_profiles;
create trigger queue_posp_misp_pan_when_ready
before insert or update of pan_number,dp_pan_number,bank_id,workflow_stage
on public.posp_misp_onboarding_profiles
for each row execute function public.queue_posp_misp_pan_on_profile_ready();

-- Backfill intermediary links and document master rows after the relationship switch.
update public.posp_misp_onboarding_profiles set updated_at=updated_at;

insert into public.intermediary_documents(intermediary_id,application_document_id,document_type,file_name,storage_bucket,storage_path,mime_type,file_size,verification_status,uploaded_by,verified_by,verified_at,updated_at)
select i.id,d.id,d.document_type,d.file_name,d.storage_bucket,d.storage_path,d.mime_type,d.file_size,d.verification_status,d.uploaded_by,d.verified_by,d.verified_at,now()
from public.intermediary_onboarding_documents d
join public.intermediaries i on i.application_id=d.application_id
on conflict(intermediary_id,document_type) do update set application_document_id=excluded.application_document_id,file_name=excluded.file_name,storage_bucket=excluded.storage_bucket,storage_path=excluded.storage_path,mime_type=excluded.mime_type,file_size=excluded.file_size,verification_status=excluded.verification_status,uploaded_by=excluded.uploaded_by,verified_by=excluded.verified_by,verified_at=excluded.verified_at,updated_at=now();

commit;
