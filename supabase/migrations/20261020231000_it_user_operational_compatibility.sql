-- IT User authorization compatibility: preserve sole primary IT Super User identity controls.
-- Requires app_role enum value it_user. No user profile changes in this migration.
-- Privileged deletion and governance checks intentionally remain IT Super User only.

-- Extend operational permissions: _approve_posp_misp_onboarding_application_unchecked
CREATE OR REPLACE FUNCTION public._approve_posp_misp_onboarding_application_unchecked(p_application_id uuid, p_reviewer_profile_id uuid, p_primary_profile_id uuid, p_secondary_profile_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'super_admin', 'admin', 'manager', 'it_super_user','it_user',
    'sales_operations_head', 'sales_head', 'backoffice_executive'
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
$function$
;

-- Extend operational permissions: _effective_privileged_rpc_access
CREATE OR REPLACE FUNCTION public._effective_privileged_rpc_access(p_profile_id uuid, p_capability text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_access text;
begin
  select profile.role::text
    into v_role
  from public.profiles as profile
  where profile.id = p_profile_id
    and profile.is_active;

  if v_role is null then
    return 'none';
  end if;

  if v_role = 'it_super_user' then
    return 'approve';
  end if;

  if v_role = 'it_user' then
    if p_capability in ('manage_users','admin.portal_users.manage','admin.roles.manage','admin.permissions.manage') then
      return 'none';
    end if;
    return 'approve';
  end if;

  select override_row.access_level
    into v_access
  from public.employee_permission_overrides as override_row
  where override_row.profile_id = p_profile_id
    and override_row.capability = p_capability
    and override_row.access_level <> 'inherit'
    and (override_row.expires_at is null or override_row.expires_at > now())
  order by override_row.updated_at desc
  limit 1;

  if v_access is null then
    select override_row.access_level
      into v_access
    from public.role_permission_overrides as override_row
    where override_row.role = v_role
      and override_row.capability = p_capability
    order by override_row.updated_at desc
    limit 1;
  end if;

  if v_access is null then
    v_access := case p_capability
      when 'create_policies' then
        case when v_role in (
          'super_admin', 'admin', 'manager', 'it_super_user',
          'sales_operations_head', 'backoffice_executive'
        ) then 'edit' else 'none' end
      when 'approve_intermediary_application' then
        case when v_role in (
          'super_admin', 'admin', 'manager', 'it_super_user',
          'director', 'sales_operations_head'
        ) then 'approve' else 'none' end
      else 'none'
    end;
  end if;

  if v_role = 'backoffice_executive' then
    if p_capability = 'create_policies' then
      if v_access = 'approve' then
        v_access := 'edit';
      end if;
    else
      v_access := 'none';
    end if;
  end if;

  if v_access not in ('none', 'view', 'edit', 'approve') then
    return 'none';
  end if;

  return v_access;
end;
$function$
;

-- Extend operational permissions: assert_group_relationship_manager
CREATE OR REPLACE FUNCTION public.assert_group_relationship_manager(actor_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor_role text;
  actor_active boolean;
  is_service_role boolean :=
    coalesce(auth.jwt() ->> 'role', current_setting('request.jwt.claim.role', true), '') = 'service_role';
begin
  if actor_profile_id is null then
    raise exception 'A reviewer profile is required to manage Group affiliations.';
  end if;

  if not is_service_role and actor_profile_id is distinct from auth.uid() then
    raise exception 'The reviewer profile does not match the authenticated user.';
  end if;

  select role::text, is_active
    into actor_role, actor_active
  from public.profiles
  where id = actor_profile_id;

  if not coalesce(actor_active, false)
     or actor_role not in (
       'super_admin', 'admin', 'manager', 'it_super_user','it_user',
       'sales_operations_head', 'backoffice_executive'
     ) then
    raise exception 'You are not allowed to manage Group affiliations.';
  end if;
end;
$function$
;

-- Extend operational permissions: can_access_full_business_data
CREATE OR REPLACE FUNCTION public.can_access_full_business_data()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_app_role()::text in (
    'super_admin',
    'admin',
    'it_super_user','it_user',
    'director',
    'manager',
    'backoffice_executive',
    'claim_processor',
    'field_executive'
  );
$function$
;

-- Extend operational permissions: can_access_intermediary_owner
CREATE OR REPLACE FUNCTION public.can_access_intermediary_owner(owner_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.current_app_role()::text in (
      'super_admin', 'admin', 'it_super_user','it_user',
      'manager', 'sales_operations_head', 'backoffice_executive'
    )
    or (
      owner_profile_id is not null
      and owner_profile_id in (select profile_id from public.get_user_downline(auth.uid()))
    );
$function$
;

-- Extend operational permissions: can_access_profile
CREATE OR REPLACE FUNCTION public.can_access_profile(viewer_id uuid, target_profile_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  viewer_role text;
  target_role text;
  is_service_role boolean :=
    coalesce(auth.jwt() ->> 'role', current_setting('request.jwt.claim.role', true), '') = 'service_role';
begin
  if viewer_id is null or target_profile_id is null then
    return false;
  end if;

  if not is_service_role and viewer_id is distinct from auth.uid() then
    return false;
  end if;

  if viewer_id = target_profile_id then
    return true;
  end if;

  select role::text into viewer_role
  from public.profiles
  where id = viewer_id
    and is_active = true;

  select role::text into target_role
  from public.profiles
  where id = target_profile_id;

  if viewer_role is null then
    return false;
  end if;

  if viewer_role in ('it_super_user','it_user', 'admin', 'super_admin') then
    return true;
  end if;

  if viewer_role in ('sales_operations_head', 'backoffice_executive')
     and target_role = 'agent' then
    return true;
  end if;

  if viewer_role = 'director' then
    return coalesce(target_role, '') not in ('it_super_user','it_user', 'admin', 'super_admin');
  end if;

  if viewer_role = 'customer' then
    return false;
  end if;

  return exists (
    select 1
    from public.get_user_downline(viewer_id) d
    where d.profile_id = target_profile_id
  );
end;
$function$
;

-- Extend operational permissions: can_manage_claims_organization
CREATE OR REPLACE FUNCTION public.can_manage_claims_organization()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (
    select p.id, p.role::text as role
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active
  ),
  employee_override as (
    select epo.access_level, epo.scope_type
    from public.employee_permission_overrides epo
    join me on me.id = epo.profile_id
    where epo.capability = 'manage_claims'
      and (epo.expires_at is null or epo.expires_at > now())
    order by epo.updated_at desc nulls last, epo.created_at desc nulls last
    limit 1
  ),
  role_override as (
    select rpo.access_level, rpo.scope_type
    from public.role_permission_overrides rpo
    join me on me.role = rpo.role
    where rpo.capability = 'manage_claims'
    order by rpo.updated_at desc nulls last, rpo.created_at desc nulls last
    limit 1
  )
  select coalesce((
    select case
      when me.role = 'backoffice_executive' then false
      when exists (select 1 from employee_override where access_level <> 'inherit') then
        exists (
          select 1
          from employee_override
          where access_level in ('edit', 'approve')
            and scope_type = 'organization'
        )
      when exists (select 1 from role_override) then
        exists (
          select 1
          from role_override
          where access_level in ('edit', 'approve')
            and scope_type = 'organization'
        )
      -- IT Super User is the protected organization-wide role in the portal
      -- permission model.
      else me.role in ('it_super_user','it_user', 'claims_head')
    end
    from me
  ), false);
$function$
;

-- Extend operational permissions: can_manage_employees
CREATE OR REPLACE FUNCTION public.can_manage_employees()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_app_role()::text in ('super_admin', 'admin', 'it_super_user','it_user');
$function$
;

-- Extend operational permissions: can_manage_posp_misp_onboarding
CREATE OR REPLACE FUNCTION public.can_manage_posp_misp_onboarding()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_app_role()::text in (
    'super_admin',
    'admin',
    'manager',
    'it_super_user','it_user',
    'sales_head',
    'sales_operations_head',
    'backoffice_executive'
  );
$function$
;

-- Extend operational permissions: can_update_claim_status
CREATE OR REPLACE FUNCTION public.can_update_claim_status()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (
    select p.id, p.role::text as role
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active
  ),
  employee_override as (
    select epo.access_level, epo.scope_type
    from public.employee_permission_overrides epo
    join me on me.id = epo.profile_id
    where epo.capability = 'manage_claims'
      and (epo.expires_at is null or epo.expires_at > now())
    order by epo.updated_at desc nulls last, epo.created_at desc nulls last
    limit 1
  ),
  role_override as (
    select rpo.access_level, rpo.scope_type
    from public.role_permission_overrides rpo
    join me on me.role = rpo.role
    where rpo.capability = 'manage_claims'
    order by rpo.updated_at desc nulls last, rpo.created_at desc nulls last
    limit 1
  )
  select coalesce((
    select case
      -- Match the application-side permission ceiling: Backoffice cannot be
      -- elevated into claim editing through an override.
      when me.role = 'backoffice_executive' then false
      when exists (select 1 from employee_override where access_level <> 'inherit') then
        exists (select 1 from employee_override where access_level in ('edit', 'approve'))
      when exists (select 1 from role_override) then
        exists (select 1 from role_override where access_level in ('edit', 'approve'))
      else me.role in (
        'super_admin',
        'admin',
        'it_super_user','it_user',
        'manager',
        'sales_operations_head',
        'claims_head',
        'claim_processor'
      )
    end
    from me
  ), false);
$function$
;

-- Extend operational permissions: can_view_employee_record
CREATE OR REPLACE FUNCTION public.can_view_employee_record(target_employee_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case public.current_app_role()::text
    when 'super_admin' then true
    when 'admin' then true
    when 'it_super_user' then true
    when 'it_user' then true
    when 'manager' then true
    when 'director' then true
    when 'sales_operations_head' then true
    when 'sales_head' then public.employee_is_in_my_hierarchy(target_employee_id)
    when 'zonal_head' then public.employee_is_in_my_hierarchy(target_employee_id)
    when 'asm' then public.employee_is_in_my_hierarchy(target_employee_id)
    when 'sales_manager' then public.employee_is_in_my_hierarchy(target_employee_id)
    when 'relationship_manager' then target_employee_id = public.current_employee_id()
    else false
  end;
$function$
;

-- Extend operational permissions: can_view_employees
CREATE OR REPLACE FUNCTION public.can_view_employees()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_app_role()::text in (
    'super_admin','admin','it_super_user','it_user','manager','director','sales_operations_head',
    'sales_head','zonal_head','asm','sales_manager','relationship_manager'
  );
$function$
;

-- Extend operational permissions: exchange_can_review_listing
CREATE OR REPLACE FUNCTION public.exchange_can_review_listing()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(public.current_app_role()::text in (
    'super_admin',
    'it_super_user','it_user',
    'sales_head',
    'sales_operations_head'
  ), false);
$function$
;

-- Extend operational permissions: exchange_is_staff
CREATE OR REPLACE FUNCTION public.exchange_is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(public.current_app_role()::text in (
    'super_admin','admin','it_super_user','it_user','director','manager','backoffice_executive'
  ), false);
$function$
;

-- Extend operational permissions: is_claim_portal_user
CREATE OR REPLACE FUNCTION public.is_claim_portal_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('manager', 'claim_processor', 'admin', 'super_admin', 'it_super_user','it_user')
      and coalesce(p.is_active, true) = true
  );
$function$
;

-- Extend operational permissions: is_operations_role
CREATE OR REPLACE FUNCTION public.is_operations_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_app_role()::text in (
    'super_admin',
    'admin',
    'it_super_user','it_user',
    'director',
    'sales_head',
    'zonal_head',
    'asm',
    'sales_manager',
    'agent',
    'manager',
    'backoffice_executive',
    'claim_processor',
    'field_executive'
  );
$function$
;

-- Extend operational permissions: onboard_motor_policy
CREATE OR REPLACE FUNCTION public.onboard_motor_policy(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid;
  v_actor_role text;
  v_access text;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_is_service_role boolean := coalesce(
    auth.jwt() ->> 'role',
    current_setting('request.jwt.claim.role', true),
    ''
  ) = 'service_role';
  v_can_transfer boolean := false;
begin
  if not v_is_service_role then
    raise exception 'Policy onboarding is available only through the trusted server workflow.';
  end if;

  begin
    v_actor := nullif(v_payload #>> '{meta,requestedBy}', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'A valid requestedBy profile is required for trusted policy onboarding.';
  end;

  if v_actor is null then
    raise exception 'A requestedBy profile is required for trusted policy onboarding.';
  end if;

  select profile.role::text
    into v_actor_role
  from public.profiles as profile
  where profile.id = v_actor
    and profile.is_active;

  if v_actor_role is null then
    raise exception 'Active portal profile is required for policy onboarding.';
  end if;

  v_access := public._effective_privileged_rpc_access(v_actor, 'create_policies');
  if v_access not in ('edit', 'approve') then
    -- Preserve the supported legacy permission path used by requirePolicyCreator().
    v_access := public._effective_privileged_rpc_access(v_actor, 'view_policies');
  end if;
  if v_access not in ('edit', 'approve') then
    raise exception 'Profile is not authorized to create policies.';
  end if;

  v_can_transfer := v_actor_role in ('manager', 'admin', 'super_admin', 'it_super_user','it_user');

  v_payload := v_payload || jsonb_build_object(
    'meta', coalesce(v_payload -> 'meta', '{}'::jsonb) || jsonb_build_object(
      'requestedBy', v_actor::text,
      'requestedRole', v_actor_role
    )
  );
  v_payload := v_payload || jsonb_build_object(
    'resolution', coalesce(v_payload -> 'resolution', '{}'::jsonb) || jsonb_build_object(
      'canTransferOwnership', v_can_transfer
    )
  );

  return public._onboard_motor_policy_unchecked(v_payload);
end;
$function$
;

-- Extend operational permissions: partner_app_employee_intermediary_scope
CREATE OR REPLACE FUNCTION public.partner_app_employee_intermediary_scope(p_profile_id uuid, p_role text, p_employee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_default_access text := 'none';
  v_effective_access text := 'none';
  v_requested_mode text := 'self';
  v_employee_access text;
  v_employee_scope text;
  v_role_access text;
  v_employee_ids uuid[] := array[]::uuid[];
begin
  if p_profile_id is null or p_employee_id is null or p_role is null then
    return jsonb_build_object(
      'access', 'none',
      'scope_mode', 'none',
      'employee_ids', '[]'::jsonb
    );
  end if;

  if p_role in ('it_super_user','it_user') then
    v_effective_access := 'approve';
    v_requested_mode := 'organization';
  else
    if p_role in (
      'super_admin',
      'admin',
      'manager',
      'director',
      'sales_operations_head',
      'sales_head',
      'zonal_head',
      'asm',
      'sales_manager',
      'relationship_manager'
    ) then
      v_default_access := 'view';
    end if;

    if p_role in (
      'super_admin',
      'admin',
      'manager',
      'director',
      'sales_operations_head',
      'backoffice_executive'
    ) then
      v_requested_mode := 'organization';
    elsif p_role in ('sales_head', 'zonal_head', 'asm', 'sales_manager') then
      v_requested_mode := 'hierarchy';
    else
      v_requested_mode := 'self';
    end if;

    select
      epo.access_level,
      epo.scope_type
    into
      v_employee_access,
      v_employee_scope
    from public.employee_permission_overrides epo
    where epo.profile_id = p_profile_id
      and epo.capability = 'view_intermediaries'
      and (epo.expires_at is null or epo.expires_at > now())
    order by epo.updated_at desc
    limit 1;

    select rpo.access_level
    into v_role_access
    from public.role_permission_overrides rpo
    where rpo.role = p_role
      and rpo.capability = 'view_intermediaries'
    order by rpo.updated_at desc
    limit 1;

    if v_employee_access is not null and v_employee_access <> 'inherit' then
      v_effective_access := v_employee_access;
    elsif v_role_access is not null then
      v_effective_access := v_role_access;
    else
      v_effective_access := v_default_access;
    end if;

    if v_employee_scope is not null and v_employee_scope <> 'inherit' then
      v_requested_mode := case
        when v_employee_scope = 'organization' then 'organization'
        when v_employee_scope = 'hierarchy' then 'hierarchy'
        else 'self'
      end;
    end if;
  end if;

  if v_effective_access = 'none' then
    return jsonb_build_object(
      'access', 'none',
      'scope_mode', 'none',
      'employee_ids', '[]'::jsonb
    );
  end if;

  if not exists (
    select 1
    from public.employees e
    where e.id = p_employee_id
      and e.employment_status = 'active'
  ) then
    return jsonb_build_object(
      'access', 'none',
      'scope_mode', 'none',
      'employee_ids', '[]'::jsonb
    );
  end if;

  if v_requested_mode = 'organization' then
    return jsonb_build_object(
      'access', v_effective_access,
      'scope_mode', 'organization',
      'employee_ids', '[]'::jsonb
    );
  end if;

  if v_requested_mode = 'hierarchy' then
    with recursive employee_tree as (
      select e.id
      from public.employees e
      where e.id = p_employee_id
        and e.employment_status = 'active'

      union

      select child.id
      from public.employees child
      join employee_tree parent on child.reporting_manager_id = parent.id
      where child.employment_status = 'active'
    )
    select coalesce(array_agg(id order by id), array[]::uuid[])
    into v_employee_ids
    from employee_tree;
  else
    v_employee_ids := array[p_employee_id];
  end if;

  return jsonb_build_object(
    'access', v_effective_access,
    'scope_mode', v_requested_mode,
    'employee_ids', to_jsonb(v_employee_ids)
  );
end;
$function$
;

-- Extend operational permissions: resolve_claim_assistance
CREATE OR REPLACE FUNCTION public.resolve_claim_assistance(p_claim_id uuid, p_decision text, p_note text DEFAULT NULL::text)
 RETURNS claims
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_claim public.claims;
  v_role text;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_review_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  v_role := public.current_app_role()::text;
  if v_role not in ('claim_processor','manager','admin','super_admin','it_super_user','it_user') then
    raise exception 'You are not authorised to review claim assistance requests.';
  end if;

  if v_decision not in ('accepted','declined') then
    raise exception 'Decision must be accepted or declined.';
  end if;

  select * into v_claim
  from public.claims
  where id = p_claim_id
  for update;

  if v_claim.id is null then
    raise exception 'Claim not available.';
  end if;

  if v_claim.policy_service_source is distinct from 'external'::public.policy_service_source
     or (v_claim.policy_id is null and v_claim.external_policy_id is null) then
    raise exception 'This is not an external-policy claim.';
  end if;

  if v_claim.assistance_status <> 'requested'::public.claim_assistance_status then
    raise exception 'This claim does not have a pending assistance request.';
  end if;

  if v_claim.current_status::text in ('Settled', 'Closed') then
    raise exception 'This claim is already settled.';
  end if;

  if v_decision = 'accepted' then
    update public.claims
    set assistance_status = 'accepted',
        claim_service_mode = 'broker_managed',
        policy_service_source = 'external',
        assistance_resolved_at = now(),
        assistance_resolved_by = auth.uid(),
        assistance_notes = case
          when v_review_note is null then assistance_notes
          when assistance_notes is null or btrim(assistance_notes) = '' then v_review_note
          else assistance_notes || E'\n\nClaims Desk: ' || v_review_note
        end,
        assigned_to = coalesce(assigned_to, auth.uid()),
        updated_at = now()
    where id = p_claim_id
    returning * into v_claim;
  else
    update public.claims
    set assistance_status = 'declined',
        claim_service_mode = 'self_managed',
        assistance_resolved_at = now(),
        assistance_resolved_by = auth.uid(),
        assistance_notes = case
          when v_review_note is null then assistance_notes
          when assistance_notes is null or btrim(assistance_notes) = '' then v_review_note
          else assistance_notes || E'\n\nClaims Desk: ' || v_review_note
        end,
        updated_at = now()
    where id = p_claim_id
    returning * into v_claim;
  end if;

  return v_claim;
end;
$function$
;

-- Extend operational permissions: resolve_claim_assistance_intake
CREATE OR REPLACE FUNCTION public.resolve_claim_assistance_intake(p_claim_id uuid, p_decision text, p_entry_status claim_status, p_note text, p_resolved_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_claim public.claims%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_now timestamptz := now();
  v_next_status public.claim_status;
  v_event_type text;
  v_event_title text;
  v_initial_document_categories integer;
begin
  if auth.uid() is null or p_resolved_by is distinct from auth.uid() then
    raise exception 'The reviewing user does not match the authenticated user.';
  end if;

  if public.current_app_role()::text not in ('claim_processor', 'manager', 'admin', 'super_admin', 'it_super_user','it_user')
     or not public.can_access_claim(auth.uid(), p_claim_id) then
    raise exception 'You do not have permission to review this assistance request.';
  end if;

  if v_decision not in ('accepted', 'declined') then
    raise exception 'Decision must be accepted or declined.';
  end if;

  if v_note is null or length(v_note) < 10 then
    raise exception 'Enter a review note of at least 10 characters.';
  end if;

  select *
    into v_claim
    from public.claims
   where id = p_claim_id
     and assistance_status = 'requested'
     and claim_service_mode = 'self_managed'
     and policy_service_source = 'external'
     and current_status not in ('Settled', 'Rejected', 'Closed')
   for update;

  if not found then
    raise exception 'This assistance request is no longer available for review.';
  end if;

  if v_decision = 'accepted' then
    if p_entry_status not in (
      'Initial Documents Pending',
      'Initial Documents Verification Pending',
      'Initial Documents Verified'
    ) then
      raise exception 'Select a supported internal intake stage.';
    end if;

    if p_entry_status in ('Initial Documents Verification Pending', 'Initial Documents Verified') then
      select count(distinct category)
        into v_initial_document_categories
        from (
          select case
            when lower(document_type) like any (array['%accident photo%', '%spot photo%', '%spot image%', '%loss photo%', '%vehicle photo%']) then 'accident_photo'
            when lower(document_type) like any (array['%rc copy%', '%registration certificate%']) then 'rc_copy'
            when lower(document_type) like any (array['%insurance copy%', '%policy copy%']) then 'insurance_copy'
            when lower(document_type) like any (array['%driver licence%', '%driving licence%', '%driving license%', '%dl copy%']) then 'driver_licence'
            when lower(document_type) like any (array['%gr / load bill%', '%gr copy / load challan%', '%gr copy / road challan%', '%gr / load challan%', '%road challan%', '%load challan%']) then 'gr_load_bill'
            when lower(document_type) like any (array['%accident video%', '%loss video%', '%vehicle video%']) then 'accident_video'
            else null
          end as category
          from public.claim_documents
          where claim_id = p_claim_id
            and (
              (p_entry_status = 'Initial Documents Verification Pending' and verification_status::text <> 'rejected')
              or (p_entry_status = 'Initial Documents Verified' and verification_status::text = 'verified')
            )
        ) classified
       where category is not null;

      if v_initial_document_categories <> 6 then
        if p_entry_status = 'Initial Documents Verified' then
          raise exception 'All six required initial document categories must be verified before selecting this stage.';
        else
          raise exception 'All six required initial document categories must be uploaded before selecting this stage.';
        end if;
      end if;
    end if;

    v_next_status := p_entry_status;
    v_event_type := 'claim_assistance_accepted';
    v_event_title := 'Claim assistance accepted';

    update public.claims
       set assistance_status = 'accepted',
           claim_service_mode = 'broker_managed',
           policy_service_source = 'external',
           current_status = v_next_status,
           assistance_resolved_at = v_now,
           assistance_resolved_by = p_resolved_by,
           assistance_notes = case
             when assistance_notes is null or trim(assistance_notes) = '' then v_note
             else assistance_notes || E'\n\nClaims Desk: ' || v_note
           end,
           assigned_to = coalesce(assigned_to, p_resolved_by),
           updated_at = v_now
     where id = p_claim_id
       and assistance_status = 'requested'
       and claim_service_mode = 'self_managed';
  else
    if p_entry_status is not null then
      raise exception 'An internal intake stage is not allowed when declining assistance.';
    end if;
    v_next_status := v_claim.current_status;
    v_event_type := 'claim_assistance_declined';
    v_event_title := 'Claim assistance declined';

    update public.claims
       set assistance_status = 'declined',
           claim_service_mode = 'self_managed',
           assistance_resolved_at = v_now,
           assistance_resolved_by = p_resolved_by,
           assistance_notes = case
             when assistance_notes is null or trim(assistance_notes) = '' then v_note
             else assistance_notes || E'\n\nClaims Desk: ' || v_note
           end,
           updated_at = v_now
     where id = p_claim_id
       and assistance_status = 'requested'
       and claim_service_mode = 'self_managed';
  end if;

  if not found then
    raise exception 'The assistance request changed before this decision was saved.';
  end if;

  insert into public.claim_stage_details (claim_id, stage, details, created_by)
  values (
    p_claim_id,
    v_next_status,
    jsonb_build_object(
      'verification_type', 'claim_assistance_intake',
      'decision', v_decision,
      'entry_status', case when v_decision = 'accepted' then v_next_status else null end,
      'review_note', v_note,
      'reviewed_at', v_now,
      'reviewed_by', p_resolved_by
    ),
    p_resolved_by
  );

  insert into public.claim_status_history (claim_id, from_status, to_status, notes, changed_by)
  values (
    p_claim_id,
    v_claim.current_status,
    v_next_status,
    format('Assistance %s after Operations intake review. %s', v_decision, v_note),
    p_resolved_by
  );

  if v_claim.customer_id is not null then
    insert into public.customer_activity_events (
      customer_id, claim_id, event_type, title, message, priority, status, metadata
    )
    values (
      v_claim.customer_id,
      p_claim_id,
      v_event_type,
      v_event_title,
      case
        when v_decision = 'accepted' then 'The claims desk has accepted responsibility for this claim.'
        else 'The claims desk reviewed the assistance request. The claim remains self-managed.'
      end,
      case when v_decision = 'accepted' then 'high' else 'medium' end,
      'new',
      jsonb_build_object(
        'decision', v_decision,
        'entry_status', case when v_decision = 'accepted' then v_next_status else null end,
        'reviewed_at', v_now
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'decision', v_decision,
    'claim_service_mode', case when v_decision = 'accepted' then 'broker_managed' else 'self_managed' end,
    'next_status', v_next_status
  );
end;
$function$
;

-- Extend operational permissions: transfer_vehicle_customer_v1
CREATE OR REPLACE FUNCTION public.transfer_vehicle_customer_v1(p_vehicle_id uuid, p_new_customer_id uuid, p_effective_date date, p_reason text, p_actor_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_vehicle public.vehicles%rowtype;
  v_old_customer_id uuid;
  v_actor_role text;
  v_policy_ids uuid[] := '{}'::uuid[];
  v_external_policy_ids uuid[] := '{}'::uuid[];
  v_claim_ids uuid[] := '{}'::uuid[];
  v_counts jsonb := '{}'::jsonb;
  v_count integer := 0;
begin
  if p_vehicle_id is null or p_new_customer_id is null or p_actor_profile_id is null then
    raise exception 'Vehicle, destination customer and actor are required.';
  end if;

  if p_effective_date is null or p_effective_date > current_date then
    raise exception 'Transfer effective date must be today or earlier.';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null or length(btrim(p_reason)) < 5 then
    raise exception 'Enter a clear transfer reason.';
  end if;

  select role::text into v_actor_role
  from public.profiles
  where id = p_actor_profile_id
    and coalesce(is_active, true) = true;

  if v_actor_role is null then
    raise exception 'Active actor profile not found.';
  end if;

  if v_actor_role not in ('manager','admin','super_admin','it_super_user','it_user') then
    raise exception 'Only a Manager or Administrator can transfer vehicle ownership.';
  end if;

  select * into v_vehicle
  from public.vehicles
  where id = p_vehicle_id
  for update;

  if not found then
    raise exception 'Vehicle not found.';
  end if;

  v_old_customer_id := v_vehicle.customer_id;

  if v_old_customer_id = p_new_customer_id then
    raise exception 'Destination customer is already the current vehicle owner.';
  end if;

  if not public.can_access_customer(p_actor_profile_id, v_old_customer_id)
     or not public.can_access_customer(p_actor_profile_id, p_new_customer_id) then
    raise exception 'You do not have access to both the source and destination customers.';
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.id = p_new_customer_id
      and lower(coalesce(c.status, 'active')) = 'active'
  ) then
    raise exception 'Destination customer is not active or does not exist.';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_policy_ids
  from public.policies
  where vehicle_id = p_vehicle_id;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_external_policy_ids
  from public.external_policies
  where vehicle_id = p_vehicle_id;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_claim_ids
  from public.claims
  where vehicle_id = p_vehicle_id;

  insert into public.vehicle_ownership_history(
    vehicle_id,
    previous_customer_id,
    customer_id,
    effective_from,
    change_reason,
    confirmed_by
  )
  values (
    p_vehicle_id,
    v_old_customer_id,
    p_new_customer_id,
    p_effective_date,
    btrim(p_reason),
    p_actor_profile_id
  );

  update public.policies
  set customer_id = p_new_customer_id,
      updated_at = now()
  where vehicle_id = p_vehicle_id
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('policies', v_count);

  update public.external_policies
  set customer_id = p_new_customer_id,
      updated_at = now()
  where vehicle_id = p_vehicle_id
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('externalPolicies', v_count);

  update public.claims
  set customer_id = p_new_customer_id,
      updated_at = now()
  where vehicle_id = p_vehicle_id
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('claims', v_count);

  update public.claim_documents
  set customer_id = p_new_customer_id,
      updated_at = now()
  where claim_id = any(v_claim_ids)
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('claimDocuments', v_count);

  update public.notifications
  set customer_id = p_new_customer_id,
      updated_at = now()
  where claim_id = any(v_claim_ids)
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('claimNotifications', v_count);

  update public.support_tickets
  set customer_id = p_new_customer_id,
      updated_at = now()
  where claim_id = any(v_claim_ids)
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('supportTickets', v_count);

  update public.customer_activity_events
  set customer_id = p_new_customer_id,
      updated_at = now()
  where (
      vehicle_id = p_vehicle_id
      or policy_id = any(v_policy_ids)
      or claim_id = any(v_claim_ids)
    )
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('customerActivityEvents', v_count);

  update public.customer_documents
  set customer_id = p_new_customer_id,
      updated_at = now()
  where external_policy_id = any(v_external_policy_ids)
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('customerDocuments', v_count);

  update public.intermediary_commission_ledger
  set customer_id = p_new_customer_id,
      updated_at = now()
  where policy_id = any(v_policy_ids)
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('commissionLedger', v_count);

  update public.intermediary_referrals
  set customer_id = p_new_customer_id
  where policy_id = any(v_policy_ids)
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('intermediaryReferrals', v_count);

  update public.service_enquiries
  set customer_id = p_new_customer_id,
      updated_at = now()
  where vehicle_id = p_vehicle_id
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('serviceEnquiries', v_count);

  delete from public.vehicle_customer_links
  where vehicle_id = p_vehicle_id;

  insert into public.vehicle_customer_links(
    vehicle_id,
    customer_id,
    relationship_type,
    is_primary,
    created_by
  )
  values (
    p_vehicle_id,
    p_new_customer_id,
    'primary',
    true,
    p_actor_profile_id
  )
  on conflict (vehicle_id, customer_id) do update
  set relationship_type = 'primary',
      is_primary = true,
      created_by = excluded.created_by;

  update public.vehicles
  set customer_id = p_new_customer_id,
      updated_at = now()
  where id = p_vehicle_id;

  insert into public.audit_logs(
    actor_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  )
  values (
    p_actor_profile_id,
    'vehicle_customer_transferred',
    'vehicles',
    p_vehicle_id,
    jsonb_build_object(
      'customer_id', v_old_customer_id,
      'effective_date', p_effective_date,
      'reason', btrim(p_reason)
    ),
    jsonb_build_object(
      'customer_id', p_new_customer_id,
      'effective_date', p_effective_date,
      'reason', btrim(p_reason),
      'transferred_dependencies', v_counts
    )
  );

  return jsonb_build_object(
    'ok', true,
    'vehicleId', p_vehicle_id,
    'previousCustomerId', v_old_customer_id,
    'customerId', p_new_customer_id,
    'effectiveDate', p_effective_date,
    'transferredDependencies', v_counts
  );
end;
$function$
;

ALTER POLICY "Portal claim users can create customer activity events" ON public."customer_activity_events" WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::app_role, 'claim_processor'::app_role, 'admin'::app_role, 'super_admin'::app_role, 'it_super_user'::app_role, 'it_user'::app_role]))))));
ALTER POLICY "Portal claim users can update customer activity events" ON public."customer_activity_events" USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::app_role, 'claim_processor'::app_role, 'admin'::app_role, 'super_admin'::app_role, 'it_super_user'::app_role, 'it_user'::app_role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::app_role, 'claim_processor'::app_role, 'admin'::app_role, 'super_admin'::app_role, 'it_super_user'::app_role, 'it_user'::app_role]))))));
ALTER POLICY "Portal users can read customer activity events" ON public."customer_activity_events" USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::app_role, 'claim_processor'::app_role, 'field_executive'::app_role, 'admin'::app_role, 'super_admin'::app_role, 'it_super_user'::app_role, 'it_user'::app_role]))))));
ALTER POLICY "customer_contacts_manage_staff" ON public."customer_contacts" USING (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text]))) WITH CHECK (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text])));
ALTER POLICY "Internal users can insert customer documents" ON public."customer_documents" WITH CHECK (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text])));
ALTER POLICY "Internal users can read customer documents" ON public."customer_documents" USING (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text])));
ALTER POLICY "Internal users can update customer documents" ON public."customer_documents" USING (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text]))) WITH CHECK (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text])));
ALTER POLICY "customer_memberships_manage_staff" ON public."customer_memberships" USING (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text]))) WITH CHECK (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text])));
ALTER POLICY "Managers can manage onboarding applications" ON public."customer_onboarding_applications" USING (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text]))) WITH CHECK (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text])));
ALTER POLICY "onboarding_contacts_manage_staff" ON public."customer_onboarding_contacts" USING (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text]))) WITH CHECK (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text])));
ALTER POLICY "Managers can manage onboarding documents" ON public."customer_onboarding_documents" USING (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text]))) WITH CHECK (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text])));
ALTER POLICY "customer_relationships_manage_staff" ON public."customer_relationships" USING (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text]))) WITH CHECK (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text, 'sales_operations_head'::text, 'backoffice_executive'::text])));
ALTER POLICY "Master data managers can insert customers" ON public."customers" WITH CHECK (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text])));
ALTER POLICY "Master data managers can update customers" ON public."customers" USING (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text]))) WITH CHECK (((current_app_role())::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'it_super_user'::text, 'it_user'::text])));
ALTER POLICY "service enquiries customer select own" ON public."service_enquiries" USING (((customer_id IN ( SELECT c.id
   FROM customers c
  WHERE (c.profile_id = auth.uid()))) OR (current_app_role() = ANY (ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'claim_processor'::app_role, 'field_executive'::app_role, 'director'::app_role, 'sales_head'::app_role, 'zonal_head'::app_role, 'asm'::app_role, 'sales_manager'::app_role, 'it_super_user'::app_role, 'it_user'::app_role, 'claims_head'::app_role, 'sales_operations_head'::app_role, 'backoffice_executive'::app_role, 'relationship_manager'::app_role]))));
