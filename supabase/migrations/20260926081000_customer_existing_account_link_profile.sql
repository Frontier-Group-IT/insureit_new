begin;

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

  -- The selection screen runs immediately after OTP verification, before the
  -- normal signup sync. Ensure the public profile exists before membership FK use.
  insert into public.profiles (id, role, full_name, phone, email, is_active)
  select
    u.id,
    'customer',
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(v_target.contact_name), ''), 'Customer'),
    u.phone,
    coalesce(u.email, nullif(trim(u.raw_user_meta_data ->> 'email'), '')),
    true
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do update
  set role = case when public.profiles.role = 'customer' then 'customer' else public.profiles.role end,
      full_name = coalesce(nullif(trim(excluded.full_name), ''), public.profiles.full_name),
      phone = coalesce(excluded.phone, public.profiles.phone),
      email = coalesce(excluded.email, public.profiles.email),
      is_active = true;

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
    customer_id, profile_id, invited_phone, invited_email,
    membership_role, is_primary, status, created_by
  )
  select
    v_target.id, auth.uid(), u.phone, u.email,
    v_target_role, true, 'active', auth.uid()
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

commit;
