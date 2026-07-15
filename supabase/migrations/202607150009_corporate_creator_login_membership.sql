-- Keep the Corporate applicant as a separate login member instead of treating
-- them as the dedicated SPOC. CEO/Admin/SPOC remain separate login contacts.

create or replace function public.submit_corporate_onboarding_application(
  p_application_id uuid,
  p_company_name text,
  p_company_pan text,
  p_gst_number text,
  p_address_street text,
  p_address_locality text,
  p_india_location_id uuid,
  p_city text,
  p_state text,
  p_postal_code text,
  p_fleet_size_band text,
  p_ceo_name text,
  p_ceo_phone text,
  p_ceo_email text,
  p_admin_name text,
  p_admin_phone text,
  p_admin_email text,
  p_spoc_name text,
  p_spoc_phone text,
  p_spoc_email text
)
returns public.customer_onboarding_applications
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  application public.customer_onboarding_applications;
  v_applicant_name text;
  v_applicant_phone text;
  v_applicant_email text;
  normalized_pan text := upper(regexp_replace(coalesce(p_company_pan, ''), '\s', '', 'g'));
  normalized_gst text := nullif(upper(regexp_replace(coalesce(p_gst_number, ''), '\s', '', 'g')), '');
  ceo_phone text := regexp_replace(coalesce(p_ceo_phone, ''), '\D', '', 'g');
  admin_phone text := regexp_replace(coalesce(p_admin_phone, ''), '\D', '', 'g');
  spoc_phone text := regexp_replace(coalesce(p_spoc_phone, ''), '\D', '', 'g');
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

  select
    coalesce(nullif(profile.full_name, ''), 'Corporate Creator'),
    coalesce(nullif(user_record.phone, ''), nullif(user_record.raw_user_meta_data ->> 'phone', '')),
    nullif(user_record.email, '')
    into v_applicant_name, v_applicant_phone, v_applicant_email
  from auth.users user_record
  left join public.profiles profile on profile.id = user_record.id
  where user_record.id = auth.uid();

  v_applicant_phone := regexp_replace(coalesce(v_applicant_phone, ''), '\D', '', 'g');
  if length(v_applicant_phone) = 10 then v_applicant_phone := '+91' || v_applicant_phone; end if;
  if v_applicant_phone ~ '^91[0-9]{10}$' then v_applicant_phone := '+' || v_applicant_phone; end if;
  if v_applicant_phone !~ '^\+91[0-9]{10}$' then raise exception 'Your login mobile number is required for Corporate creator access.'; end if;

  select * into application
  from public.customer_onboarding_applications
  where id = p_application_id
    and profile_id = auth.uid()
    and partner_type = 'corporate'
    and status in ('in_progress', 'changes_requested')
  for update;

  if application.id is null then raise exception 'Corporate onboarding application is unavailable.'; end if;
  if nullif(trim(p_company_name), '') is null then raise exception 'Company name is required.'; end if;
  if normalized_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then raise exception 'Enter a valid company PAN number.'; end if;
  if normalized_gst is not null and normalized_gst !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then raise exception 'Enter a valid GSTIN.'; end if;
  if nullif(trim(p_address_street), '') is null or p_india_location_id is null then raise exception 'Complete the company address.'; end if;
  if p_fleet_size_band not in ('less_than_5','5_to_20','20_to_50','more_than_50') then raise exception 'Select a valid fleet size.'; end if;
  if nullif(trim(p_ceo_name), '') is null or nullif(trim(p_admin_name), '') is null or nullif(trim(p_spoc_name), '') is null then raise exception 'All three additional login contacts are required.'; end if;

  if length(ceo_phone) = 10 then ceo_phone := '+91' || ceo_phone; end if;
  if length(admin_phone) = 10 then admin_phone := '+91' || admin_phone; end if;
  if length(spoc_phone) = 10 then spoc_phone := '+91' || spoc_phone; end if;
  if ceo_phone !~ '^\+91[0-9]{10}$' or admin_phone !~ '^\+91[0-9]{10}$' or spoc_phone !~ '^\+91[0-9]{10}$' then raise exception 'Enter valid 10-digit mobile numbers for all contacts.'; end if;
  if array_length(array(select distinct item.phone from unnest(array[v_applicant_phone, ceo_phone, admin_phone, spoc_phone]) as item(phone)), 1) <> 4 then
    raise exception 'Corporate creator, CEO, Admin Head and Dedicated SPOC must use four different mobile numbers.';
  end if;

  if not exists (select 1 from public.customer_onboarding_documents where application_id = application.id and document_type = 'company_pan_copy' and verification_status <> 'rejected') then
    raise exception 'Company PAN copy is required.';
  end if;
  if normalized_gst is not null and not exists (select 1 from public.customer_onboarding_documents where application_id = application.id and document_type = 'gst_copy' and verification_status <> 'rejected') then
    raise exception 'GST certificate is required when GSTIN is provided.';
  end if;

  delete from public.customer_onboarding_contacts where application_id = application.id;
  insert into public.customer_onboarding_contacts (application_id, contact_role, full_name, phone, email, login_required, linked_profile_id, membership_status)
  values
    (application.id, 'corporate_creator', v_applicant_name, v_applicant_phone, nullif(lower(trim(v_applicant_email)), ''), true, auth.uid(), 'active'),
    (application.id, 'ceo_head', trim(p_ceo_name), ceo_phone, nullif(lower(trim(p_ceo_email)), ''), true, null, 'pending'),
    (application.id, 'admin_head', trim(p_admin_name), admin_phone, nullif(lower(trim(p_admin_email)), ''), true, null, 'pending'),
    (application.id, 'dedicated_spoc', trim(p_spoc_name), spoc_phone, nullif(lower(trim(p_spoc_email)), ''), true, null, 'pending');

  update public.customer_onboarding_applications
  set status = 'submitted',
      current_step = 4,
      submitted_at = now(),
      applicant_phone = v_applicant_phone,
      applicant_email = nullif(lower(trim(v_applicant_email)), ''),
      draft_data = jsonb_build_object(
        'company_name', trim(p_company_name), 'company_pan', normalized_pan, 'gst_number', normalized_gst,
        'address_street', trim(p_address_street), 'address_locality', nullif(trim(p_address_locality), ''),
        'india_location_id', p_india_location_id, 'city', trim(p_city), 'state', trim(p_state), 'postal_code', trim(p_postal_code),
        'fleet_size_band', p_fleet_size_band, 'login_contact_count', 4
      )
  where id = application.id
  returning * into application;

  return application;
end;
$$;

revoke all on function public.submit_corporate_onboarding_application(uuid,text,text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_corporate_onboarding_application(uuid,text,text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
