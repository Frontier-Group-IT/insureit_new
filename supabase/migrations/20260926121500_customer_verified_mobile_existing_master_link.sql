begin;

-- A verified Customer App phone may claim an existing customer master only when the
-- match is unambiguous. Phone numbers are not globally unique in INSUREIT, so the
-- claim additionally requires an exact normalized customer-name match and an
-- unowned active individual/proprietor master. Ambiguous matches fail closed.

create or replace function public.normalize_customer_mobile(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when length(regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g')) >= 10
      then right(regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g'), 10)
    else regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g')
  end;
$$;

create or replace function public.normalize_customer_identity_name(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(coalesce(p_value, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

create or replace function public.customer_signup_master_is_empty(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not exists (select 1 from public.vehicles where customer_id = p_customer_id)
    and not exists (select 1 from public.policies where customer_id = p_customer_id)
    and not exists (select 1 from public.external_policies where customer_id = p_customer_id)
    and not exists (select 1 from public.claims where customer_id = p_customer_id)
    and not exists (select 1 from public.claim_documents where customer_id = p_customer_id)
    and not exists (select 1 from public.notifications where customer_id = p_customer_id)
    and not exists (select 1 from public.support_tickets where customer_id = p_customer_id)
    and not exists (select 1 from public.customer_documents where customer_id = p_customer_id)
    and not exists (select 1 from public.customer_activity_events where customer_id = p_customer_id)
    and not exists (select 1 from public.customer_contacts where customer_id = p_customer_id)
    and not exists (select 1 from public.service_enquiries where customer_id = p_customer_id)
    and not exists (select 1 from public.intermediary_referrals where customer_id = p_customer_id)
    and not exists (select 1 from public.intermediary_commission_ledger where customer_id = p_customer_id)
    and not exists (select 1 from public.intermediary_customer_links where customer_id = p_customer_id)
    and not exists (select 1 from public.vehicle_customer_links where customer_id = p_customer_id)
    and not exists (
      select 1 from public.customer_relationships
      where parent_customer_id = p_customer_id or child_customer_id = p_customer_id
    )
    and not exists (select 1 from public.customer_onboarding_applications where customer_id = p_customer_id)
    and not exists (select 1 from public.dealership_profiles where customer_id = p_customer_id)
    and not exists (select 1 from public.group_profiles where customer_id = p_customer_id)
    and not exists (select 1 from public.posp_misp_onboarding_profiles where customer_id = p_customer_id);
$$;

create or replace function public.try_claim_existing_customer_master(
  p_profile_id uuid,
  p_current_customer_id uuid,
  p_full_name text,
  p_email text default null::text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_auth_phone text;
  v_phone10 text;
  v_name_key text;
  v_candidate_id uuid;
  v_candidate_count integer := 0;
  v_current public.customers;
  v_candidate public.customers;
begin
  select u.phone into v_auth_phone
  from auth.users u
  where u.id = p_profile_id;

  v_phone10 := public.normalize_customer_mobile(v_auth_phone);
  v_name_key := public.normalize_customer_identity_name(p_full_name);

  if length(v_phone10) <> 10 or length(v_name_key) < 4 then
    return null;
  end if;

  if p_current_customer_id is not null then
    select * into v_current
    from public.customers
    where id = p_current_customer_id
    for update;

    if v_current.id is null
       or v_current.creation_channel is distinct from 'direct_customer_onboarding'
       or v_current.partner_type is not null
       or not public.customer_signup_master_is_empty(v_current.id) then
      return null;
    end if;
  end if;

  select
    count(*),
    (array_agg(c.id order by c.created_at, c.id))[1]
  into v_candidate_count, v_candidate_id
  from public.customers c
  where (p_current_customer_id is null or c.id <> p_current_customer_id)
    and c.profile_id is null
    and lower(coalesce(c.status, 'active')) = 'active'
    and lower(coalesce(c.onboarding_status, 'active')) = 'active'
    and (c.partner_type is null or c.partner_type = 'individual_proprietor')
    and public.normalize_customer_mobile(c.phone) = v_phone10
    and (
      public.normalize_customer_identity_name(c.contact_name) = v_name_key
      or public.normalize_customer_identity_name(c.company_name) = v_name_key
      or public.normalize_customer_identity_name(c.legal_trade_name) = v_name_key
    )
    and not exists (
      select 1
      from public.customer_memberships cm
      where cm.customer_id = c.id
        and cm.status = 'active'
        and cm.profile_id <> p_profile_id
    )
    and (
      c.creation_channel is distinct from 'direct_customer_onboarding'
      or not public.customer_signup_master_is_empty(c.id)
    );

  if v_candidate_count > 1 then
    raise exception 'Multiple existing customer records match this verified mobile and customer name. Account linking requires review.';
  end if;

  if v_candidate_count = 0 or v_candidate_id is null then
    return null;
  end if;

  select * into v_candidate
  from public.customers
  where id = v_candidate_id
  for update;

  if p_current_customer_id is not null then
    delete from public.customer_memberships
    where customer_id = p_current_customer_id
      and profile_id = p_profile_id;

    update public.customers
    set profile_id = null,
        origin_customer_id = v_candidate_id,
        updated_at = now()
    where id = p_current_customer_id
      and profile_id = p_profile_id;
  end if;

  update public.customers
  set profile_id = p_profile_id,
      email = coalesce(email, nullif(trim(p_email), '')),
      updated_by = p_profile_id,
      updated_at = now()
  where id = v_candidate_id
    and profile_id is null;

  if not found then
    raise exception 'The matched customer account was claimed by another login. Please retry.';
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
    v_candidate_id,
    p_profile_id,
    v_auth_phone,
    nullif(trim(p_email), ''),
    'owner',
    true,
    'active',
    p_profile_id
  )
  on conflict (customer_id, profile_id) do update
  set invited_phone = coalesce(excluded.invited_phone, public.customer_memberships.invited_phone),
      invited_email = coalesce(excluded.invited_email, public.customer_memberships.invited_email),
      membership_role = 'owner',
      is_primary = true,
      status = 'active',
      updated_at = now();

  insert into public.audit_logs (
    actor_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) values (
    p_profile_id,
    'customer_mobile_signup_claimed_existing',
    'customers',
    v_candidate_id,
    jsonb_build_object(
      'previous_profile_id', v_candidate.profile_id,
      'duplicate_customer_id', p_current_customer_id
    ),
    jsonb_build_object(
      'profile_id', p_profile_id,
      'link_basis', 'verified_phone_and_exact_normalized_name',
      'duplicate_customer_retained_for_audit', p_current_customer_id is not null
    )
  );

  return v_candidate_id;
end;
$$;

revoke all on function public.normalize_customer_mobile(text) from public;
revoke all on function public.normalize_customer_identity_name(text) from public;
revoke all on function public.customer_signup_master_is_empty(uuid) from public;
revoke all on function public.try_claim_existing_customer_master(uuid, uuid, text, text) from public;

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
  v_claimed_customer_id uuid;
  v_auth_phone text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select u.phone into v_auth_phone
  from auth.users u
  where u.id = auth.uid();

  if v_auth_phone is not null
     and public.normalize_customer_mobile(v_auth_phone) <> public.normalize_customer_mobile(p_phone) then
    raise exception 'The submitted mobile number does not match the verified login number.';
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
        not exists (select 1 from public.customers where profile_id = auth.uid())
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

  if v_auth_phone is not null
     and (
       v_customer.id is null
       or (
         v_customer.creation_channel = 'direct_customer_onboarding'
         and v_customer.partner_type is null
         and public.customer_signup_master_is_empty(v_customer.id)
       )
     ) then
    v_claimed_customer_id := public.try_claim_existing_customer_master(
      auth.uid(),
      v_customer.id,
      coalesce(nullif(trim(p_full_name), ''), v_customer.contact_name),
      p_email
    );

    if v_claimed_customer_id is not null then
      select * into v_customer
      from public.customers
      where id = v_claimed_customer_id;
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
    v_created_customer := true;

    insert into public.customer_memberships (
      customer_id, profile_id, invited_phone, invited_email,
      membership_role, is_primary, status, created_by
    ) values (
      v_customer.id, auth.uid(), nullif(trim(p_phone), ''), nullif(trim(p_email), ''),
      'owner', true, 'active', auth.uid()
    )
    on conflict (customer_id, profile_id) do update
    set invited_phone = coalesce(excluded.invited_phone, public.customer_memberships.invited_phone),
        invited_email = coalesce(excluded.invited_email, public.customer_memberships.invited_email),
        membership_role = 'owner',
        is_primary = true,
        status = 'active',
        updated_at = now();
  elsif v_customer.profile_id = auth.uid() then
    insert into public.customer_memberships (
      customer_id, profile_id, invited_phone, invited_email,
      membership_role, is_primary, status, created_by
    ) values (
      v_customer.id, auth.uid(), nullif(trim(p_phone), ''), nullif(trim(p_email), ''),
      case v_customer.partner_type
        when 'group' then 'group_owner'
        when 'dealership' then 'dealership_owner'
        when 'corporate' then 'corporate_creator'
        else 'owner'
      end,
      true, 'active', auth.uid()
    )
    on conflict (customer_id, profile_id) do update
    set invited_phone = coalesce(excluded.invited_phone, public.customer_memberships.invited_phone),
        invited_email = coalesce(excluded.invited_email, public.customer_memberships.invited_email),
        status = 'active',
        updated_at = now();
  end if;

  if v_created_customer
     and not exists (
       select 1
       from public.customer_onboarding_applications coa
       where coa.profile_id = auth.uid()
         and coa.status not in ('approved', 'rejected', 'cancelled')
     ) then
    insert into public.customer_onboarding_applications (
      profile_id, initiated_by, source, partner_type, status,
      current_step, applicant_phone, applicant_email
    ) values (
      auth.uid(), auth.uid(), 'customer_app', null, 'not_started', 1,
      nullif(trim(p_phone), ''), nullif(trim(p_email), '')
    );
  end if;

  return result;
end;
$$;

revoke all on function public.ensure_customer_signup_profile(text, text, text) from public;
grant execute on function public.ensure_customer_signup_profile(text, text, text) to authenticated;

-- Repair every already-created mobile-signup duplicate that meets the same strict
-- safety contract. The duplicate customer row is retained (unlinked) for audit;
-- no vehicle, policy, claim, document, commercial or operational record is moved.
do $$
declare
  r record;
  v_claimed uuid;
begin
  for r in
    select c.id, c.profile_id, c.contact_name, c.email
    from public.customers c
    join auth.users u on u.id = c.profile_id
    where c.profile_id is not null
      and u.phone is not null
      and c.creation_channel = 'direct_customer_onboarding'
      and c.partner_type is null
      and public.customer_signup_master_is_empty(c.id)
  loop
    begin
      v_claimed := public.try_claim_existing_customer_master(
        r.profile_id,
        r.id,
        r.contact_name,
        r.email
      );
    exception
      when raise_exception then
        if sqlerrm like 'Multiple existing customer records match%' then
          raise notice 'Skipped ambiguous customer mobile-link repair for profile %', r.profile_id;
        else
          raise;
        end if;
    end;
  end loop;
end;
$$;

comment on function public.ensure_customer_signup_profile(text, text, text) is
  'Creates/repairs Customer App identity. A verified mobile may claim an existing unowned active individual customer only when normalized mobile and customer name identify exactly one master; ambiguous matches fail closed.';

commit;