ALTER POLICY "service enquiries operations update" ON public."service_enquiries" USING ((current_app_role() = ANY (ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'claim_processor'::app_role, 'field_executive'::app_role, 'director'::app_role, 'sales_head'::app_role, 'zonal_head'::app_role, 'asm'::app_role, 'sales_manager'::app_role, 'it_super_user'::app_role, 'it_user'::app_role, 'claims_head'::app_role, 'sales_operations_head'::app_role, 'backoffice_executive'::app_role, 'relationship_manager'::app_role]))) WITH CHECK ((current_app_role() = ANY (ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'claim_processor'::app_role, 'field_executive'::app_role, 'director'::app_role, 'sales_head'::app_role, 'zonal_head'::app_role, 'asm'::app_role, 'sales_manager'::app_role, 'it_super_user'::app_role, 'it_user'::app_role, 'claims_head'::app_role, 'sales_operations_head'::app_role, 'backoffice_executive'::app_role, 'relationship_manager'::app_role])));
ALTER POLICY "service enquiry attachments members select" ON public."service_enquiry_attachments" USING ((enquiry_id IN ( SELECT se.id
   FROM service_enquiries se
  WHERE ((se.customer_id IN ( SELECT c.id
           FROM customers c
          WHERE (c.profile_id = auth.uid()))) OR (current_app_role() = ANY (ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'claim_processor'::app_role, 'field_executive'::app_role, 'director'::app_role, 'sales_head'::app_role, 'zonal_head'::app_role, 'asm'::app_role, 'sales_manager'::app_role, 'it_super_user'::app_role, 'it_user'::app_role, 'claims_head'::app_role, 'sales_operations_head'::app_role, 'backoffice_executive'::app_role, 'relationship_manager'::app_role]))))));
