begin;

create or replace function public.sync_posp_misp_profile_to_intermediary()
returns trigger
language plpgsql
security definer
set search_path = public
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
  v_type := case when new.final_account_type = 'partner' then 'partner' else new.partner_type end;
  v_name := coalesce(nullif(new.pos_name,''), nullif(new.misp_name,''), nullif(new.associate_name,''), 'Unnamed intermediary');
  v_iib_status := case
    when new.iib_remarks = 'No Data Found In POS System' then 'cleared'
    when new.iib_remarks = 'Matching Record Found In DataBase' then 'existing_record'
    else 'pending'
  end;
  v_compliance := case
    when v_type = 'partner' then 'restricted_partner'
    when new.iib_remarks = 'No Data Found In POS System' then case when new.workflow_stage = 'completed' then 'approved' else 'eligible' end
    when new.iib_remarks = 'Matching Record Found In DataBase' then 'existing_iib_record'
    else 'pending'
  end;
  v_account := case
    when new.partner_decision = 'do_not_proceed' then 'rejected'
    when new.workflow_stage = 'completed' then 'active'
    else 'under_onboarding'
  end;
  v_visibility := case when v_type = 'partner' then 'restricted' else 'standard' end;
  v_code := coalesce(nullif(new.external_onboarding_id,''), 'INT-' || upper(substr(replace(new.id::text,'-',''),1,10)));
  v_bank_last_four := nullif(right(regexp_replace(coalesce(new.bank_account_number, ''), '\s', '', 'g'), 4), '');

  insert into public.intermediaries (
    application_id, onboarding_profile_id, intermediary_code, requested_type, intermediary_type,
    display_name, legal_name, onboarding_id, mobile, email, pan_number, gst_number,
    address, city, state, postal_code, bank_id, bank_name, bank_account_last_four,
    bank_ifsc_code, associate_employee_id, associate_profile_id, iib_status,
    compliance_status, account_status, portal_access_status, visibility_level,
    source, activated_at, created_by, updated_by, updated_at
  ) values (
    new.application_id, new.id, v_code, coalesce(new.requested_account_type,new.partner_type), v_type,
    v_name, case when new.partner_type = 'misp' then new.misp_name else new.pos_name end,
    new.external_onboarding_id, new.applicant_phone, new.applicant_email,
    case when new.partner_type = 'misp' then new.dp_pan_number else new.pan_number end,
    new.gst_number, new.address, new.city, new.state, new.postal_code, new.bank_id,
    new.bank_name, v_bank_last_four, new.bank_ifsc_code,
    new.associate_employee_id, new.associate_profile_id, v_iib_status, v_compliance,
    v_account, 'not_created', v_visibility, new.source,
    case when new.workflow_stage = 'completed' then coalesce(new.training_completed_at, now()) else null end,
    new.created_by, new.updated_by, now()
  )
  on conflict (onboarding_profile_id) do update set
    application_id = excluded.application_id,
    intermediary_code = excluded.intermediary_code,
    requested_type = excluded.requested_type,
    intermediary_type = excluded.intermediary_type,
    display_name = excluded.display_name,
    legal_name = excluded.legal_name,
    onboarding_id = excluded.onboarding_id,
    mobile = excluded.mobile,
    email = excluded.email,
    pan_number = excluded.pan_number,
    gst_number = excluded.gst_number,
    address = excluded.address,
    city = excluded.city,
    state = excluded.state,
    postal_code = excluded.postal_code,
    bank_id = excluded.bank_id,
    bank_name = excluded.bank_name,
    bank_account_last_four = excluded.bank_account_last_four,
    bank_ifsc_code = excluded.bank_ifsc_code,
    associate_employee_id = excluded.associate_employee_id,
    associate_profile_id = excluded.associate_profile_id,
    iib_status = excluded.iib_status,
    compliance_status = excluded.compliance_status,
    account_status = excluded.account_status,
    visibility_level = excluded.visibility_level,
    activated_at = coalesce(public.intermediaries.activated_at, excluded.activated_at),
    updated_by = excluded.updated_by,
    updated_at = now()
  returning id into v_intermediary_id;

  update public.customer_onboarding_applications
  set intermediary_id = v_intermediary_id
  where id = new.application_id and intermediary_id is distinct from v_intermediary_id;

  return new;
end;
$$;

-- Re-run the sync safely for existing profiles after replacing the broken trigger function.
update public.posp_misp_onboarding_profiles
set updated_at = updated_at;

commit;
