-- Enable standalone mobile Dealership onboarding submission.
-- The approval step still runs through the portal review workspace.

create or replace function public.submit_dealership_onboarding_application(
  p_application_id uuid,
  p_draft_data jsonb
)
returns public.customer_onboarding_applications
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  application public.customer_onboarding_applications;
  dealership_type text := p_draft_data->>'dealership_type';
  phone text := regexp_replace(coalesce(p_draft_data->>'phone', ''), '\D', '', 'g');
  representative_phone text := regexp_replace(coalesce(p_draft_data->>'representative_mobile', ''), '\D', '', 'g');
  representative_aadhaar text := regexp_replace(coalesce(p_draft_data->>'representative_aadhaar', ''), '\D', '', 'g');
  representative_pan text := upper(regexp_replace(coalesce(p_draft_data->>'representative_pan', ''), '\s', '', 'g'));
  gst_number text := nullif(upper(regexp_replace(coalesce(p_draft_data->>'gst_number', ''), '\s', '', 'g')), '');
  gst_registered boolean := coalesce((p_draft_data->>'is_gst_registered')::boolean, false);
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into application
  from public.customer_onboarding_applications
  where id = p_application_id
    and profile_id = auth.uid()
    and partner_type = 'dealership'
    and status in ('in_progress', 'changes_requested')
  for update;

  if application.id is null then raise exception 'Dealership onboarding application is unavailable.'; end if;
  if dealership_type not in ('posp', 'misp') then raise exception 'Choose POSP or MISP.'; end if;
  if nullif(trim(p_draft_data->>'dealership_name'), '') is null then raise exception 'Enter dealership name.'; end if;
  if nullif(trim(p_draft_data->>'owner_name'), '') is null then raise exception 'Enter owner name.'; end if;
  if length(phone) <> 10 then raise exception 'Enter a valid dealership mobile number.'; end if;
  if nullif(trim(p_draft_data->>'india_location_id'), '') is null then raise exception 'Select a valid city.'; end if;
  if nullif(trim(p_draft_data->>'oem_name'), '') is null then raise exception 'Enter dealership OEM.'; end if;
  if (p_draft_data->>'yearly_sales_band') not in ('less_than_500', '500_to_1000', 'more_than_1000') then raise exception 'Select yearly sales.'; end if;
  if gst_registered and (gst_number is null or gst_number !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$') then raise exception 'Enter a valid GSTIN.'; end if;
  if nullif(trim(p_draft_data->>'representative_name'), '') is null then raise exception 'Enter representative name.'; end if;
  if length(representative_phone) <> 10 then raise exception 'Enter a valid representative mobile number.'; end if;
  if representative_aadhaar !~ '^[0-9]{12}$' then raise exception 'Enter a valid representative Aadhaar number.'; end if;
  if representative_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then raise exception 'Enter a valid representative PAN.'; end if;

  if not exists (select 1 from public.customer_onboarding_documents where application_id = application.id and document_type = 'representative_aadhaar_front' and verification_status <> 'rejected') then
    raise exception 'Aadhaar front is required.';
  end if;
  if not exists (select 1 from public.customer_onboarding_documents where application_id = application.id and document_type = 'representative_aadhaar_back' and verification_status <> 'rejected') then
    raise exception 'Aadhaar back is required.';
  end if;
  if not exists (select 1 from public.customer_onboarding_documents where application_id = application.id and document_type = 'representative_pan_copy' and verification_status <> 'rejected') then
    raise exception 'PAN copy is required.';
  end if;
  if gst_registered and not exists (select 1 from public.customer_onboarding_documents where application_id = application.id and document_type = 'gst_copy' and verification_status <> 'rejected') then
    raise exception 'GST certificate is required.';
  end if;

  delete from public.customer_onboarding_contacts where application_id = application.id;
  insert into public.customer_onboarding_contacts (application_id, contact_role, full_name, phone, email, login_required, linked_profile_id, membership_status)
  values (
    application.id,
    'dealership_owner',
    trim(p_draft_data->>'owner_name'),
    '+91' || phone,
    nullif(lower(trim(coalesce(p_draft_data->>'email', ''))), ''),
    true,
    auth.uid(),
    'active'
  );

  update public.customer_onboarding_applications
  set status = 'submitted',
      current_step = 4,
      applicant_phone = '+91' || phone,
      applicant_email = nullif(lower(trim(coalesce(p_draft_data->>'email', ''))), ''),
      draft_data = (p_draft_data
        || jsonb_build_object(
          'phone', '+91' || phone,
          'representative_mobile', '+91' || representative_phone,
          'representative_pan', representative_pan,
          'representative_aadhaar_last_four', right(representative_aadhaar, 4),
          'representative_aadhaar_hash', encode(digest(representative_aadhaar, 'sha256'), 'hex'),
          'gst_number', gst_number
        ))
        - 'representative_aadhaar',
      submitted_at = now(),
      updated_at = now()
  where id = application.id
  returning * into application;

  return application;
end;
$$;

revoke all on function public.submit_dealership_onboarding_application(uuid, jsonb) from public;
grant execute on function public.submit_dealership_onboarding_application(uuid, jsonb) to authenticated;