ALTER POLICY "service enquiry messages members create" ON public."service_enquiry_messages" WITH CHECK (((sender_id = auth.uid()) AND (enquiry_id IN ( SELECT se.id
   FROM service_enquiries se
  WHERE ((se.customer_id IN ( SELECT c.id
           FROM customers c
          WHERE (c.profile_id = auth.uid()))) OR (current_app_role() = ANY (ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'claim_processor'::app_role, 'field_executive'::app_role, 'director'::app_role, 'sales_head'::app_role, 'zonal_head'::app_role, 'asm'::app_role, 'sales_manager'::app_role, 'it_super_user'::app_role, 'it_user'::app_role, 'claims_head'::app_role, 'sales_operations_head'::app_role, 'backoffice_executive'::app_role, 'relationship_manager'::app_role])))))));
ALTER POLICY "service enquiry messages members select" ON public."service_enquiry_messages" USING ((enquiry_id IN ( SELECT se.id
   FROM service_enquiries se
  WHERE ((se.customer_id IN ( SELECT c.id
           FROM customers c
          WHERE (c.profile_id = auth.uid()))) OR (current_app_role() = ANY (ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'claim_processor'::app_role, 'field_executive'::app_role, 'director'::app_role, 'sales_head'::app_role, 'zonal_head'::app_role, 'asm'::app_role, 'sales_manager'::app_role, 'it_super_user'::app_role, 'it_user'::app_role, 'claims_head'::app_role, 'sales_operations_head'::app_role, 'backoffice_executive'::app_role, 'relationship_manager'::app_role]))))));
