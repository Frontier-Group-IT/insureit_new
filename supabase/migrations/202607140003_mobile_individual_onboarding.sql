-- Customer-app document access and validated Individual / Proprietor submission.

drop policy if exists "Applicants can update own onboarding documents" on public.customer_onboarding_documents;
create policy "Applicants can update own onboarding documents"
on public.customer_onboarding_documents for update to authenticated
using (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.customer_onboarding_applications application
    where application.id = customer_onboarding_documents.application_id
      and application.profile_id = auth.uid()
      and application.status in ('not_started', 'in_progress', 'changes_requested')
  )
)
with check (
  uploaded_by = auth.uid()
  and verification_status = 'pending'
  and exists (
    select 1 from public.customer_onboarding_applications application
    where application.id = customer_onboarding_documents.application_id
      and application.profile_id = auth.uid()
      and application.status in ('not_started', 'in_progress', 'changes_requested')
  )
);

drop policy if exists "Applicants can delete own onboarding documents" on public.customer_onboarding_documents;
create policy "Applicants can delete own onboarding documents"
on public.customer_onboarding_documents for delete to authenticated
using (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.customer_onboarding_applications application
    where application.id = customer_onboarding_documents.application_id
      and application.profile_id = auth.uid()
      and application.status in ('not_started', 'in_progress', 'changes_requested')
  )
);

drop policy if exists "Applicants can upload onboarding files" on storage.objects;
create policy "Applicants can upload onboarding files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'customer-documents'
  and exists (
    select 1 from public.customer_onboarding_applications application
    where application.id::text = (storage.foldername(name))[1]
      and application.profile_id = auth.uid()
      and application.status in ('not_started', 'in_progress', 'changes_requested')
  )
);

drop policy if exists "Applicants can read onboarding files" on storage.objects;
create policy "Applicants can read onboarding files"
on storage.objects for select to authenticated
using (
  bucket_id = 'customer-documents'
  and exists (
    select 1 from public.customer_onboarding_applications application
    where application.id::text = (storage.foldername(name))[1]
      and application.profile_id = auth.uid()
  )
);

drop policy if exists "Applicants can delete onboarding files" on storage.objects;
create policy "Applicants can delete onboarding files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'customer-documents'
  and exists (
    select 1 from public.customer_onboarding_applications application
    where application.id::text = (storage.foldername(name))[1]
      and application.profile_id = auth.uid()
      and application.status in ('not_started', 'in_progress', 'changes_requested')
  )
);

create or replace function public.submit_individual_onboarding_application(
  p_application_id uuid,
  p_contact_name text,
  p_email text,
  p_pan_number text,
  p_aadhaar_number text,
  p_address_street text,
  p_address_locality text,
  p_india_location_id uuid,
  p_city text,
  p_state text,
  p_postal_code text,
  p_legal_trade_name text,
  p_is_gst_registered boolean,
  p_gst_number text,
  p_fleet_size_band text
)
returns public.customer_onboarding_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  application public.customer_onboarding_applications;
  normalized_pan text := upper(regexp_replace(coalesce(p_pan_number, ''), '\s', '', 'g'));
  normalized_aadhaar text := regexp_replace(coalesce(p_aadhaar_number, ''), '\D', '', 'g');
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  normalized_gst text := upper(regexp_replace(coalesce(p_gst_number, ''), '\s', '', 'g'));
  required_document_count integer;
begin
  select * into application
  from public.customer_onboarding_applications
  where id = p_application_id
    and profile_id = auth.uid()
    and source = 'customer_app'
    and partner_type = 'individual_proprietor'
    and status in ('not_started', 'in_progress', 'changes_requested')
  for update;

  if application.id is null then raise exception 'Editable Individual / Proprietor application not found.'; end if;
  if nullif(btrim(p_contact_name), '') is null then raise exception 'Full name is required.'; end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Enter a valid email address.'; end if;
  if normalized_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then raise exception 'Enter a valid PAN number.'; end if;
  if normalized_aadhaar !~ '^[0-9]{12}$' then raise exception 'Enter a valid 12-digit Aadhaar number.'; end if;
  if nullif(btrim(p_address_street), '') is null then raise exception 'Address is required.'; end if;
  if p_india_location_id is null or nullif(btrim(p_city), '') is null or nullif(btrim(p_state), '') is null or p_postal_code !~ '^[0-9]{6}$' then raise exception 'Select a valid city and PIN code.'; end if;
  if p_fleet_size_band not in ('less_than_5', '5_to_20', '20_to_50', 'more_than_50') then raise exception 'Select a valid fleet size.'; end if;
  if p_is_gst_registered and nullif(btrim(p_legal_trade_name), '') is null then raise exception 'Legal trade name is required for GST registration.'; end if;
  if p_is_gst_registered and normalized_gst !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then raise exception 'Enter a valid GSTIN.'; end if;

  select count(*) into required_document_count
  from public.customer_onboarding_documents document
  where document.application_id = application.id
    and document.verification_status <> 'rejected'
    and document.document_type in ('pan_copy', 'aadhaar_front', 'aadhaar_back');
  if required_document_count <> 3 then raise exception 'PAN and both Aadhaar images are required.'; end if;
  if p_is_gst_registered and not exists (
    select 1 from public.customer_onboarding_documents document
    where document.application_id = application.id
      and document.document_type = 'gst_copy'
      and document.verification_status <> 'rejected'
  ) then raise exception 'GST certificate is required.'; end if;

  update public.profiles
  set full_name = btrim(p_contact_name), email = normalized_email
  where id = auth.uid() and role = 'customer';

  update public.customer_onboarding_applications
  set
    status = 'submitted',
    current_step = 4,
    applicant_email = normalized_email,
    draft_data = jsonb_build_object(
      'contact_name', btrim(p_contact_name),
      'email', normalized_email,
      'pan_number', normalized_pan,
      'aadhaar_last_four', right(normalized_aadhaar, 4),
      'aadhaar_hash', encode(digest(normalized_aadhaar, 'sha256'), 'hex'),
      'address_street', btrim(p_address_street),
      'address_locality', nullif(btrim(p_address_locality), ''),
      'india_location_id', p_india_location_id,
      'city', btrim(p_city),
      'state', btrim(p_state),
      'postal_code', p_postal_code,
      'legal_trade_name', nullif(btrim(p_legal_trade_name), ''),
      'is_gst_registered', p_is_gst_registered,
      'gst_number', case when p_is_gst_registered then normalized_gst else null end,
      'fleet_size_band', p_fleet_size_band
    ),
    submitted_at = now()
  where id = application.id
  returning * into application;

  return application;
end;
$$;

revoke all on function public.submit_individual_onboarding_application(uuid, text, text, text, text, text, text, uuid, text, text, text, text, boolean, text, text) from public;
grant execute on function public.submit_individual_onboarding_application(uuid, text, text, text, text, text, text, uuid, text, text, text, text, boolean, text, text) to authenticated;
