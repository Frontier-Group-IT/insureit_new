begin;

-- Partner and its linked POSP/MISP account are separate workflow records, but
-- they represent one identity. Keep only identity/contact fields and shared
-- documents synchronized. IDs and qualification/workflow fields remain local
-- to each application.

create or replace function public.resolve_intermediary_partner_record_id(
  p_application_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(application.partner_record_id, profile.partner_record_id)
  from public.intermediary_onboarding_applications application
  left join public.posp_misp_onboarding_profiles profile
    on profile.application_id = application.id
  where application.id = p_application_id
  limit 1;
$$;

create or replace function public.sync_linked_intermediary_shared_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_record_id uuid;
  v_shared_application_ids uuid[];
begin
  -- Updates issued by this function fire the same trigger on sibling rows.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  v_partner_record_id := public.resolve_intermediary_partner_record_id(new.application_id);
  if v_partner_record_id is null then
    return new;
  end if;

  select coalesce(array_agg(application.id), array[new.application_id]::uuid[])
  into v_shared_application_ids
  from public.intermediary_onboarding_applications application
  where application.partner_record_id = v_partner_record_id;

  -- Keep the approved shared identity fields identical across the Partner and
  -- its linked POSP/MISP profile. Do not copy Partner/POSP/MISP IDs, workflow,
  -- training, exam, agreement, IIB or portal state.
  update public.posp_misp_onboarding_profiles target
  set associate_employee_id = new.associate_employee_id,
      associate_profile_id = new.associate_profile_id,
      associate_name = new.associate_name,
      associate_id = new.associate_id,
      document_received_at = new.document_received_at,
      pos_first_name = new.pos_first_name,
      pos_middle_name = new.pos_middle_name,
      pos_last_name = new.pos_last_name,
      pos_name = new.pos_name,
      misp_name = new.misp_name,
      applicant_phone = new.applicant_phone,
      applicant_email = new.applicant_email,
      pan_number = new.pan_number,
      gst_number = new.gst_number,
      address = new.address,
      city = new.city,
      state = new.state,
      postal_code = new.postal_code,
      bank_id = new.bank_id,
      bank_name = new.bank_name,
      bank_account_number = new.bank_account_number,
      bank_ifsc_code = new.bank_ifsc_code,
      oem_name = new.oem_name,
      dp_first_name = new.dp_first_name,
      dp_middle_name = new.dp_middle_name,
      dp_last_name = new.dp_last_name,
      dp_name = new.dp_name,
      dp_phone = new.dp_phone,
      dp_email = new.dp_email,
      dp_pan_number = new.dp_pan_number,
      dp_date_of_birth = new.dp_date_of_birth,
      dp_aadhaar_last_four = new.dp_aadhaar_last_four,
      dp_aadhaar_hash = new.dp_aadhaar_hash,
      dp_aadhaar_number_encrypted = new.dp_aadhaar_number_encrypted,
      date_of_birth = new.date_of_birth,
      aadhaar_last_four = new.aadhaar_last_four,
      aadhaar_hash = new.aadhaar_hash,
      aadhaar_number_encrypted = new.aadhaar_number_encrypted,
      education_status = new.education_status,
      updated_by = coalesce(new.updated_by, target.updated_by),
      updated_at = now()
  where target.application_id = any(v_shared_application_ids)
    and target.application_id <> new.application_id;

  -- Application rows and their safe draft mirrors are also synchronized. Full
  -- Aadhaar and bank-account values are never copied into draft_data.
  update public.intermediary_onboarding_applications target
  set applicant_phone = new.applicant_phone,
      applicant_email = new.applicant_email,
      draft_data = coalesce(target.draft_data, '{}'::jsonb) || jsonb_build_object(
        'partner_type', new.partner_type,
        'associate_employee_id', new.associate_employee_id,
        'associate_profile_id', new.associate_profile_id,
        'associate_name', new.associate_name,
        'associate_id', new.associate_id,
        'document_received_at', new.document_received_at,
        'pos_first_name', new.pos_first_name,
        'pos_middle_name', new.pos_middle_name,
        'pos_last_name', new.pos_last_name,
        'pos_name', new.pos_name,
        'misp_name', new.misp_name,
        'applicant_phone', new.applicant_phone,
        'applicant_email', new.applicant_email,
        'pan_number', new.pan_number,
        'gst_number', new.gst_number,
        'gst_registered', new.gst_number is not null,
        'address', new.address,
        'city', new.city,
        'state', new.state,
        'postal_code', new.postal_code,
        'bank_id', new.bank_id,
        'bank_name', new.bank_name,
        'bank_account_last_four', case when new.bank_account_number is null then null else right(new.bank_account_number, 4) end,
        'bank_ifsc_code', new.bank_ifsc_code,
        'oem_name', new.oem_name,
        'dp_first_name', new.dp_first_name,
        'dp_middle_name', new.dp_middle_name,
        'dp_last_name', new.dp_last_name,
        'dp_name', new.dp_name,
        'dp_phone', new.dp_phone,
        'dp_email', new.dp_email,
        'dp_pan_number', new.dp_pan_number,
        'dp_date_of_birth', new.dp_date_of_birth,
        'dp_aadhaar_last_four', new.dp_aadhaar_last_four,
        'date_of_birth', new.date_of_birth,
        'aadhaar_last_four', new.aadhaar_last_four,
        'education_status', new.education_status
      ),
      updated_at = now()
  where target.id = any(v_shared_application_ids);

  -- Keep the existing contact projections aligned without resetting portal or
  -- membership fields that belong to the individual account workflow.
  update public.intermediary_onboarding_contacts contact
  set full_name = case when new.partner_type = 'misp' then new.dp_name else new.pos_name end,
      phone = case when new.partner_type = 'misp' then new.dp_phone else new.applicant_phone end,
      email = case when new.partner_type = 'misp' then new.dp_email else new.applicant_email end,
      is_designated_person = new.partner_type = 'misp'
  where contact.application_id = any(v_shared_application_ids)
    and contact.contact_role in ('posp', 'misp_dp', 'misp_primary_dp');

  -- Removing GST from either account removes the sibling GST reference. The
  -- initiating write path still deletes its own row and performs storage
  -- cleanup after the sibling reference has gone.
  if new.gst_number is null then
    delete from public.intermediary_onboarding_documents document
    where document.application_id = any(v_shared_application_ids)
      and document.application_id <> new.application_id
      and document.document_type = 'gst_copy';
  end if;

  return new;
end;
$$;

drop trigger if exists intermediary_profile_sync_shared_identity
  on public.posp_misp_onboarding_profiles;

create trigger intermediary_profile_sync_shared_identity
after insert or update of
  partner_record_id,
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
  aadhaar_number_encrypted,
  education_status
on public.posp_misp_onboarding_profiles
for each row
execute function public.sync_linked_intermediary_shared_profile();

create or replace function public.is_shared_intermediary_document_type(
  p_document_type text
)
returns boolean
language sql
immutable
as $$
  select p_document_type = any(array[
    'aadhaar_front',
    'aadhaar_back',
    'pan_copy',
    'cancelled_cheque',
    'photograph',
    'gst_copy',
    'education_10th_marksheet',
    'education_12th_marksheet',
    'education_graduation_marksheet',
    'education_post_graduation_marksheet'
  ]::text[]);
$$;

create or replace function public.sync_linked_intermediary_shared_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_record_id uuid;
begin
  if pg_trigger_depth() > 1
     or not public.is_shared_intermediary_document_type(new.document_type) then
    return new;
  end if;

  v_partner_record_id := public.resolve_intermediary_partner_record_id(new.application_id);
  if v_partner_record_id is null then
    return new;
  end if;

  -- A person/business has one active education document. Remove obsolete
  -- sibling references first; the initiating application still performs its
  -- normal storage cleanup for its own replaced row.
  if new.document_type = any(array[
    'education_10th_marksheet',
    'education_12th_marksheet',
    'education_graduation_marksheet',
    'education_post_graduation_marksheet'
  ]::text[]) then
    delete from public.intermediary_onboarding_documents document
    using public.intermediary_onboarding_applications application
    where document.application_id = application.id
      and application.partner_record_id = v_partner_record_id
      and document.application_id <> new.application_id
      and document.document_type = any(array[
        'education_10th_marksheet',
        'education_12th_marksheet',
        'education_graduation_marksheet',
        'education_post_graduation_marksheet'
      ]::text[])
      and document.document_type <> new.document_type;
  end if;

  insert into public.intermediary_onboarding_documents (
    application_id,
    document_type,
    document_label,
    file_name,
    storage_bucket,
    storage_path,
    mime_type,
    file_size,
    verification_status,
    uploaded_by,
    verified_by,
    verified_at,
    created_at,
    updated_at
  )
  select application.id,
         new.document_type,
         new.document_label,
         new.file_name,
         new.storage_bucket,
         new.storage_path,
         new.mime_type,
         new.file_size,
         new.verification_status,
         new.uploaded_by,
         new.verified_by,
         new.verified_at,
         coalesce(new.created_at, now()),
         now()
  from public.intermediary_onboarding_applications application
  where application.partner_record_id = v_partner_record_id
    and application.id <> new.application_id
  on conflict (application_id, document_type)
  do update set
    document_label = excluded.document_label,
    file_name = excluded.file_name,
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path,
    mime_type = excluded.mime_type,
    file_size = excluded.file_size,
    verification_status = excluded.verification_status,
    uploaded_by = excluded.uploaded_by,
    verified_by = excluded.verified_by,
    verified_at = excluded.verified_at,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists intermediary_document_sync_shared_identity
  on public.intermediary_onboarding_documents;

create trigger intermediary_document_sync_shared_identity
after insert or update of
  document_type,
  document_label,
  file_name,
  storage_bucket,
  storage_path,
  mime_type,
  file_size,
  verification_status,
  uploaded_by,
  verified_by,
  verified_at
on public.intermediary_onboarding_documents
for each row
execute function public.sync_linked_intermediary_shared_document();

comment on function public.sync_linked_intermediary_shared_profile() is
  'Synchronizes approved identity/contact fields between a Partner application and its linked POSP/MISP application while preserving account-specific workflow and identifiers.';

comment on function public.sync_linked_intermediary_shared_document() is
  'Synchronizes identity documents between applications linked to the same canonical Partner record; qualification documents remain account-specific.';

commit;
