-- Generalize mobile-associated customer management beyond Group parents.
-- Existing column/RPC names are kept for app compatibility; group_customer_id now
-- represents the active parent customer for associated onboarding applications.

create or replace function public.is_allowed_customer_hierarchy(
  p_parent_type text,
  p_child_type text
)
returns boolean
language sql
immutable
as $$
  select case
    when p_parent_type = 'group'
      then p_child_type in ('corporate', 'individual_proprietor', 'dealership')
    when p_parent_type = 'corporate'
      then p_child_type = 'individual_proprietor'
    when p_parent_type = 'dealership'
      then p_child_type in ('corporate', 'individual_proprietor')
    else false
  end;
$$;

create or replace function public.validate_group_customer_relationship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_type text;
  parent_status text;
  child_type text;
  child_status text;
begin
  if new.relationship_type <> 'group_member' then
    return new;
  end if;

  if new.parent_customer_id = new.child_customer_id then
    raise exception 'A customer account cannot be linked to itself.';
  end if;

  select partner_type::text, onboarding_status
    into parent_type, parent_status
  from public.customers
  where id = new.parent_customer_id;

  select partner_type::text, onboarding_status
    into child_type, child_status
  from public.customers
  where id = new.child_customer_id;

  if not public.is_allowed_customer_hierarchy(parent_type, child_type) then
    raise exception 'This parent and child customer type combination is not allowed.';
  end if;

  if coalesce(parent_status, '') <> 'active' then
    raise exception 'The selected parent customer is not active.';
  end if;

  if coalesce(child_status, '') <> 'active' then
    raise exception 'The selected child customer is not active.';
  end if;

  if exists (
    with recursive ancestors as (
      select relationship.parent_customer_id
      from public.customer_relationships relationship
      where relationship.child_customer_id = new.parent_customer_id
        and relationship.relationship_type = 'group_member'
        and relationship.is_active
        and relationship.status = 'active'
        and relationship.id is distinct from new.id
      union all
      select relationship.parent_customer_id
      from public.customer_relationships relationship
      join ancestors on ancestors.parent_customer_id = relationship.child_customer_id
      where relationship.relationship_type = 'group_member'
        and relationship.is_active
        and relationship.status = 'active'
        and relationship.id is distinct from new.id
    )
    select 1
    from ancestors
    where parent_customer_id = new.child_customer_id
  ) then
    raise exception 'This relationship would create a customer hierarchy cycle.';
  end if;

  new.is_active := new.status = 'active';
  new.updated_at := now();

  if new.status = 'active' then
    new.effective_to := null;
    new.effective_from := coalesce(new.effective_from, now());
  elsif new.effective_to is null then
    new.effective_to := now();
  end if;

  return new;
end;
$$;

create or replace function public.can_manage_group_associated_onboarding(
  p_group_customer_id uuid,
  p_profile_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customers customer
    where customer.id = p_group_customer_id
      and customer.partner_type in ('group', 'corporate', 'dealership')
      and customer.onboarding_status = 'active'
      and customer.profile_id = p_profile_id
  ) or exists (
    select 1
    from public.customer_memberships membership
    join public.customers customer on customer.id = membership.customer_id
    where membership.customer_id = p_group_customer_id
      and customer.partner_type in ('group', 'corporate', 'dealership')
      and customer.onboarding_status = 'active'
      and membership.profile_id = p_profile_id
      and membership.status = 'active'
      and coalesce(membership.membership_role, '') in (
        'owner',
        'admin',
        'manager',
        'group_owner',
        'group_admin',
        'corporate_creator',
        'ceo_head',
        'admin_head',
        'dedicated_spoc',
        'dealership_owner'
      )
  );
$$;

