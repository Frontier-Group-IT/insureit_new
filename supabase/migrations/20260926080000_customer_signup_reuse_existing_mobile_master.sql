begin;

-- Existing Customer App users must explicitly select an existing customer master
-- when their authenticated mobile number already exists in the portal. This keeps
-- sign-up idempotent, prevents empty duplicate customer masters, and lets the app
-- immediately inherit vehicles, policies and claims from the selected customer_id.

create or replace function public.get_existing_customer_accounts_for_signup()
returns table (
  customer_id uuid,
  customer_code text,
  account_name text,
  city text,
  state text,
  vehicle_count bigint,
  policy_count bigint,
  claim_count bigint,
  is_current_profile_customer boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_phone10 text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select right(regexp_replace(coalesce(u.phone, ''), '\D', '', 'g'), 10)
  into v_phone10
  from auth.users u
  where u.id = auth.uid();

  if nullif(v_phone10, '') is null then
    return;
  end if;

  return query
  select
    c.id,
    c.customer_code,
    coalesce(nullif(trim(c.company_name), ''), nullif(trim(c.contact_name), ''), c.customer_code),
    c.city,
    c.state,
    (select count(*) from public.vehicles v where v.customer_id = c.id),
    (select count(*) from public.policies p where p.customer_id = c.id),
    (select count(*) from public.claims cl where cl.customer_id = c.id),
    c.profile_id = auth.uid()
  from public.customers c
  where right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10) = v_phone10
  order by
    ((select count(*) from public.vehicles v where v.customer_id = c.id)
      + (select count(*) from public.policies p where p.customer_id = c.id)
      + (select count(*) from public.claims cl where cl.customer_id = c.id)) desc,
    c.updated_at desc;
end;
$$;

revoke all on function public.get_existing_customer_accounts_for_signup() from public;
grant execute on function public.get_existing_customer_accounts_for_signup() to authenticated;

create or replace function public.link_existing_customer_account(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_phone10 text;
  v_target public.customers;
  v_old public.customers;
  v_target_role text;
  v_old_has_business_data boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select right(regexp_replace(coalesce(u.phone, ''), '\D', '', 'g'), 10)
  into v_phone10
  from auth.users u
  where u.id = auth.uid();

  if nullif(v_phone10, '') is null then
    raise exception 'Authenticated mobile number is missing.';
  end if;

  select * into v_target
  from public.customers c
  where c.id = p_customer_id
    and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10) = v_phone10;

  if v_target.id is null then
    raise exception 'The selected customer account does not match the authenticated mobile number.';
  end if;

  if v_target.profile_id is not null and v_target.profile_id <> auth.uid() then
    raise exception 'This customer account is already linked to another login.';
  end if;

  -- Older app versions could create an empty direct-signup shell before the user
  -- selected the real customer. Detach only a provably empty shell; never detach
  -- a customer that already owns business data.
  for v_old in
    select * from public.customers c
    where c.profile_id = auth.uid()
      and c.id <> v_target.id
  loop
    select exists(select 1 from public.vehicles v where v.customer_id = v_old.id)
        or exists(select 1 from public.policies p where p.customer_id = v_old.id)
        or exists(select 1 from public.claims cl where cl.customer_id = v_old.id)
    into v_old_has_business_data;

    if not v_old_has_business_data
       and coalesce(v_old.creation_channel, '') = 'direct_customer_onboarding'
       and right(regexp_replace(coalesce(v_old.phone, ''), '\D', '', 'g'), 10) = v_phone10 then
      update public.customer_memberships
      set status = 'inactive', is_primary = false, updated_at = now()
      where customer_id = v_old.id and profile_id = auth.uid();

      update public.customers
      set profile_id = null, updated_by = auth.uid(), updated_at = now()
      where id = v_old.id and profile_id = auth.uid();
    end if;
  end loop;

  update public.customers
  set profile_id = auth.uid(), updated_by = auth.uid(), updated_at = now()
  where id = v_target.id
    and (profile_id is null or profile_id = auth.uid());

  v_target_role := case v_target.partner_type
    when 'group' then 'group_owner'
    when 'dealership' then 'dealership_owner'
    when 'corporate' then 'corporate_creator'
    else 'owner'
  end;

  update public.customer_memberships
  set is_primary = false, updated_at = now()
  where profile_id = auth.uid()
    and status = 'active'
    and customer_id <> v_target.id;

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
    v_target.id,
    auth.uid(),
    u.phone,
    u.email,
    v_target_role,
    true,
    'active',
    auth.uid()
  from auth.users u
  where u.id = auth.uid()
  on conflict (customer_id, profile_id) do update
  set invited_phone = coalesce(excluded.invited_phone, public.customer_memberships.invited_phone),
      invited_email = coalesce(excluded.invited_email, public.customer_memberships.invited_email),
      membership_role = excluded.membership_role,
      is_primary = true,
      status = 'active',
      updated_at = now();
end;
$$;

revoke all on function public.link_existing_customer_account(uuid) from public;
grant execute on function public.link_existing_customer_account(uuid) to authenticated;

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
  v_customer public.customers;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_phone10 text;
  v_existing_phone_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if length(v_phone) >= 10 then v_phone10 := right(v_phone, 10); else v_phone10 := v_phone; end if;

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
    update public.profiles
    set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
        phone = coalesce(nullif(trim(p_phone), ''), phone),
        email = coalesce(nullif(trim(p_email), ''), email)
    where id = auth.uid()
    returning * into result;
  end if;

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

  if v_customer.id is null and nullif(v_phone10, '') is not null then
    select count(*) into v_existing_phone_count
    from public.customers c
    where right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10) = v_phone10;

    if v_existing_phone_count > 0 then
      raise exception 'EXISTING_CUSTOMER_SELECTION_REQUIRED';
    end if;
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
  end if;

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
      membership_role = excluded.membership_role,
      is_primary = true,
      status = 'active',
      updated_at = now();

  return result;
end;
$$;

revoke all on function public.ensure_customer_signup_profile(text, text, text) from public;
grant execute on function public.ensure_customer_signup_profile(text, text, text) to authenticated;

commit;
