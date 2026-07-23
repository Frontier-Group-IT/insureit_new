-- Activate reviewed POSP/MISP applications as customers in one transaction.
-- Auth users are prepared by the server before this service-role-only RPC runs.

create sequence if not exists public.posp_misp_customer_code_seq;

create or replace function public.approve_posp_misp_onboarding_application(
  p_application_id uuid,
  p_reviewer_profile_id uuid,
  p_primary_profile_id uuid,
  p_secondary_profile_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  application_record public.customer_onboarding_applications%rowtype;
  onboarding_record public.posp_misp_onboarding_profiles%rowtype;
  primary_profile public.profiles%rowtype;
  secondary_profile public.profiles%rowtype;
  reviewer_role text;
  activated_customer_id uuid := gen_random_uuid();
  customer_code text;
  primary_name text;
  primary_phone text;
  secondary_phone text;
  company_name text;
  address_text text;
  now_at timestamptz := now();
begin
  select role::text
    into reviewer_role
  from public.profiles
  where id = p_reviewer_profile_id
    and is_active;

  if reviewer_role not in (
    'super_admin', 'admin', 'manager', 'it_super_user',
    'sales_operations_head', 'backoffice_executive'
  ) then
    raise exception 'Reviewer is not authorized to approve POSP/MISP applications.';
  end if;

  select *
    into application_record
  from public.customer_onboarding_applications
  where id = p_application_id
  for update;

  if application_record.id is null
    or coalesce(application_record.partner_type, '') not in ('posp', 'misp')
    or application_record.status not in ('submitted', 'under_review')
    or application_record.customer_id is not null then
    raise exception 'POSP/MISP application is not ready for approval.';
  end if;

  select *
    into onboarding_record
  from public.posp_misp_onboarding_profiles
  where application_id = p_application_id
  for update;

  if onboarding_record.id is null
    or onboarding_record.partner_type <> application_record.partner_type then
    raise exception 'POSP/MISP onboarding profile is unavailable.';
  end if;

  primary_name := case
    when application_record.partner_type = 'posp'
      then nullif(btrim(onboarding_record.pos_name), '')
    else coalesce(
      nullif(btrim(onboarding_record.misp_name), ''),
      nullif(btrim(onboarding_record.dp_name), '')
    )
  end;
  primary_phone := '+91' || right(regexp_replace(coalesce(onboarding_record.applicant_phone, ''), '\D', '', 'g'), 10);
  secondary_phone := case
    when onboarding_record.dp_phone is null then null
    else '+91' || right(regexp_replace(onboarding_record.dp_phone, '\D', '', 'g'), 10)
  end;
  company_name := case
    when application_record.partner_type = 'misp' then nullif(btrim(onboarding_record.misp_name), '')
    else nullif(btrim(onboarding_record.pos_name), '')
  end;
  address_text := nullif(concat_ws(', ',
    nullif(btrim(onboarding_record.address), ''),
    nullif(btrim(onboarding_record.city), ''),
    nullif(btrim(onboarding_record.state), ''),
    nullif(btrim(onboarding_record.postal_code), '')
  ), '');

  if primary_name is null or primary_phone !~ '^\+91[0-9]{10}$' then
    raise exception 'Primary POSP/MISP identity is incomplete.';
  end if;

  select *
    into primary_profile
  from public.profiles
  where id = p_primary_profile_id
  for share;

  if primary_profile.id is null
    or primary_profile.role::text <> 'customer'
    or not primary_profile.is_active
    or right(regexp_replace(coalesce(primary_profile.phone, ''), '\D', '', 'g'), 10)
      <> right(primary_phone, 10) then
    raise exception 'Primary customer login profile does not match the application.';
  end if;

  if exists (
    select 1
    from public.customers customer
    where customer.profile_id = p_primary_profile_id
       or right(regexp_replace(customer.phone, '\D', '', 'g'), 10) = right(primary_phone, 10)
  ) then
    raise exception 'A customer already uses the primary POSP/MISP login.';
  end if;

  if onboarding_record.pan_number is not null and exists (
    select 1
    from public.customers customer
    where customer.pan_number = onboarding_record.pan_number
  ) then
    raise exception 'A customer already uses this PAN number.';
  end if;

  if application_record.partner_type = 'misp'
    and secondary_phone is not null
    and secondary_phone <> primary_phone then
    if p_secondary_profile_id is null then
      raise exception 'A separate DP login is required for this MISP application.';
    end if;

    select *
      into secondary_profile
    from public.profiles
    where id = p_secondary_profile_id
    for share;

    if secondary_profile.id is null
      or secondary_profile.role::text <> 'customer'
      or not secondary_profile.is_active
      or right(regexp_replace(coalesce(secondary_profile.phone, ''), '\D', '', 'g'), 10)
        <> right(secondary_phone, 10) then
      raise exception 'DP customer login profile does not match the application.';
    end if;
  else
    p_secondary_profile_id := null;
  end if;

  customer_code := 'CUST-PM-' || to_char(now_at, 'YYYY') || '-' ||
    lpad(nextval('public.posp_misp_customer_code_seq')::text, 8, '0');

  insert into public.customers (
    id,
    profile_id,
    customer_code,
    partner_type,
    company_name,
    contact_name,
    phone,
    email,
    address,
    city,
    state,
    postal_code,
    pan_number,
    aadhaar_last_four,
    aadhaar_hash,
    legal_trade_name,
    is_gst_registered,
    gst_number,
    onboarding_status,
    onboarding_completed_at,
    created_by,
    updated_by
  )
  values (
    activated_customer_id,
    p_primary_profile_id,
    customer_code,
    application_record.partner_type,
    company_name,
    primary_name,
    primary_phone,
    onboarding_record.applicant_email,
    address_text,
    onboarding_record.city,
    onboarding_record.state,
    onboarding_record.postal_code,
    onboarding_record.pan_number,
    onboarding_record.aadhaar_last_four,
    onboarding_record.aadhaar_hash,
    company_name,
    onboarding_record.gst_number is not null,
    onboarding_record.gst_number,
    'active',
    now_at,
    p_reviewer_profile_id,
    p_reviewer_profile_id
  );

  insert into public.customer_memberships (
    customer_id,
    profile_id,
    invited_phone,
    invited_email,
    membership_role,
    is_primary,
    status,
    created_by
  )
  values (
    activated_customer_id,
    p_primary_profile_id,
    primary_phone,
    onboarding_record.applicant_email,
    case when application_record.partner_type = 'posp' then 'posp_owner' else 'misp_owner' end,
    true,
    'active',
    p_reviewer_profile_id
  );

  if p_secondary_profile_id is not null then
    insert into public.customer_memberships (
      customer_id,
      profile_id,
      invited_phone,
      invited_email,
      membership_role,
      is_primary,
      status,
      created_by
    )
    values (
      activated_customer_id,
      p_secondary_profile_id,
      secondary_phone,
      onboarding_record.dp_email,
      'misp_dp',
      false,
      'active',
      p_reviewer_profile_id
    );
  end if;

  if application_record.partner_type = 'posp' then
    update public.customer_onboarding_contacts
    set linked_profile_id = p_primary_profile_id,
        membership_status = 'active',
        updated_at = now_at
    where application_id = p_application_id
      and contact_role = 'posp';
  elsif p_secondary_profile_id is null then
    update public.customer_onboarding_contacts
    set linked_profile_id = p_primary_profile_id,
        membership_status = 'active',
        updated_at = now_at
    where application_id = p_application_id
      and contact_role in ('misp_primary_dp', 'misp_primary', 'misp_dp');
  else
    update public.customer_onboarding_contacts
    set linked_profile_id = case
          when contact_role = 'misp_dp' then p_secondary_profile_id
          else p_primary_profile_id
        end,
        membership_status = 'active',
        updated_at = now_at
    where application_id = p_application_id
      and contact_role in ('misp_primary', 'misp_dp');
  end if;

  update public.posp_misp_onboarding_profiles
  set customer_id = activated_customer_id,
      updated_by = p_reviewer_profile_id,
      updated_at = now_at
  where id = onboarding_record.id;

  update public.customer_onboarding_applications
  set status = 'approved',
      customer_id = activated_customer_id,
      profile_id = p_primary_profile_id,
      reviewed_by = p_reviewer_profile_id,
      reviewed_at = now_at,
      completed_at = now_at,
      draft_data = (coalesce(draft_data, '{}'::jsonb)
        - array['training_password', 'bank_account_number'])
        || jsonb_build_object(
          'bank_account_last_four', right(coalesce(onboarding_record.bank_account_number, ''), 4),
          'training_password_on_file', onboarding_record.training_password is not null
        )
  where id = p_application_id;

  insert into public.audit_logs (
    actor_id,
    action,
    table_name,
    record_id,
    new_data
  )
  values (
    p_reviewer_profile_id,
    'approve_posp_misp_onboarding',
    'customer_onboarding_applications',
    p_application_id,
    jsonb_build_object(
      'customer_id', activated_customer_id,
      'partner_type', application_record.partner_type,
      'primary_profile_id', p_primary_profile_id,
      'secondary_profile_created', p_secondary_profile_id is not null
    )
  );

  return activated_customer_id;
end;
$$;

revoke all on function public.approve_posp_misp_onboarding_application(uuid, uuid, uuid, uuid) from public;
revoke all on function public.approve_posp_misp_onboarding_application(uuid, uuid, uuid, uuid) from authenticated;
grant execute on function public.approve_posp_misp_onboarding_application(uuid, uuid, uuid, uuid) to service_role;
