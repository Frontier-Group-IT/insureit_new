begin;

alter table public.intermediary_onboarding_applications
  drop constraint if exists intermediary_onboarding_applications_registration_status_check;

alter table public.intermediary_onboarding_applications
  add constraint intermediary_onboarding_applications_registration_status_check
  check (registration_status in (
    'primary_pending',
    'pan_checking',
    'documents_pending',
    'partner_active',
    'existing_posp_documents_pending',
    'existing_posp_ready_for_activation',
    'training_pending',
    'training_assigned',
    'training_in_progress',
    'training_completed',
    'exam_pending',
    'exam_allotted',
    'exam_in_progress',
    'exam_failed',
    'exam_passed',
    'agreement_pending',
    'agreement_sent',
    'agreement_signed',
    'iib_submission_pending',
    'iib_submitted',
    'iib_registered',
    'rejected'
  ));

create or replace function public.issue_partner_identity(p_application_id uuid, p_actor_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.intermediary_onboarding_applications%rowtype;
  v_profile public.posp_misp_onboarding_profiles%rowtype;
  v_partner public.partners%rowtype;
  v_kind text;
  v_name text;
  v_pan text;
  v_email text;
  v_mobile text;
begin
  select * into v_app
  from public.intermediary_onboarding_applications
  where id = p_application_id
  for update;

  if not found then raise exception 'Application not found'; end if;
  if v_app.requested_type not in ('posp','misp') then raise exception 'Invalid requested onboarding type'; end if;

  select * into v_profile
  from public.posp_misp_onboarding_profiles
  where application_id = p_application_id
  for update;

  if not found then raise exception 'Onboarding profile not found'; end if;

  if v_app.partner_record_id is not null then
    select * into v_partner from public.partners where id = v_app.partner_record_id;
    if not found then raise exception 'Partner record not found'; end if;

    update public.intermediary_onboarding_applications
    set final_type = 'partner',
        partner_status = 'active_partner',
        partner_activated_at = coalesce(partner_activated_at, now()),
        registration_status = 'partner_active',
        updated_at = now()
    where id = p_application_id;

    update public.posp_misp_onboarding_profiles
    set partner_record_id = v_partner.id,
        partner_id = v_partner.partner_code,
        final_account_type = 'partner',
        partner_status = 'active_partner',
        partner_activated_at = coalesce(partner_activated_at, now()),
        updated_by = p_actor_id,
        updated_at = now()
    where application_id = p_application_id;

    return v_partner.partner_code;
  end if;

  v_kind := case when v_app.requested_type = 'posp' then 'individual' else 'business' end;
  v_name := coalesce(nullif(btrim(case when v_app.requested_type = 'misp' then v_profile.misp_name else v_profile.pos_name end), ''), 'Unnamed Partner');
  v_pan := nullif(upper(btrim(case when v_app.requested_type = 'misp' then coalesce(v_profile.pan_number, v_profile.dp_pan_number) else v_profile.pan_number end)), '');
  v_email := nullif(lower(btrim(case when v_app.requested_type = 'misp' then coalesce(v_profile.dp_email, v_profile.applicant_email) else v_profile.applicant_email end)), '');
  v_mobile := nullif(btrim(case when v_app.requested_type = 'misp' then coalesce(v_profile.dp_phone, v_profile.applicant_phone) else v_profile.applicant_phone end), '');

  insert into public.partners (
    partner_code, partner_kind, display_name, legal_name, mobile, email, pan_number, gst_number,
    city, state, postal_code, partner_status, portal_access_status, source_application_id, created_by
  ) values (
    public.next_partner_code(), v_kind, v_name,
    case when v_kind = 'business' then v_name else null end,
    v_mobile, v_email, v_pan, nullif(upper(btrim(v_profile.gst_number)), ''),
    v_profile.city, v_profile.state, v_profile.postal_code,
    'active_partner', 'not_created', p_application_id, p_actor_id
  ) returning * into v_partner;

  update public.intermediary_onboarding_applications
  set partner_record_id = v_partner.id,
      registration_record_id = null,
      final_type = 'partner',
      partner_status = 'active_partner',
      partner_activated_at = coalesce(partner_activated_at, now()),
      registration_status = 'partner_active',
      updated_at = now()
  where id = p_application_id;

  update public.posp_misp_onboarding_profiles
  set partner_record_id = v_partner.id,
      registration_record_id = null,
      partner_id = v_partner.partner_code,
      final_account_type = 'partner',
      partner_status = 'active_partner',
      partner_activated_at = coalesce(partner_activated_at, now()),
      updated_by = p_actor_id,
      updated_at = now()
  where application_id = p_application_id;

  return v_partner.partner_code;
end;
$$;

create or replace function public.sync_partner_intermediary(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_intermediary_id uuid;
begin
  select
    p.application_id,
    p.partner_id,
    p.partner_type,
    p.external_onboarding_id,
    coalesce(nullif(p.misp_name, ''), nullif(p.pos_name, ''), 'Unnamed Partner') as display_name,
    case when p.partner_type = 'misp' then coalesce(p.dp_phone, p.applicant_phone) else p.applicant_phone end as mobile,
    case when p.partner_type = 'misp' then coalesce(p.dp_email, p.applicant_email) else p.applicant_email end as email,
    p.city
  into v_profile
  from public.posp_misp_onboarding_profiles p
  where p.application_id = p_application_id
    and p.partner_id is not null
    and p.partner_status = 'active_partner'
    and p.final_account_type = 'partner';

  if not found then
    raise exception 'Active Partner profile not found for application %', p_application_id;
  end if;

  select id
  into v_intermediary_id
  from public.intermediaries
  where application_id = p_application_id
  limit 1;

  if v_intermediary_id is null then
    insert into public.intermediaries (
      application_id, intermediary_code, onboarding_id, intermediary_type, requested_type,
      display_name, mobile, email, city, iib_status, compliance_status, account_status,
      portal_access_status, visibility_level, created_at, updated_at
    ) values (
      v_profile.application_id, v_profile.partner_id, v_profile.external_onboarding_id,
      'partner', v_profile.partner_type, v_profile.display_name, v_profile.mobile,
      v_profile.email, v_profile.city, 'pending', 'pending', 'active',
      'not_created', 'internal', now(), now()
    )
    returning id into v_intermediary_id;
  else
    update public.intermediaries
    set intermediary_code = v_profile.partner_id,
        onboarding_id = v_profile.external_onboarding_id,
        intermediary_type = 'partner',
        requested_type = v_profile.partner_type,
        display_name = v_profile.display_name,
        mobile = v_profile.mobile,
        email = v_profile.email,
        city = v_profile.city,
        iib_status = 'pending',
        compliance_status = 'pending',
        account_status = 'active',
        portal_access_status = coalesce(portal_access_status, 'not_created'),
        visibility_level = coalesce(visibility_level, 'internal'),
        updated_at = now()
    where id = v_intermediary_id;
  end if;

  return v_intermediary_id;
end;
$$;

create or replace function public.sync_posp_misp_profile_to_intermediary()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_app record;
  v_context text;
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
  select id, draft_data, final_type, registration_status
  into v_app
  from public.intermediary_onboarding_applications
  where id = new.application_id;

  if not found then
    return new;
  end if;

  v_context := v_app.draft_data ->> 'account_context';

  if new.partner_status <> 'active_partner' then
    return new;
  end if;

  if v_context in ('posp','misp') then
    v_type := v_context;
    v_code := coalesce(nullif(new.posp_id,''), nullif(new.external_onboarding_id,''), 'INT-' || upper(substr(replace(new.id::text,'-',''),1,10)));
  elsif coalesce(new.final_account_type, v_app.final_type) = 'partner' then
    v_type := 'partner';
    v_code := coalesce(nullif(new.partner_id,''), nullif(new.external_onboarding_id,''), 'PART-PENDING-' || upper(substr(replace(new.id::text,'-',''),1,8)));
  else
    return new;
  end if;

  v_name:=coalesce(nullif(new.pos_name,''),nullif(new.misp_name,''),nullif(new.dp_name,''),nullif(new.associate_name,''),'Unnamed intermediary');
  v_iib_status:=case when new.iib_remarks='No Data Found In POS System' then 'cleared' when new.iib_remarks='Matching Record Found In DataBase' then 'existing_record' else 'pending' end;
  v_compliance:=case when v_type='partner' then 'pending' when new.iib_remarks='No Data Found In POS System' then case when new.workflow_stage='completed' then 'approved' else 'eligible' end when new.iib_remarks='Matching Record Found In DataBase' then 'existing_iib_record' else 'pending' end;
  v_account:=case when new.partner_decision='do_not_proceed' then 'rejected' when v_type='partner' or v_app.registration_status='iib_registered' then 'active' else 'under_onboarding' end;
  v_visibility:=case when v_type='partner' then 'internal' else 'standard' end;
  v_bank_last_four:=nullif(right(regexp_replace(coalesce(new.bank_account_number,''),'\s','','g'),4),'');

  insert into public.intermediaries(application_id,onboarding_profile_id,intermediary_code,requested_type,intermediary_type,display_name,legal_name,onboarding_id,mobile,email,pan_number,gst_number,address,city,state,postal_code,bank_id,bank_name,bank_account_last_four,bank_ifsc_code,associate_employee_id,associate_profile_id,iib_status,compliance_status,account_status,portal_access_status,visibility_level,source,activated_at,created_by,updated_by,updated_at)
  values(new.application_id,new.id,v_code,coalesce(new.requested_account_type,new.partner_type),v_type,v_name,case when new.partner_type='misp' then new.misp_name else new.pos_name end,new.external_onboarding_id,case when new.partner_type='misp' then coalesce(new.dp_phone,new.applicant_phone) else new.applicant_phone end,case when new.partner_type='misp' then coalesce(new.dp_email,new.applicant_email) else new.applicant_email end,case when new.partner_type='misp' then coalesce(new.dp_pan_number,new.pan_number) else new.pan_number end,new.gst_number,new.address,new.city,new.state,new.postal_code,new.bank_id,new.bank_name,v_bank_last_four,new.bank_ifsc_code,new.associate_employee_id,new.associate_profile_id,v_iib_status,v_compliance,v_account,'not_created',v_visibility,new.source,case when v_account='active' then now() else null end,new.created_by,new.updated_by,now())
  on conflict(onboarding_profile_id) do update set application_id=excluded.application_id,intermediary_code=excluded.intermediary_code,requested_type=excluded.requested_type,intermediary_type=excluded.intermediary_type,display_name=excluded.display_name,legal_name=excluded.legal_name,onboarding_id=excluded.onboarding_id,mobile=excluded.mobile,email=excluded.email,pan_number=excluded.pan_number,gst_number=excluded.gst_number,address=excluded.address,city=excluded.city,state=excluded.state,postal_code=excluded.postal_code,bank_id=excluded.bank_id,bank_name=excluded.bank_name,bank_account_last_four=excluded.bank_account_last_four,bank_ifsc_code=excluded.bank_ifsc_code,associate_employee_id=excluded.associate_employee_id,associate_profile_id=excluded.associate_profile_id,iib_status=excluded.iib_status,compliance_status=excluded.compliance_status,account_status=excluded.account_status,visibility_level=excluded.visibility_level,activated_at=coalesce(public.intermediaries.activated_at,excluded.activated_at),updated_by=excluded.updated_by,updated_at=now()
  returning id into v_intermediary_id;

  update public.intermediary_onboarding_applications
  set intermediary_id=v_intermediary_id,
      updated_at=now()
  where id=new.application_id;

  return new;
end;
$$;

update public.intermediary_onboarding_applications app
set final_type = 'partner',
    registration_status = 'partner_active',
    updated_at = now()
from public.posp_misp_onboarding_profiles profile
where profile.application_id = app.id
  and profile.partner_status = 'active_partner'
  and (app.draft_data ->> 'account_context' is null or app.draft_data ->> 'account_context' = 'partner')
  and app.registration_status in ('training_pending','agreement_pending','documents_pending','partner_active');

update public.posp_misp_onboarding_profiles profile
set final_account_type = 'partner',
    workflow_stage = 'completed',
    updated_at = now()
from public.intermediary_onboarding_applications app
where app.id = profile.application_id
  and profile.partner_status = 'active_partner'
  and (app.draft_data ->> 'account_context' is null or app.draft_data ->> 'account_context' = 'partner');

update public.posp_misp_onboarding_profiles
set updated_at = updated_at
where partner_status = 'active_partner';

revoke all on function public.issue_partner_identity(uuid, uuid) from public;
grant execute on function public.issue_partner_identity(uuid, uuid) to service_role;
revoke all on function public.sync_partner_intermediary(uuid) from public;
grant execute on function public.sync_partner_intermediary(uuid) to service_role;

commit;
