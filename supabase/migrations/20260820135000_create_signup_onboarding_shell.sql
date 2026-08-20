-- Ensure an explicit mobile Sign Up creates or resumes a fresh onboarding context.
-- This keeps normal login blocked for deleted/orphaned customers while allowing the
-- same preserved Auth identity to register again deliberately.

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
  v_has_customer_relationship boolean := false;
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
  end if;

  select (
    exists (
      select 1
      from public.customers
      where profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.customer_memberships cm
      join public.customers c on c.id = cm.customer_id
      where cm.profile_id = auth.uid()
        and cm.status = 'active'
    )
  ) into v_has_customer_relationship;

  if not v_has_customer_relationship
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
