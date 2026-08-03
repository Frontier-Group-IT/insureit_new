-- Keep shared identity/contact details synchronized from the canonical Partner
-- application to its linked POSP/MISP application and register projection.
--
-- The Partner application is the source of truth for fields that describe the
-- same legal person/business. Workflow-specific fields (training, exam,
-- agreement, IIB, registration ID and account status) remain owned by the
-- linked POSP/MISP application and are intentionally not overwritten.

begin;

create or replace function public.sync_partner_details_to_linked_accounts(
  p_parent_application_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_app public.intermediary_onboarding_applications%rowtype;
  v_parent public.posp_misp_onboarding_profiles%rowtype;
  v_context text;
  v_display_name text;
  v_mobile text;
  v_email text;
  v_pan text;
  v_dob date;
  v_aadhaar_last_four text;
  v_bank_last_four text;
begin
  select *
  into v_app
  from public.intermediary_onboarding_applications
  where id = p_parent_application_id;

  if not found then
    return;
  end if;

  v_context := coalesce(nullif(v_app.draft_data ->> 'account_context', ''), 'partner');
  if v_context <> 'partner' or v_app.partner_record_id is null then
    return;
  end if;

  select *
  into v_parent
  from public.posp_misp_onboarding_profiles
  where application_id = p_parent_application_id;

  if not found then
    return;
  end if;

  v_display_name := case
    when v_parent.partner_type = 'misp'
      then coalesce(nullif(v_parent.misp_name, ''), nullif(v_parent.dp_name, ''), 'Unnamed intermediary')
    else coalesce(nullif(v_parent.pos_name, ''), nullif(v_parent.dp_name, ''), 'Unnamed intermediary')
  end;
  v_mobile := case when v_parent.partner_type = 'misp' then coalesce(v_parent.dp_phone, v_parent.applicant_phone) else v_parent.applicant_phone end;
  v_email := case when v_parent.partner_type = 'misp' then coalesce(v_parent.dp_email, v_parent.applicant_email) else v_parent.applicant_email end;
  v_pan := case when v_parent.partner_type = 'misp' then coalesce(v_parent.dp_pan_number, v_parent.pan_number) else v_parent.pan_number end;
  v_dob := case when v_parent.partner_type = 'misp' then v_parent.dp_date_of_birth else v_parent.date_of_birth end;
  v_aadhaar_last_four := case when v_parent.partner_type = 'misp' then v_parent.dp_aadhaar_last_four else v_parent.aadhaar_last_four end;
  v_bank_last_four := nullif(right(regexp_replace(coalesce(v_parent.bank_account_number, ''), '\D', '', 'g'), 4), '');

  -- Keep the canonical Partner record current for modules that read partners.
  update public.partners
  set display_name = v_display_name,
      legal_name = case when partner_kind = 'business' then coalesce(nullif(v_parent.misp_name, ''), v_display_name) else null end,
      mobile = v_mobile,
      email = v_email,
      pan_number = v_pan,
      gst_number = v_parent.gst_number,
      city = v_parent.city,
      state = v_parent.state,
      postal_code = v_parent.postal_code,
      updated_at = now()
  where id = v_app.partner_record_id;

  -- Refresh copied shared fields on every linked POSP/MISP profile. Do not
  -- change registration/workflow/compliance fields owned by the child account.
  update public.posp_misp_onboarding_profiles child
  set associate_employee_id = v_parent.associate_employee_id,
      associate_profile_id = v_parent.associate_profile_id,
      associate_name = v_parent.associate_name,
      associate_id = v_parent.associate_id,
      document_received_at = v_parent.document_received_at,
      pos_first_name = case when child.partner_type = 'posp' then v_parent.pos_first_name else child.pos_first_name end,
      pos_middle_name = case when child.partner_type = 'posp' then v_parent.pos_middle_name else child.pos_middle_name end,
      pos_last_name = case when child.partner_type = 'posp' then v_parent.pos_last_name else child.pos_last_name end,
      pos_name = case when child.partner_type = 'posp' then v_parent.pos_name else child.pos_name end,
      misp_name = case when child.partner_type = 'misp' then v_parent.misp_name else child.misp_name end,
      applicant_phone = v_parent.applicant_phone,
      applicant_email = v_parent.applicant_email,
      pan_number = v_parent.pan_number,
      gst_number = v_parent.gst_number,
      address = v_parent.address,
      city = v_parent.city,
      state = v_parent.state,
      postal_code = v_parent.postal_code,
      bank_id = v_parent.bank_id,
      bank_name = v_parent.bank_name,
      bank_account_number = v_parent.bank_account_number,
      bank_ifsc_code = v_parent.bank_ifsc_code,
      oem_name = case when child.partner_type = 'misp' then v_parent.oem_name else child.oem_name end,
      dp_first_name = case when child.partner_type = 'misp' then v_parent.dp_first_name else child.dp_first_name end,
      dp_middle_name = case when child.partner_type = 'misp' then v_parent.dp_middle_name else child.dp_middle_name end,
      dp_last_name = case when child.partner_type = 'misp' then v_parent.dp_last_name else child.dp_last_name end,
      dp_name = case when child.partner_type = 'misp' then v_parent.dp_name else child.dp_name end,
      dp_phone = case when child.partner_type = 'misp' then v_parent.dp_phone else child.dp_phone end,
      dp_email = case when child.partner_type = 'misp' then v_parent.dp_email else child.dp_email end,
      dp_pan_number = case when child.partner_type = 'misp' then v_parent.dp_pan_number else child.dp_pan_number end,
      dp_date_of_birth = case when child.partner_type = 'misp' then v_parent.dp_date_of_birth else child.dp_date_of_birth end,
      dp_aadhaar_last_four = case when child.partner_type = 'misp' then v_parent.dp_aadhaar_last_four else child.dp_aadhaar_last_four end,
      dp_aadhaar_hash = case when child.partner_type = 'misp' then v_parent.dp_aadhaar_hash else child.dp_aadhaar_hash end,
      dp_aadhaar_number_encrypted = case when child.partner_type = 'misp' then v_parent.dp_aadhaar_number_encrypted else child.dp_aadhaar_number_encrypted end,
      date_of_birth = case when child.partner_type = 'posp' then v_parent.date_of_birth else child.date_of_birth end,
      aadhaar_last_four = case when child.partner_type = 'posp' then v_parent.aadhaar_last_four else child.aadhaar_last_four end,
      aadhaar_hash = case when child.partner_type = 'posp' then v_parent.aadhaar_hash else child.aadhaar_hash end,
      aadhaar_number_encrypted = case when child.partner_type = 'posp' then v_parent.aadhaar_number_encrypted else child.aadhaar_number_encrypted end,
      updated_by = v_parent.updated_by,
      updated_at = now()
  from public.intermediary_onboarding_applications child_app
  where child.application_id = child_app.id
    and child_app.partner_record_id = v_app.partner_record_id
    and child_app.id <> p_parent_application_id
    and child_app.draft_data ->> 'account_context' in ('posp', 'misp');

  -- Keep the child application list projection current. Sensitive values are
  -- intentionally excluded from draft_data.
  update public.intermediary_onboarding_applications child_app
  set applicant_phone = v_mobile,
      applicant_email = v_email,
      draft_data = coalesce(child_app.draft_data, '{}'::jsonb) || jsonb_build_object(
        'associate_employee_id', v_parent.associate_employee_id,
        'associate_profile_id', v_parent.associate_profile_id,
        'associate_name', v_parent.associate_name,
        'associate_id', v_parent.associate_id,
        'document_received_at', v_parent.document_received_at,
        'pos_first_name', v_parent.pos_first_name,
        'pos_middle_name', v_parent.pos_middle_name,
        'pos_last_name', v_parent.pos_last_name,
        'pos_name', v_parent.pos_name,
        'misp_name', v_parent.misp_name,
        'applicant_phone', v_parent.applicant_phone,
        'applicant_email', v_parent.applicant_email,
        'pan_number', v_parent.pan_number,
        'gst_number', v_parent.gst_number,
        'address', v_parent.address,
        'city', v_parent.city,
        'state', v_parent.state,
        'postal_code', v_parent.postal_code,
        'bank_id', v_parent.bank_id,
        'bank_name', v_parent.bank_name,
        'bank_account_last_four', v_bank_last_four,
        'bank_ifsc_code', v_parent.bank_ifsc_code,
        'oem_name', v_parent.oem_name,
        'dp_first_name', v_parent.dp_first_name,
        'dp_middle_name', v_parent.dp_middle_name,
        'dp_last_name', v_parent.dp_last_name,
        'dp_name', v_parent.dp_name,
        'dp_phone', v_parent.dp_phone,
        'dp_email', v_parent.dp_email,
        'dp_pan_number', v_parent.dp_pan_number,
        'dp_date_of_birth', v_parent.dp_date_of_birth,
        'dp_aadhaar_last_four', v_parent.dp_aadhaar_last_four,
        'date_of_birth', v_parent.date_of_birth,
        'aadhaar_last_four', v_parent.aadhaar_last_four,
        'gst_registered', v_parent.gst_number is not null
      ),
      updated_at = now()
  where child_app.partner_record_id = v_app.partner_record_id
    and child_app.id <> p_parent_application_id
    and child_app.draft_data ->> 'account_context' in ('posp', 'misp');

  -- Keep contact cards and the register/list projection in sync immediately.
  update public.intermediary_onboarding_contacts contact
  set full_name = v_display_name,
      phone = v_mobile,
      email = v_email
  from public.intermediary_onboarding_applications child_app
  where contact.application_id = child_app.id
    and child_app.partner_record_id = v_app.partner_record_id
    and child_app.id <> p_parent_application_id
    and child_app.draft_data ->> 'account_context' in ('posp', 'misp');

  update public.intermediaries register_row
  set display_name = v_display_name,
      legal_name = case when register_row.intermediary_type = 'misp' then v_parent.misp_name else v_parent.pos_name end,
      mobile = v_mobile,
      email = v_email,
      pan_number = v_pan,
      gst_number = v_parent.gst_number,
      address = v_parent.address,
      city = v_parent.city,
      state = v_parent.state,
      postal_code = v_parent.postal_code,
      bank_id = v_parent.bank_id,
      bank_name = v_parent.bank_name,
      bank_account_last_four = v_bank_last_four,
      bank_ifsc_code = v_parent.bank_ifsc_code,
      associate_employee_id = v_parent.associate_employee_id,
      associate_profile_id = v_parent.associate_profile_id,
      updated_by = v_parent.updated_by,
      updated_at = now()
  from public.intermediary_onboarding_applications linked_app
  where register_row.application_id = linked_app.id
    and linked_app.partner_record_id = v_app.partner_record_id
    and linked_app.draft_data ->> 'account_context' in ('posp', 'misp');
end;
$function$;

create or replace function public.handle_partner_details_sync_to_linked_accounts()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.sync_partner_details_to_linked_accounts(new.application_id);
  return new;
end;
$function$;

drop trigger if exists trg_sync_partner_details_to_linked_accounts
on public.posp_misp_onboarding_profiles;

create trigger trg_sync_partner_details_to_linked_accounts
after update of
  associate_employee_id,
  associate_profile_id,
  associate_name,
  associate_id,
  document_received_at,
  pos_first_name,
  pos_middle_name,
  pos_last_name,
  pos_name,
  misp_name,
  applicant_phone,
  applicant_email,
  pan_number,
  gst_number,
  address,
  city,
  state,
  postal_code,
  bank_id,
  bank_name,
  bank_account_number,
  bank_ifsc_code,
  oem_name,
  dp_first_name,
  dp_middle_name,
  dp_last_name,
  dp_name,
  dp_phone,
  dp_email,
  dp_pan_number,
  dp_date_of_birth,
  dp_aadhaar_last_four,
  dp_aadhaar_hash,
  dp_aadhaar_number_encrypted,
  date_of_birth,
  aadhaar_last_four,
  aadhaar_hash,
  aadhaar_number_encrypted
on public.posp_misp_onboarding_profiles
for each row
execute function public.handle_partner_details_sync_to_linked_accounts();

revoke all on function public.sync_partner_details_to_linked_accounts(uuid) from public;
revoke all on function public.handle_partner_details_sync_to_linked_accounts() from public;
grant execute on function public.sync_partner_details_to_linked_accounts(uuid) to service_role;
grant execute on function public.handle_partner_details_sync_to_linked_accounts() to service_role;

-- Backfill existing parent/child pairs so currently stale pages become aligned
-- as soon as the migration is applied.
do $backfill$
declare
  v_parent record;
begin
  for v_parent in
    select a.id
    from public.intermediary_onboarding_applications a
    where coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') = 'partner'
      and a.partner_record_id is not null
  loop
    perform public.sync_partner_details_to_linked_accounts(v_parent.id);
  end loop;
end;
$backfill$;

commit;
