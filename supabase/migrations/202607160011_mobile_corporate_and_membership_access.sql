-- Complete mobile corporate onboarding and make memberships the customer access boundary.

-- Customers linked through an active membership can read their customer workspace.
drop policy if exists customers_read_active_memberships on public.customers;
create policy customers_read_active_memberships
on public.customers for select
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.customer_memberships membership
    where membership.customer_id = customers.id
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
  )
);

-- Membership users need the related operational records used by the mobile dashboard.
drop policy if exists vehicles_read_customer_memberships on public.vehicles;
create policy vehicles_read_customer_memberships
on public.vehicles for select
to authenticated
using (
  exists (
    select 1 from public.customer_memberships membership
    where membership.customer_id = vehicles.customer_id
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
  )
);

drop policy if exists claims_read_customer_memberships on public.claims;
create policy claims_read_customer_memberships
on public.claims for select
to authenticated
using (
  exists (
    select 1 from public.customer_memberships membership
    where membership.customer_id = claims.customer_id
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
  )
);

drop policy if exists policies_read_customer_memberships on public.policies;
create policy policies_read_customer_memberships
on public.policies for select
to authenticated
using (
  exists (
    select 1 from public.customer_memberships membership
    where membership.customer_id = policies.customer_id
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
  )
);

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
  normalized_pan text := upper(regexp_replace(coalesce(p_company_pan, ''), '\s', '', 'g'));
  normalized_gst text := nullif(upper(regexp_replace(coalesce(p_gst_number, ''), '\s', '', 'g')), '');
  ceo_phone text := regexp_replace(coalesce(p_ceo_phone, ''), '\D', '', 'g');
  admin_phone text := regexp_replace(coalesce(p_admin_phone, ''), '\D', '', 'g');
  spoc_phone text := regexp_replace(coalesce(p_spoc_phone, ''), '\D', '', 'g');
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

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
  if nullif(trim(p_ceo_name), '') is null or nullif(trim(p_admin_name), '') is null or nullif(trim(p_spoc_name), '') is null then raise exception 'All three login contacts are required.'; end if;
  if length(ceo_phone) = 10 then ceo_phone := '+91' || ceo_phone; end if;
  if length(admin_phone) = 10 then admin_phone := '+91' || admin_phone; end if;
  if length(spoc_phone) = 10 then spoc_phone := '+91' || spoc_phone; end if;
  if ceo_phone !~ '^\+91[0-9]{10}$' or admin_phone !~ '^\+91[0-9]{10}$' or spoc_phone !~ '^\+91[0-9]{10}$' then raise exception 'Enter valid 10-digit mobile numbers for all contacts.'; end if;
  if ceo_phone = admin_phone or ceo_phone = spoc_phone or admin_phone = spoc_phone then raise exception 'Each login contact must use a different mobile number.'; end if;

  if not exists (select 1 from public.customer_onboarding_documents where application_id = application.id and document_type = 'company_pan_copy' and verification_status <> 'rejected') then
    raise exception 'Company PAN copy is required.';
  end if;
  if normalized_gst is not null and not exists (select 1 from public.customer_onboarding_documents where application_id = application.id and document_type = 'gst_copy' and verification_status <> 'rejected') then
    raise exception 'GST certificate is required when GSTIN is provided.';
  end if;

  delete from public.customer_onboarding_contacts where application_id = application.id;
  insert into public.customer_onboarding_contacts (application_id, contact_role, full_name, phone, email, login_required)
  values
    (application.id, 'ceo_head', trim(p_ceo_name), ceo_phone, nullif(lower(trim(p_ceo_email)), ''), true),
    (application.id, 'admin_head', trim(p_admin_name), admin_phone, nullif(lower(trim(p_admin_email)), ''), true),
    (application.id, 'dedicated_spoc', trim(p_spoc_name), spoc_phone, nullif(lower(trim(p_spoc_email)), ''), true);

  update public.customer_onboarding_applications
  set status = 'submitted', current_step = 4, submitted_at = now(), applicant_phone = spoc_phone,
      applicant_email = nullif(lower(trim(p_spoc_email)), ''),
      draft_data = jsonb_build_object(
        'company_name', trim(p_company_name), 'company_pan', normalized_pan, 'gst_number', normalized_gst,
        'address_street', trim(p_address_street), 'address_locality', nullif(trim(p_address_locality), ''),
        'india_location_id', p_india_location_id, 'city', trim(p_city), 'state', trim(p_state), 'postal_code', trim(p_postal_code),
        'fleet_size_band', p_fleet_size_band, 'login_contact_count', 3
      )
  where id = application.id
  returning * into application;

  return application;
end;
$$;

revoke all on function public.submit_corporate_onboarding_application(uuid,text,text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_corporate_onboarding_application(uuid,text,text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
