begin;

-- Customer App sign-up is now the customer-master creation boundary.
-- KYC remains optional for vehicle access. Standalone Customer App KYC submissions
-- enrich and complete the same customer record automatically; no Operations review
-- or verification action is required.

create or replace function public.generate_customer_signup_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := 'CUST-' || lpad((100000000 + floor(random() * 900000000))::bigint::text, 9, '0');
    exit when not exists (
      select 1 from public.customers where customer_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

revoke all on function public.generate_customer_signup_code() from public;

create or replace function public.ensure_customer_signup_profile(
  p_full_name text,
  p_phone text,
  p_email text default null::text
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result public.profiles;
  v_can_reactivate boolean := false;
  v_customer public.customers;
  v_created_customer boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (select 1 from auth.users where id = auth.uid()) then
    raise exception 'Authenticated user was not found.';
  end if;

  select * into result
  from public.profiles
  where id = auth.uid();

  if result.id is null then
    insert into public.profiles (id, role, full_name, phone, email, is_active)
    values (
      auth.uid(),
      'customer',
      coalesce(nullif(trim(p_full_name), ''), 'New user'),
      nullif(trim(p_phone), ''),
      nullif(trim(p_email), ''),
      true
    )
    returning * into result;
  elsif result.role <> 'customer' then
    return result;
  else
    if result.is_active = false then
      select (
        not exists (
          select 1 from public.customers where profile_id = auth.uid()
        )
        and not exists (
          select 1
          from public.customer_memberships cm
          join public.customers c on c.id = cm.customer_id
          where cm.profile_id = auth.uid()
            and cm.status = 'active'
        )
        and exists (
          select 1
          from public.audit_logs al
          where al.action = 'delete_customer'
            and al.old_data ->> 'profile_id' = auth.uid()::text
            and coalesce((al.old_data ->> 'customer_access_revoked')::boolean, false) = true
            and coalesce((al.old_data ->> 'signup_reactivation_allowed')::boolean, false) = true
        )
      ) into v_can_reactivate;

      if not v_can_reactivate then
        raise exception 'This customer account is inactive and cannot be reactivated automatically.';
      end if;
    end if;

    update public.profiles
    set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
        phone = coalesce(nullif(trim(p_phone), ''), phone),
        email = coalesce(nullif(trim(p_email), ''), email),
        is_active = case when is_active then true else v_can_reactivate end
    where id = auth.uid()
      and role = 'customer'
    returning * into result;

    if v_can_reactivate then
      insert into public.audit_logs (
        actor_id, action, table_name, record_id, old_data
      ) values (
        auth.uid(),
        'reactivate_customer_signup',
        'profiles',
        auth.uid(),
        jsonb_build_object(
          'reactivation_source', 'mobile_signup',
          'previous_is_active', false,
          'new_is_active', true
        )
      );
    end if;
  end if;

  -- Prefer an existing direct customer before an active membership. This keeps
  -- repeated sign-up/login idempotent and prevents duplicate customer masters.
  select c.* into v_customer
  from public.customers c
  where c.profile_id = auth.uid()
  order by c.updated_at desc
  limit 1;

  if v_customer.id is null then
    select c.* into v_customer
    from public.customer_memberships cm
    join public.customers c on c.id = cm.customer_id
    where cm.profile_id = auth.uid()
      and cm.status = 'active'
    order by cm.is_primary desc, cm.updated_at desc
    limit 1;
  end if;

  if v_customer.id is null then
    insert into public.customers (
      profile_id,
      customer_code,
      contact_name,
      phone,
      email,
      onboarding_status,
      creation_channel,
      created_by,
      updated_by
    ) values (
      auth.uid(),
      public.generate_customer_signup_code(),
      coalesce(nullif(trim(p_full_name), ''), 'New user'),
      coalesce(nullif(trim(p_phone), ''), ''),
      nullif(trim(p_email), ''),
      'active',
      'direct_customer_onboarding',
      auth.uid(),
      auth.uid()
    )
    returning * into v_customer;
    v_created_customer := true;

    insert into public.customer_memberships (
      customer_id,
      profile_id,
      invited_phone,
      invited_email,
      membership_role,
      is_primary,
      status,
      created_by
    ) values (
      v_customer.id,
      auth.uid(),
      nullif(trim(p_phone), ''),
      nullif(trim(p_email), ''),
      'owner',
      true,
      'active',
      auth.uid()
    )
    on conflict (customer_id, profile_id) do update
    set invited_phone = coalesce(excluded.invited_phone, public.customer_memberships.invited_phone),
        invited_email = coalesce(excluded.invited_email, public.customer_memberships.invited_email),
        membership_role = 'owner',
        is_primary = true,
        status = 'active',
        updated_at = now();
  elsif v_customer.profile_id = auth.uid() then
    update public.customers
    set contact_name = coalesce(nullif(trim(p_full_name), ''), contact_name),
        phone = coalesce(nullif(trim(p_phone), ''), phone),
        email = coalesce(nullif(trim(p_email), ''), email),
        updated_by = auth.uid(),
        updated_at = now()
    where id = v_customer.id;

    insert into public.customer_memberships (
      customer_id,
      profile_id,
      invited_phone,
      invited_email,
      membership_role,
      is_primary,
      status,
      created_by
    ) values (
      v_customer.id,
      auth.uid(),
      nullif(trim(p_phone), ''),
      nullif(trim(p_email), ''),
      case v_customer.partner_type
        when 'group' then 'group_owner'
        when 'dealership' then 'dealership_owner'
        when 'corporate' then 'corporate_creator'
        else 'owner'
      end,
      true,
      'active',
      auth.uid()
    )
    on conflict (customer_id, profile_id) do update
    set invited_phone = coalesce(excluded.invited_phone, public.customer_memberships.invited_phone),
        invited_email = coalesce(excluded.invited_email, public.customer_memberships.invited_email),
        status = 'active',
        updated_at = now();
  end if;

  -- A fresh direct signup still gets a resumable KYC shell, but the customer
  -- master already exists and remains fully usable before KYC is submitted.
  if v_created_customer
     and not exists (
       select 1
       from public.customer_onboarding_applications coa
       where coa.profile_id = auth.uid()
         and coa.status not in ('approved', 'rejected', 'cancelled')
     ) then
    insert into public.customer_onboarding_applications (
      profile_id,
      initiated_by,
      source,
      partner_type,
      status,
      current_step,
      applicant_phone,
      applicant_email
    ) values (
      auth.uid(),
      auth.uid(),
      'customer_app',
      null,
      'not_started',
      1,
      nullif(trim(p_phone), ''),
      nullif(trim(p_email), '')
    );
  end if;

  return result;
end;
$$;

revoke all on function public.ensure_customer_signup_profile(text, text, text) from public;
grant execute on function public.ensure_customer_signup_profile(text, text, text) to authenticated;

create or replace function public.finalize_standalone_customer_app_kyc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers;
  v_draft jsonb := coalesce(new.draft_data, '{}'::jsonb);
  v_role text;
  v_profile_name text;
  v_owner_phone text;
  v_contact record;
begin
  if new.source <> 'customer_app'
     or new.status <> 'submitted'
     or new.profile_id is null
     or new.group_customer_id is not null then
    return new;
  end if;

  select c.* into v_customer
  from public.customers c
  where c.profile_id = new.profile_id
  order by c.updated_at desc
  limit 1;

  if v_customer.id is null then
    select c.* into v_customer
    from public.customer_memberships cm
    join public.customers c on c.id = cm.customer_id
    where cm.profile_id = new.profile_id
      and cm.status = 'active'
    order by cm.is_primary desc, cm.updated_at desc
    limit 1;
  end if;

  if v_customer.id is null then
    raise exception 'Customer master is missing for this signed-up user. Please sign in again.';
  end if;

  select full_name into v_profile_name
  from public.profiles
  where id = new.profile_id;

  if new.partner_type = 'individual_proprietor' then
    update public.customers
    set partner_type = 'individual_proprietor',
        contact_name = coalesce(nullif(v_draft->>'contact_name', ''), contact_name),
        company_name = coalesce(nullif(v_draft->>'legal_trade_name', ''), company_name),
        email = coalesce(nullif(v_draft->>'email', ''), email),
        address_street = nullif(v_draft->>'address_street', ''),
        address_locality = nullif(v_draft->>'address_locality', ''),
        india_location_id = nullif(v_draft->>'india_location_id', '')::uuid,
        city = nullif(v_draft->>'city', ''),
        state = nullif(v_draft->>'state', ''),
        postal_code = nullif(v_draft->>'postal_code', ''),
        address = concat_ws(', ',
          nullif(v_draft->>'address_street', ''),
          nullif(v_draft->>'address_locality', ''),
          nullif(v_draft->>'city', ''),
          nullif(v_draft->>'state', ''),
          nullif(v_draft->>'postal_code', '')
        ),
        pan_number = nullif(v_draft->>'pan_number', ''),
        aadhaar_last_four = nullif(v_draft->>'aadhaar_last_four', ''),
        aadhaar_hash = nullif(v_draft->>'aadhaar_hash', ''),
        legal_trade_name = nullif(v_draft->>'legal_trade_name', ''),
        is_gst_registered = coalesce((v_draft->>'is_gst_registered')::boolean, false),
        gst_number = nullif(v_draft->>'gst_number', ''),
        fleet_size_band = nullif(v_draft->>'fleet_size_band', ''),
        onboarding_status = 'active',
        onboarding_completed_at = now(),
        updated_by = new.profile_id,
        updated_at = now()
    where id = v_customer.id;
    v_role := 'owner';

  elsif new.partner_type = 'group' then
    update public.customers
    set partner_type = 'group',
        contact_name = coalesce(nullif(v_draft->>'owner_name', ''), contact_name),
        company_name = coalesce(nullif(v_draft->>'group_name', ''), company_name),
        email = coalesce(nullif(v_draft->>'email', ''), email),
        onboarding_status = 'active',
        onboarding_completed_at = now(),
        updated_by = new.profile_id,
        updated_at = now()
    where id = v_customer.id;

    insert into public.group_profiles (
      customer_id, group_name, owner_name, company_name, updated_at
    ) values (
      v_customer.id,
      coalesce(nullif(v_draft->>'group_name', ''), v_customer.company_name, 'Group'),
      coalesce(nullif(v_draft->>'owner_name', ''), v_customer.contact_name, v_profile_name, 'Owner'),
      coalesce(nullif(v_draft->>'group_name', ''), v_customer.company_name, 'Group'),
      now()
    )
    on conflict (customer_id) do update
    set group_name = excluded.group_name,
        owner_name = excluded.owner_name,
        company_name = excluded.company_name,
        updated_at = now();
    v_role := 'group_owner';

  elsif new.partner_type = 'dealership' then
    v_owner_phone := coalesce(nullif(v_draft->>'phone', ''), v_customer.phone);
    update public.customers
    set partner_type = 'dealership',
        contact_name = coalesce(nullif(v_draft->>'owner_name', ''), contact_name),
        company_name = coalesce(nullif(v_draft->>'dealership_name', ''), company_name),
        legal_trade_name = coalesce(nullif(v_draft->>'dealership_name', ''), legal_trade_name),
        phone = coalesce(v_owner_phone, phone),
        email = coalesce(nullif(v_draft->>'email', ''), email),
        address_street = nullif(v_draft->>'address_street', ''),
        address_locality = nullif(v_draft->>'address_locality', ''),
        india_location_id = nullif(v_draft->>'india_location_id', '')::uuid,
        city = nullif(v_draft->>'city', ''),
        state = nullif(v_draft->>'state', ''),
        postal_code = nullif(v_draft->>'postal_code', ''),
        address = concat_ws(', ',
          nullif(v_draft->>'address_street', ''),
          nullif(v_draft->>'address_locality', ''),
          nullif(v_draft->>'city', ''),
          nullif(v_draft->>'state', ''),
          nullif(v_draft->>'postal_code', '')
        ),
        is_gst_registered = coalesce((v_draft->>'is_gst_registered')::boolean, false),
        gst_number = nullif(v_draft->>'gst_number', ''),
        onboarding_status = 'active',
        onboarding_completed_at = now(),
        updated_by = new.profile_id,
        updated_at = now()
    where id = v_customer.id;

    insert into public.dealership_profiles (
      customer_id, dealership_type, dealership_name, owner_name, oem_name, yearly_sales_band, updated_at
    ) values (
      v_customer.id,
      v_draft->>'dealership_type',
      v_draft->>'dealership_name',
      v_draft->>'owner_name',
      nullif(v_draft->>'oem_name', ''),
      nullif(v_draft->>'yearly_sales_band', ''),
      now()
    )
    on conflict (customer_id) do update
    set dealership_type = excluded.dealership_type,
        dealership_name = excluded.dealership_name,
        owner_name = excluded.owner_name,
        oem_name = excluded.oem_name,
        yearly_sales_band = excluded.yearly_sales_band,
        updated_at = now();

    if nullif(v_draft->>'representative_name', '') is not null then
      insert into public.dealership_representatives (
        customer_id, representative_type, representative_name, mobile, email,
        aadhaar_last_four, aadhaar_hash, pan_number, updated_at
      ) values (
        v_customer.id,
        v_draft->>'dealership_type',
        v_draft->>'representative_name',
        v_draft->>'representative_mobile',
        nullif(v_draft->>'representative_email', ''),
        nullif(v_draft->>'representative_aadhaar_last_four', ''),
        nullif(v_draft->>'representative_aadhaar_hash', ''),
        nullif(v_draft->>'representative_pan', ''),
        now()
      )
      on conflict (customer_id) do update
      set representative_type = excluded.representative_type,
          representative_name = excluded.representative_name,
          mobile = excluded.mobile,
          email = excluded.email,
          aadhaar_last_four = excluded.aadhaar_last_four,
          aadhaar_hash = excluded.aadhaar_hash,
          pan_number = excluded.pan_number,
          updated_at = now();
    end if;

    foreach v_role in array array['sales_head','bodyshop_head','insurance_head','insurance_spoc'] loop
      insert into public.dealership_contacts (
        customer_id, contact_role, contact_name, mobile, email, updated_at
      ) values (
        v_customer.id,
        v_role,
        nullif(v_draft->>(v_role || '_name'), ''),
        nullif(v_draft->>(v_role || '_mobile'), ''),
        nullif(v_draft->>(v_role || '_email'), ''),
        now()
      )
      on conflict (customer_id, contact_role) do update
      set contact_name = excluded.contact_name,
          mobile = excluded.mobile,
          email = excluded.email,
          updated_at = now();
    end loop;
    v_role := 'dealership_owner';

  elsif new.partner_type = 'corporate' then
    update public.customers
    set partner_type = 'corporate',
        company_name = coalesce(nullif(v_draft->>'company_name', ''), company_name),
        legal_trade_name = coalesce(nullif(v_draft->>'company_name', ''), legal_trade_name),
        address_street = nullif(v_draft->>'address_street', ''),
        address_locality = nullif(v_draft->>'address_locality', ''),
        india_location_id = nullif(v_draft->>'india_location_id', '')::uuid,
        city = nullif(v_draft->>'city', ''),
        state = nullif(v_draft->>'state', ''),
        postal_code = nullif(v_draft->>'postal_code', ''),
        address = concat_ws(', ',
          nullif(v_draft->>'address_street', ''),
          nullif(v_draft->>'address_locality', ''),
          nullif(v_draft->>'city', ''),
          nullif(v_draft->>'state', ''),
          nullif(v_draft->>'postal_code', '')
        ),
        pan_number = nullif(v_draft->>'company_pan', ''),
        is_gst_registered = nullif(v_draft->>'gst_number', '') is not null,
        gst_number = nullif(v_draft->>'gst_number', ''),
        fleet_size_band = nullif(v_draft->>'fleet_size_band', ''),
        onboarding_status = 'active',
        onboarding_completed_at = now(),
        updated_by = new.profile_id,
        updated_at = now()
    where id = v_customer.id;

    insert into public.customer_contacts (
      customer_id, contact_role, full_name, phone, email, profile_id,
      login_required, access_status, created_by, updated_at
    ) values (
      v_customer.id,
      'corporate_creator',
      coalesce(nullif(v_profile_name, ''), v_customer.contact_name, 'Corporate Creator'),
      v_customer.phone,
      v_customer.email,
      new.profile_id,
      true,
      'active',
      new.profile_id,
      now()
    )
    on conflict (customer_id, contact_role) do update
    set full_name = excluded.full_name,
        phone = excluded.phone,
        email = excluded.email,
        profile_id = excluded.profile_id,
        access_status = 'active',
        updated_at = now();

    for v_contact in
      select contact_role, full_name, phone, email
      from public.customer_onboarding_contacts
      where application_id = new.id
        and contact_role in ('ceo_head','admin_head','dedicated_spoc')
    loop
      insert into public.customer_contacts (
        customer_id, contact_role, full_name, phone, email, profile_id,
        login_required, access_status, created_by, updated_at
      ) values (
        v_customer.id,
        v_contact.contact_role,
        v_contact.full_name,
        v_contact.phone,
        v_contact.email,
        null,
        true,
        'pending',
        new.profile_id,
        now()
      )
      on conflict (customer_id, contact_role) do update
      set full_name = excluded.full_name,
          phone = excluded.phone,
          email = excluded.email,
          updated_at = now();

      insert into public.customer_memberships (
        customer_id, profile_id, invited_phone, invited_email,
        membership_role, is_primary, status, created_by
      ) values (
        v_customer.id, null, v_contact.phone, v_contact.email,
        v_contact.contact_role, false, 'pending', new.profile_id
      )
      on conflict do nothing;
    end loop;
    v_role := 'corporate_creator';
  else
    -- Unknown/legacy Customer App types remain reviewable rather than being
    -- auto-completed by this workflow.
    return new;
  end if;

  update public.customer_memberships
  set membership_role = v_role,
      is_primary = true,
      status = 'active',
      updated_at = now()
  where customer_id = v_customer.id
    and profile_id = new.profile_id;

  update public.customer_onboarding_contacts
  set linked_profile_id = case
        when contact_role in ('group_owner','dealership_owner','corporate_creator') then new.profile_id
        else linked_profile_id
      end,
      membership_status = case
        when contact_role in ('group_owner','dealership_owner','corporate_creator') then 'active'
        else membership_status
      end,
      updated_at = now()
  where application_id = new.id;

  update public.customer_onboarding_applications
  set customer_id = v_customer.id,
      status = 'approved',
      reviewed_by = null,
      reviewed_at = null,
      completed_at = now(),
      updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists finalize_standalone_customer_app_kyc
  on public.customer_onboarding_applications;
create trigger finalize_standalone_customer_app_kyc
after update of status
on public.customer_onboarding_applications
for each row
when (new.status = 'submitted')
execute function public.finalize_standalone_customer_app_kyc();

comment on function public.ensure_customer_signup_profile(text, text, text) is
  'Customer App signup creates the canonical customer master and active membership immediately. KYC is not required for vehicle access.';

comment on function public.finalize_standalone_customer_app_kyc() is
  'Automatically enriches the same signup-created customer and completes standalone Customer App KYC without Operations review.';

-- Safe repair for existing active Customer App signups that still have only a
-- profile/onboarding shell because they were created under the previous model.
insert into public.customers (
  profile_id,
  customer_code,
  contact_name,
  phone,
  email,
  onboarding_status,
  creation_channel,
  created_by,
  updated_by
)
select
  p.id,
  public.generate_customer_signup_code(),
  coalesce(nullif(p.full_name, ''), 'New user'),
  coalesce(nullif(p.phone, ''), coa.applicant_phone, ''),
  coalesce(nullif(p.email, ''), coa.applicant_email),
  'active',
  'direct_customer_onboarding',
  p.id,
  p.id
from public.profiles p
join lateral (
  select application.*
  from public.customer_onboarding_applications application
  where application.profile_id = p.id
    and application.source = 'customer_app'
    and application.status not in ('approved','rejected','cancelled')
    and application.group_customer_id is null
  order by application.created_at desc
  limit 1
) coa on true
where p.role = 'customer'
  and p.is_active = true
  and not exists (
    select 1 from public.customers c where c.profile_id = p.id
  )
  and not exists (
    select 1
    from public.customer_memberships cm
    where cm.profile_id = p.id
      and cm.status = 'active'
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
select
  c.id,
  c.profile_id,
  c.phone,
  c.email,
  'owner',
  true,
  'active',
  c.profile_id
from public.customers c
where c.profile_id is not null
  and c.creation_channel = 'direct_customer_onboarding'
  and exists (
    select 1
    from public.customer_onboarding_applications coa
    where coa.profile_id = c.profile_id
      and coa.source = 'customer_app'
      and coa.status not in ('approved','rejected','cancelled')
      and coa.group_customer_id is null
  )
on conflict (customer_id, profile_id) do update
set status = 'active',
    is_primary = true,
    updated_at = now();

commit;