create or replace function public.can_manage_customer_associated_onboarding(
  p_parent_customer_id uuid,
  p_profile_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.can_manage_group_associated_onboarding(p_parent_customer_id, p_profile_id);
$$;

grant execute on function public.can_manage_group_associated_onboarding(uuid, uuid) to authenticated;
grant execute on function public.can_manage_customer_associated_onboarding(uuid, uuid) to authenticated;

create or replace function public.can_access_customer(target_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive managed_customers as (
    select membership.customer_id
    from public.customer_memberships membership
    where membership.profile_id = auth.uid()
      and membership.status = 'active'
    union
    select relationship.child_customer_id
    from public.customer_relationships relationship
    join managed_customers parent_access
      on parent_access.customer_id = relationship.parent_customer_id
    where relationship.relationship_type = 'group_member'
      and relationship.is_active
      and relationship.status = 'active'
  )
  select exists (
    select 1
    from managed_customers
    where customer_id = target_customer_id
  );
$$;

grant execute on function public.can_access_customer(uuid) to authenticated;

create or replace function public.get_accessible_customer_contexts()
returns table (
  customer_id uuid,
  customer_code text,
  partner_type text,
  company_name text,
  contact_name text,
  membership_id uuid,
  membership_role text,
  access_source text,
  group_customer_id uuid,
  group_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive direct_accounts as (
    select
      customer.id as customer_id,
      customer.customer_code,
      customer.partner_type::text as partner_type,
      customer.company_name,
      customer.contact_name,
      membership.id as membership_id,
      membership.membership_role,
      'direct'::text as access_source,
      parent_relationship.parent_customer_id as group_customer_id,
      parent_customer.company_name as group_name
    from public.customer_memberships membership
    join public.customers customer
      on customer.id = membership.customer_id
    left join public.customer_relationships parent_relationship
      on parent_relationship.child_customer_id = customer.id
     and parent_relationship.relationship_type = 'group_member'
     and parent_relationship.is_active
     and parent_relationship.status = 'active'
    left join public.customers parent_customer
      on parent_customer.id = parent_relationship.parent_customer_id
    where membership.profile_id = auth.uid()
      and membership.status = 'active'
  ),
  managed_children as (
    select
      child.id as customer_id,
      child.customer_code,
      child.partner_type::text as partner_type,
      child.company_name,
      child.contact_name,
      direct_accounts.membership_id,
      direct_accounts.membership_role,
      'group_child'::text as access_source,
      parent.id as group_customer_id,
      parent.company_name as group_name
    from direct_accounts
    join public.customers parent
      on parent.id = direct_accounts.customer_id
    join public.customer_relationships relationship
      on relationship.parent_customer_id = parent.id
     and relationship.relationship_type = 'group_member'
     and relationship.is_active
     and relationship.status = 'active'
    join public.customers child
      on child.id = relationship.child_customer_id
    where parent.partner_type::text in ('group', 'corporate', 'dealership')
    union all
    select
      child.id as customer_id,
      child.customer_code,
      child.partner_type::text as partner_type,
      child.company_name,
      child.contact_name,
      managed_children.membership_id,
      managed_children.membership_role,
      'group_child'::text as access_source,
      parent.id as group_customer_id,
      parent.company_name as group_name
    from managed_children
    join public.customers parent
      on parent.id = managed_children.customer_id
    join public.customer_relationships relationship
      on relationship.parent_customer_id = parent.id
     and relationship.relationship_type = 'group_member'
     and relationship.is_active
     and relationship.status = 'active'
    join public.customers child
      on child.id = relationship.child_customer_id
  ),
  combined_contexts as (
    select * from direct_accounts
    union all
    select child.*
    from managed_children child
    where not exists (
      select 1
      from direct_accounts direct
      where direct.customer_id = child.customer_id
    )
  )
  select distinct on (combined_contexts.customer_id)
    combined_contexts.customer_id,
    combined_contexts.customer_code,
    combined_contexts.partner_type,
    combined_contexts.company_name,
    combined_contexts.contact_name,
    combined_contexts.membership_id,
    combined_contexts.membership_role,
    combined_contexts.access_source,
    combined_contexts.group_customer_id,
    combined_contexts.group_name
  from combined_contexts
  order by
    combined_contexts.customer_id,
    case
      when combined_contexts.access_source = 'direct' and combined_contexts.partner_type = 'group' then 0
      when combined_contexts.access_source = 'direct' and combined_contexts.partner_type in ('corporate', 'dealership') then 1
      when combined_contexts.access_source = 'direct' then 2
      else 3
    end,
    combined_contexts.company_name nulls last,
    combined_contexts.contact_name;
$$;

revoke all on function public.get_accessible_customer_contexts() from public;
grant execute on function public.get_accessible_customer_contexts() to authenticated;

create or replace function public.start_group_associated_onboarding_application(
  p_group_customer_id uuid,
  p_partner_type text,
  p_current_step integer,
  p_applicant_phone text,
  p_applicant_email text,
  p_draft_data jsonb
)
returns public.customer_onboarding_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_parent_type text;
  v_application public.customer_onboarding_applications;
  v_draft jsonb := coalesce(p_draft_data, '{}'::jsonb);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select partner_type::text
    into v_parent_type
  from public.customers
  where id = p_group_customer_id
    and onboarding_status = 'active';

  if not public.is_allowed_customer_hierarchy(v_parent_type, p_partner_type) then
    raise exception 'This parent account cannot add the selected customer type.';
  end if;

  if not public.can_manage_group_associated_onboarding(p_group_customer_id, v_user_id) then
    raise exception 'You do not have permission to add customers to this account';
  end if;

  v_draft := jsonb_set(v_draft, '{group_customer_id}', to_jsonb(p_group_customer_id::text), true);
  v_draft := jsonb_set(v_draft, '{parent_customer_id}', to_jsonb(p_group_customer_id::text), true);
  v_draft := jsonb_set(v_draft, '{parent_partner_type}', to_jsonb(v_parent_type), true);
  v_draft := jsonb_set(v_draft, '{initiated_from}', '"customer_mobile_hierarchy"'::jsonb, true);

  insert into public.customer_onboarding_applications (
    profile_id,
    initiated_by,
    source,
    partner_type,
    status,
    current_step,
    applicant_phone,
    applicant_email,
    group_customer_id,
    draft_data
  ) values (
    v_user_id,
    v_user_id,
    'customer_app',
    p_partner_type,
    'in_progress',
    least(greatest(coalesce(p_current_step, 1), 1), 4),
    nullif(btrim(coalesce(p_applicant_phone, '')), ''),
    nullif(lower(btrim(coalesce(p_applicant_email, ''))), ''),
    p_group_customer_id,
    v_draft
  )
  returning * into v_application;

  return v_application;
end;
$$;

grant execute on function public.start_group_associated_onboarding_application(uuid, text, integer, text, text, jsonb) to authenticated;

create or replace function public.submit_group_associated_onboarding_application(
  p_application_id uuid,
  p_draft_data jsonb
)
returns public.customer_onboarding_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_application public.customer_onboarding_applications;
  v_parent_type text;
  v_draft jsonb := coalesce(p_draft_data, '{}'::jsonb);
  v_role text;
  v_name text;
  v_phone text;
  v_seen_phones text[] := array[]::text[];
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_application
  from public.customer_onboarding_applications
  where id = p_application_id
  for update;

  if v_application.id is null then
    raise exception 'Onboarding application not found';
  end if;

  if v_application.profile_id is distinct from v_user_id
     or v_application.initiated_by is distinct from v_user_id then
    raise exception 'You cannot submit this onboarding application';
  end if;

  if v_application.group_customer_id is null then
    raise exception 'Parent account is required';
  end if;

  select partner_type::text
    into v_parent_type
  from public.customers
  where id = v_application.group_customer_id
    and onboarding_status = 'active';

  if not public.is_allowed_customer_hierarchy(v_parent_type, v_application.partner_type::text) then
    raise exception 'This parent account cannot add the selected customer type.';
  end if;

  if not public.can_manage_group_associated_onboarding(v_application.group_customer_id, v_user_id) then
    raise exception 'You do not have permission to add customers to this account';
  end if;

  if v_application.partner_type = 'corporate' then
    foreach v_role in array array['corporate_creator','ceo_head','admin_head','dedicated_spoc'] loop
      v_name := nullif(btrim(v_draft->>(v_role || '_name')), '');
      v_phone := regexp_replace(coalesce(v_draft->>(v_role || '_mobile'), ''), '\D', '', 'g');

      if length(v_phone) = 10 then
        v_phone := '+91' || v_phone;
      elsif length(v_phone) = 12 and left(v_phone, 2) = '91' then
        v_phone := '+' || v_phone;
      end if;

      if v_name is null or v_phone !~ '^\+91[0-9]{10}$' then
        raise exception 'Enter valid names and 10-digit mobile numbers for all four Corporate login contacts.';
      end if;

      if v_phone = any(v_seen_phones) then
        raise exception 'Each Corporate login contact must use a different mobile number.';
      end if;

      v_seen_phones := array_append(v_seen_phones, v_phone);
    end loop;
  end if;

  v_draft := jsonb_set(v_draft, '{group_customer_id}', to_jsonb(v_application.group_customer_id::text), true);
  v_draft := jsonb_set(v_draft, '{parent_customer_id}', to_jsonb(v_application.group_customer_id::text), true);
  v_draft := jsonb_set(v_draft, '{parent_partner_type}', to_jsonb(v_parent_type), true);

  update public.customer_onboarding_applications
  set draft_data = v_draft,
      status = 'submitted',
      current_step = 4,
      submitted_at = now(),
      updated_at = now()
  where id = p_application_id
  returning * into v_application;

  return v_application;
end;
$$;

grant execute on function public.submit_group_associated_onboarding_application(uuid, jsonb) to authenticated;

create or replace function public.link_approved_associated_customer_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'approved'
     or new.group_customer_id is null
     or new.customer_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.customers parent
    join public.customers child on child.id = new.customer_id
    where parent.id = new.group_customer_id
      and parent.onboarding_status = 'active'
      and child.onboarding_status = 'active'
      and public.is_allowed_customer_hierarchy(parent.partner_type::text, child.partner_type::text)
  ) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.customer_id::text, 0));

  update public.customer_relationships
  set
    status = 'ended',
    is_active = false,
    effective_to = coalesce(effective_to, now()),
    updated_at = now()
  where child_customer_id = new.customer_id
    and relationship_type = 'group_member'
    and is_active
    and status = 'active'
    and parent_customer_id is distinct from new.group_customer_id;

  insert into public.customer_relationships (
    parent_customer_id,
    child_customer_id,
    relationship_type,
    is_active,
    status,
    effective_from,
    effective_to,
    created_by,
    approved_by,
    updated_at
  )
  values (
    new.group_customer_id,
    new.customer_id,
    'group_member',
    true,
    'active',
    coalesce(new.completed_at, new.reviewed_at, new.updated_at, now()),
    null,
    new.initiated_by,
    new.reviewed_by,
    now()
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists link_approved_associated_customer_application_trigger
  on public.customer_onboarding_applications;

create trigger link_approved_associated_customer_application_trigger
after insert or update of status, customer_id, group_customer_id
on public.customer_onboarding_applications
for each row
execute function public.link_approved_associated_customer_application();

insert into public.customer_relationships (
  parent_customer_id,
  child_customer_id,
  relationship_type,
  is_active,
  status,
  effective_from,
  effective_to,
  created_by,
  approved_by,
  updated_at
)
select
  application.group_customer_id,
  application.customer_id,
  'group_member',
  true,
  'active',
  coalesce(application.completed_at, application.reviewed_at, application.updated_at, now()),
  null,
  application.initiated_by,
  application.reviewed_by,
  now()
from public.customer_onboarding_applications application
join public.customers parent_customer
  on parent_customer.id = application.group_customer_id
 and parent_customer.onboarding_status = 'active'
join public.customers child_customer
  on child_customer.id = application.customer_id
 and child_customer.onboarding_status = 'active'
where application.status = 'approved'
  and application.group_customer_id is not null
  and application.customer_id is not null
  and public.is_allowed_customer_hierarchy(parent_customer.partner_type::text, child_customer.partner_type::text)
  and not exists (
    select 1
    from public.customer_relationships relationship
    where relationship.child_customer_id = application.customer_id
      and relationship.parent_customer_id = application.group_customer_id
      and relationship.relationship_type = 'group_member'
      and relationship.is_active
      and relationship.status = 'active'
)
on conflict do nothing;

create or replace function public.get_group_child_account_overview(
  p_group_customer_id uuid
)
returns table (
  row_id text,
  customer_id uuid,
  application_id uuid,
  customer_code text,
  partner_type text,
  company_name text,
  contact_name text,
  phone text,
  city text,
  state text,
  onboarding_status text,
  application_status text,
  account_source text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select public.can_manage_group_associated_onboarding(p_group_customer_id, auth.uid()) as allowed
  ),
  linked_customers as (
    select
      ('customer:' || child.id::text) as row_id,
      child.id as customer_id,
      application.id as application_id,
      child.customer_code,
      child.partner_type::text as partner_type,
      child.company_name,
      child.contact_name,
      child.phone,
      child.city,
      child.state,
      child.onboarding_status,
      coalesce(application.status::text, 'approved') as application_status,
      'linked_customer'::text as account_source,
      child.created_at,
      child.updated_at
    from authorized
    join public.customer_relationships relationship
      on authorized.allowed
     and relationship.parent_customer_id = p_group_customer_id
     and relationship.relationship_type = 'group_member'
     and relationship.is_active
     and relationship.status = 'active'
    join public.customers parent
      on parent.id = relationship.parent_customer_id
    join public.customers child
      on child.id = relationship.child_customer_id
     and public.is_allowed_customer_hierarchy(parent.partner_type::text, child.partner_type::text)
    left join public.customer_onboarding_applications application
      on application.customer_id = child.id
     and application.group_customer_id = p_group_customer_id
  ),
  onboarding_applications as (
    select
      ('application:' || application.id::text) as row_id,
      application.customer_id,
      application.id as application_id,
      null::text as customer_code,
      application.partner_type::text as partner_type,
      coalesce(
        application.draft_data->>'company_name',
        application.draft_data->>'dealership_name',
        application.draft_data->>'legal_trade_name',
        application.draft_data->>'contact_name',
        'Pending customer'
      ) as company_name,
      coalesce(
        application.draft_data->>'dedicated_spoc_name',
        application.draft_data->>'corporate_creator_name',
        application.draft_data->>'owner_name',
        application.draft_data->>'contact_name',
        application.draft_data->>'representative_name',
        'Pending contact'
      ) as contact_name,
      application.applicant_phone as phone,
      application.draft_data->>'city' as city,
      application.draft_data->>'state' as state,
      application.status::text as onboarding_status,
      application.status::text as application_status,
      'onboarding_application'::text as account_source,
      application.created_at,
      application.updated_at
    from authorized
    join public.customer_onboarding_applications application
      on authorized.allowed
     and application.group_customer_id = p_group_customer_id
     and application.status not in ('approved', 'cancelled')
    join public.customers parent
      on parent.id = application.group_customer_id
     and public.is_allowed_customer_hierarchy(parent.partner_type::text, application.partner_type::text)
  )
  select *
  from (
    select * from linked_customers
    union all
    select application.*
    from onboarding_applications application
    where not exists (
      select 1
      from linked_customers linked
      where linked.application_id = application.application_id
         or linked.customer_id = application.customer_id
    )
  ) overview_rows
  order by
    case when account_source = 'linked_customer' then 0 else 1 end,
    updated_at desc nulls last,
    created_at desc nulls last;
$$;

revoke all on function public.get_group_child_account_overview(uuid) from public;
grant execute on function public.get_group_child_account_overview(uuid) to authenticated;

create or replace function public.get_group_associated_account_detail(
  p_group_customer_id uuid,
  p_customer_id uuid default null,
  p_application_id uuid default null
)
returns table (
  account_source text,
  customer_id uuid,
  application_id uuid,
  partner_type text,
  account_title text,
  onboarding_status text,
  application_status text,
  details jsonb,
  contacts jsonb,
  documents jsonb,
  vehicle_count bigint,
  active_policy_count bigint,
  open_claim_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select public.can_manage_group_associated_onboarding(p_group_customer_id, auth.uid()) as allowed
  ),
  matched_application as (
    select application.*
    from authorized
    join public.customer_onboarding_applications application
      on authorized.allowed
     and application.group_customer_id = p_group_customer_id
     and (
       (p_application_id is not null and application.id = p_application_id)
       or (p_customer_id is not null and application.customer_id = p_customer_id)
     )
    join public.customers parent
      on parent.id = application.group_customer_id
     and public.is_allowed_customer_hierarchy(parent.partner_type::text, application.partner_type::text)
    order by application.updated_at desc nulls last, application.created_at desc
    limit 1
  ),
  matched_customer as (
    select child.*
    from authorized
    join public.customer_relationships relationship
      on authorized.allowed
     and relationship.parent_customer_id = p_group_customer_id
     and relationship.relationship_type = 'group_member'
     and relationship.is_active
     and relationship.status = 'active'
    join public.customers parent
      on parent.id = relationship.parent_customer_id
    join public.customers child
      on child.id = relationship.child_customer_id
     and public.is_allowed_customer_hierarchy(parent.partner_type::text, child.partner_type::text)
    where p_customer_id is not null
      and child.id = p_customer_id
    limit 1
  )
  select
    case when customer.id is not null then 'linked_customer' else 'onboarding_application' end as account_source,
    customer.id as customer_id,
    application.id as application_id,
    coalesce(customer.partner_type::text, application.partner_type::text) as partner_type,
    coalesce(
      customer.company_name,
      customer.contact_name,
      application.draft_data->>'company_name',
      application.draft_data->>'dealership_name',
      application.draft_data->>'legal_trade_name',
      application.draft_data->>'contact_name',
      'Associated customer'
    ) as account_title,
    coalesce(customer.onboarding_status, application.status::text) as onboarding_status,
    application.status::text as application_status,
    jsonb_strip_nulls(jsonb_build_object(
      'customer_code', customer.customer_code,
      'company_name', coalesce(customer.company_name, application.draft_data->>'company_name', application.draft_data->>'dealership_name', application.draft_data->>'legal_trade_name'),
      'contact_name', coalesce(customer.contact_name, application.draft_data->>'contact_name', application.draft_data->>'corporate_creator_name', application.draft_data->>'dedicated_spoc_name'),
      'phone', coalesce(customer.phone, application.applicant_phone),
      'email', coalesce(customer.email, application.applicant_email),
      'address', coalesce(customer.address, application.draft_data->>'address_street'),
      'address_locality', application.draft_data->>'address_locality',
      'city', coalesce(customer.city, application.draft_data->>'city'),
      'state', coalesce(customer.state, application.draft_data->>'state'),
      'postal_code', coalesce(customer.postal_code, application.draft_data->>'postal_code'),
      'company_pan', application.draft_data->>'company_pan',
      'gst_number', application.draft_data->>'gst_number',
      'fleet_size_band', application.draft_data->>'fleet_size_band',
      'parent_customer_id', p_group_customer_id,
      'parent_partner_type', application.draft_data->>'parent_partner_type',
      'review_notes', application.draft_data->>'review_notes'
    )) as details,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'role', contact.contact_role,
          'name', contact.full_name,
          'phone', contact.phone,
          'email', contact.email,
          'status', contact.membership_status
        ) order by contact.contact_role)
        from public.customer_onboarding_contacts contact
        where application.id is not null
          and contact.application_id = application.id
      ),
      jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'role', 'primary_contact',
        'name', customer.contact_name,
        'phone', customer.phone,
        'email', customer.email,
        'status', customer.onboarding_status
      )))
    ) as contacts,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'type', document.document_type,
          'file_name', document.file_name,
          'status', document.verification_status,
          'created_at', document.created_at
        ) order by document.created_at desc)
        from public.customer_onboarding_documents document
        where application.id is not null
          and document.application_id = application.id
      ),
      '[]'::jsonb
    ) as documents,
    (
      select count(*)
      from public.vehicles vehicle
      where customer.id is not null
        and vehicle.customer_id = customer.id
    ) as vehicle_count,
    (
      select count(*)
      from public.policies policy
      where customer.id is not null
        and policy.customer_id = customer.id
        and policy.end_date >= current_date
    ) as active_policy_count,
    (
      select count(*)
      from public.claims claim
      where customer.id is not null
        and claim.customer_id = customer.id
        and claim.current_status::text not in ('Closed', 'Settled', 'Rejected', 'Claim Complete')
    ) as open_claim_count,
    coalesce(customer.created_at, application.created_at) as created_at,
    coalesce(customer.updated_at, application.updated_at) as updated_at
  from matched_application application
  full join matched_customer customer
    on customer.id = application.customer_id
  where application.id is not null
     or customer.id is not null;
$$;

revoke all on function public.get_group_associated_account_detail(uuid, uuid, uuid) from public;
grant execute on function public.get_group_associated_account_detail(uuid, uuid, uuid) to authenticated;
