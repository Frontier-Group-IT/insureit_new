-- Revoke mobile customer access when the last customer relationship is deleted,
-- while preserving the Supabase Auth identity so a deliberate future Sign Up can
-- reactivate the same phone identity safely.

create or replace function public.delete_customer_and_revoke_mobile_access(
  p_customer_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_customer record;
  v_profile_id uuid := null;
  v_profile_role public.app_role := null;
  v_profile_was_active boolean := false;
  v_has_remaining_relationship boolean := false;
  v_access_revoked boolean := false;
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_actor_id
      and role = 'it_super_user'
      and is_active = true
  ) then
    raise exception 'Only an active IT Super User can delete a customer.';
  end if;

  select id, profile_id, customer_code, contact_name
    into v_customer
  from public.customers
  where id = p_customer_id
  for update;

  if v_customer.id is null then
    raise exception 'This customer no longer exists.';
  end if;

  if exists (select 1 from public.vehicles where customer_id = p_customer_id)
     or exists (select 1 from public.policies where customer_id = p_customer_id)
     or exists (select 1 from public.claims where customer_id = p_customer_id) then
    raise exception 'Cannot delete this customer while vehicle, policy or claim records are still linked.';
  end if;

  if v_customer.profile_id is not null then
    select id, role, is_active
      into v_profile_id, v_profile_role, v_profile_was_active
    from public.profiles
    where id = v_customer.profile_id
    for update;
  end if;

  delete from public.customers where id = p_customer_id;

  if v_profile_id is not null and v_profile_role = 'customer' then
    select (
      exists (
        select 1
        from public.customers
        where profile_id = v_profile_id
      )
      or exists (
        select 1
        from public.customer_memberships cm
        join public.customers c on c.id = cm.customer_id
        where cm.profile_id = v_profile_id
          and cm.status = 'active'
      )
    ) into v_has_remaining_relationship;

    if not v_has_remaining_relationship and v_profile_was_active then
      update public.profiles
      set is_active = false,
          updated_by = p_actor_id
      where id = v_profile_id
        and role = 'customer';
      v_access_revoked := true;
    end if;
  end if;

  insert into public.audit_logs (
    actor_id,
    action,
    table_name,
    record_id,
    old_data
  ) values (
    p_actor_id,
    'delete_customer',
    'customers',
    p_customer_id,
    jsonb_build_object(
      'id', p_customer_id,
      'profile_id', v_customer.profile_id,
      'customer_code', v_customer.customer_code,
      'contact_name', v_customer.contact_name,
      'deletion_source', 'it_super_user_master_data_control',
      'customer_access_revoked', v_access_revoked,
      'auth_identity_preserved', true,
      'signup_reactivation_allowed', true
    )
  );

  return jsonb_build_object(
    'customer_id', p_customer_id,
    'profile_id', v_customer.profile_id,
    'customer_access_revoked', v_access_revoked,
    'has_remaining_customer_relationship', v_has_remaining_relationship,
    'auth_identity_preserved', true
  );
end;
$$;

revoke all on function public.delete_customer_and_revoke_mobile_access(uuid, uuid) from public;
revoke all on function public.delete_customer_and_revoke_mobile_access(uuid, uuid) from anon;
revoke all on function public.delete_customer_and_revoke_mobile_access(uuid, uuid) from authenticated;
grant execute on function public.delete_customer_and_revoke_mobile_access(uuid, uuid) to service_role;

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

    return result;
  end if;

  if result.role <> 'customer' then
    return result;
  end if;

  if result.is_active = false then
    select (
      not exists (
        select 1
        from public.customers
        where profile_id = auth.uid()
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
      actor_id,
      action,
      table_name,
      record_id,
      old_data
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

  return result;
end;
$$;
