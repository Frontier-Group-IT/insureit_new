begin;

-- Customer mobile numbers are contact data and are intentionally not globally unique.
-- Customer App sign-up may only claim an existing master when BOTH:
--   1) the verified auth phone matches exactly after normalization, and
--   2) the submitted account name matches exactly after normalization.
-- Ambiguous same-phone/same-name matches are blocked for manual review instead of guessed.

create or replace function public.customer_login_mobile_key(value text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when length(regexp_replace(coalesce(value, ''), '\D', '', 'g')) >= 10
      then right(regexp_replace(coalesce(value, ''), '\D', '', 'g'), 10)
    else null
  end;
$$;

create or replace function public.customer_login_name_key(value text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(lower(regexp_replace(trim(coalesce(value, '')), '[^a-zA-Z0-9]', '', 'g')), '');
$$;

revoke all on function public.customer_login_mobile_key(text) from public;
revoke all on function public.customer_login_name_key(text) from public;
grant execute on function public.customer_login_mobile_key(text) to authenticated, service_role;
grant execute on function public.customer_login_name_key(text) to authenticated, service_role;

-- Repair already-created Customer App duplicates where the match is unambiguous:
-- one direct-signup row with a profile + one older active, unclaimed master with the
-- exact same normalized phone and account name. Dependencies are moved to the older
-- master before the direct-signup duplicate is removed.
do $$
declare
  repair record;
  signup_row public.customers%rowtype;
  master_row public.customers%rowtype;
  ref_row record;
  signup_profile_id uuid;
  merged_count integer := 0;
begin
  for repair in
    with direct_signup as (
      select
        c.*,
        public.customer_login_mobile_key(c.phone) as phone_key,
        public.customer_login_name_key(coalesce(nullif(c.company_name, ''), nullif(c.contact_name, ''))) as name_key
      from public.customers c
      where c.creation_channel = 'direct_customer_onboarding'
        and c.profile_id is not null
        and lower(coalesce(c.status, 'active')) = 'active'
    ), candidates as (
      select
        signup.id as signup_id,
        existing.id as master_id,
        count(*) over (partition by signup.id) as candidate_count
      from direct_signup signup
      join public.customers existing
        on existing.id <> signup.id
       and public.customer_login_mobile_key(existing.phone) = signup.phone_key
       and (
         public.customer_login_name_key(existing.contact_name) = signup.name_key
         or public.customer_login_name_key(existing.company_name) = signup.name_key
         or public.customer_login_name_key(existing.legal_trade_name) = signup.name_key
       )
       and lower(coalesce(existing.status, 'active')) = 'active'
       and existing.profile_id is null
       and existing.creation_channel is distinct from 'direct_customer_onboarding'
       and not exists (
         select 1
         from public.customer_memberships cm
         where cm.customer_id = existing.id
           and cm.status = 'active'
       )
      where signup.phone_key is not null
        and signup.name_key is not null
        and not exists (
          select 1
          from public.customer_memberships cm
          where cm.customer_id = signup.id
            and cm.status = 'active'
            and cm.profile_id <> signup.profile_id
        )
    )
    select signup_id, master_id
    from candidates
    where candidate_count = 1
  loop
    select * into signup_row from public.customers where id = repair.signup_id for update;
    select * into master_row from public.customers where id = repair.master_id for update;

    if signup_row.id is null or master_row.id is null then
      continue;
    end if;

    signup_profile_id := signup_row.profile_id;

    -- Release the unique profile binding before assigning the canonical master.
    update public.customers
    set profile_id = null,
        updated_at = now()
    where id = signup_row.id;

    update public.customers
    set profile_id = signup_profile_id,
        partner_type = coalesce(partner_type, signup_row.partner_type),
        company_name = coalesce(nullif(company_name, ''), nullif(signup_row.company_name, '')),
        email = coalesce(nullif(email, ''), nullif(signup_row.email, '')),
        address = coalesce(nullif(address, ''), nullif(signup_row.address, '')),
        address_street = coalesce(nullif(address_street, ''), nullif(signup_row.address_street, '')),
        address_locality = coalesce(nullif(address_locality, ''), nullif(signup_row.address_locality, '')),
        india_location_id = coalesce(india_location_id, signup_row.india_location_id),
        city = coalesce(nullif(city, ''), nullif(signup_row.city, '')),
        state = coalesce(nullif(state, ''), nullif(signup_row.state, '')),
        postal_code = coalesce(nullif(postal_code, ''), nullif(signup_row.postal_code, '')),
        pan_number = coalesce(nullif(pan_number, ''), nullif(signup_row.pan_number, '')),
        aadhaar_last_four = coalesce(nullif(aadhaar_last_four, ''), nullif(signup_row.aadhaar_last_four, '')),
        aadhaar_hash = coalesce(nullif(aadhaar_hash, ''), nullif(signup_row.aadhaar_hash, '')),
        legal_trade_name = coalesce(nullif(legal_trade_name, ''), nullif(signup_row.legal_trade_name, '')),
        is_gst_registered = coalesce(is_gst_registered, signup_row.is_gst_registered),
        gst_number = coalesce(nullif(gst_number, ''), nullif(signup_row.gst_number, '')),
        fleet_size_band = coalesce(nullif(fleet_size_band, ''), nullif(signup_row.fleet_size_band, '')),
        onboarding_completed_at = coalesce(onboarding_completed_at, signup_row.onboarding_completed_at),
        updated_by = coalesce(signup_row.updated_by, signup_profile_id, updated_by),
        updated_at = now()
    where id = master_row.id;

    -- Preserve the Customer App login membership on the canonical master.
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
      master_row.id,
      signup_profile_id,
      coalesce(cm.invited_phone, signup_row.phone),
      coalesce(cm.invited_email, signup_row.email),
      case master_row.partner_type
        when 'group' then 'group_owner'
        when 'dealership' then 'dealership_owner'
        when 'corporate' then 'corporate_creator'
        else 'owner'
      end,
      true,
      'active',
      coalesce(cm.created_by, signup_profile_id)
    from (select 1) seed
    left join lateral (
      select *
      from public.customer_memberships x
      where x.customer_id = signup_row.id
        and x.profile_id = signup_profile_id
      order by x.is_primary desc, x.updated_at desc
      limit 1
    ) cm on true
    on conflict (customer_id, profile_id) do update
    set invited_phone = coalesce(excluded.invited_phone, public.customer_memberships.invited_phone),
        invited_email = coalesce(excluded.invited_email, public.customer_memberships.invited_email),
        membership_role = excluded.membership_role,
        is_primary = true,
        status = 'active',
        updated_at = now();

    delete from public.customer_memberships
    where customer_id = signup_row.id
      and profile_id = signup_profile_id;

    -- Move every remaining single-column FK to customers, including vehicles,
    -- policies, claims, documents, activity, onboarding state, referrals, etc.
    -- customer_memberships is handled above and the self-reference is handled below.
    for ref_row in
      select
        c.conrelid::regclass as table_name,
        a.attname as column_name
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = any(c.conkey)
      where c.contype = 'f'
        and c.confrelid = 'public.customers'::regclass
        and array_length(c.conkey, 1) = 1
        and c.conrelid <> 'public.customer_memberships'::regclass
        and c.conrelid <> 'public.customers'::regclass
    loop
      execute format(
        'update %s set %I = $1 where %I = $2',
        ref_row.table_name,
        ref_row.column_name,
        ref_row.column_name
      ) using master_row.id, signup_row.id;
    end loop;

    update public.customers
    set origin_customer_id = master_row.id
    where origin_customer_id = signup_row.id
      and id <> master_row.id
      and id <> signup_row.id;

    insert into public.audit_logs (
      actor_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    ) values (
      signup_profile_id,
      'merge_customer_app_duplicate_into_existing_master',
      'customers',
      master_row.id,
      jsonb_build_object(
        'duplicate_customer_id', signup_row.id,
        'duplicate_customer_code', signup_row.customer_code,
        'duplicate_creation_channel', signup_row.creation_channel,
        'reason', 'verified_phone_and_exact_name_match'
      ),
      jsonb_build_object(
        'canonical_customer_id', master_row.id,
        'canonical_customer_code', master_row.customer_code,
        'profile_id', signup_profile_id,
        'reason', 'verified_phone_and_exact_name_match'
      )
    );

    delete from public.customers where id = signup_row.id;
    merged_count := merged_count + 1;
  end loop;

  raise notice 'Customer App duplicate repair merged % unambiguous customer record(s).', merged_count;
end $$;

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
  v_verified_phone text;
  v_verified_phone_key text;
  v_name_key text;
  v_match_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select phone into v_verified_phone
  from auth.users
  where id = auth.uid();

  if v_verified_phone is null then
    raise exception 'A verified phone login is required for customer account activation.';
  end if;

  v_verified_phone_key := public.customer_login_mobile_key(v_verified_phone);
  v_name_key := public.customer_login_name_key(p_full_name);

  if v_verified_phone_key is null
     or public.customer_login_mobile_key(p_phone) is distinct from v_verified_phone_key then
    raise exception 'The submitted mobile number does not match the verified login mobile.';
  end if;

  if v_name_key is null then
    raise exception 'Customer name is required.';
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

  -- Existing profile/membership remains authoritative for repeat sign-ins.
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

  -- Before creating a new master, claim exactly one existing active/unclaimed
  -- customer whose verified phone AND account name match. Same-phone/different-name
  -- records remain distinct by design.
  if v_customer.id is null then
    select count(*) into v_match_count
    from public.customers c
    where public.customer_login_mobile_key(c.phone) = v_verified_phone_key
      and lower(coalesce(c.status, 'active')) = 'active'
      and (c.profile_id is null or c.profile_id = auth.uid())
      and (
        public.customer_login_name_key(c.contact_name) = v_name_key
        or public.customer_login_name_key(c.company_name) = v_name_key
        or public.customer_login_name_key(c.legal_trade_name) = v_name_key
      )
      and not exists (
        select 1
        from public.customer_memberships cm
        where cm.customer_id = c.id
          and cm.status = 'active'
          and cm.profile_id <> auth.uid()
      );

    if v_match_count > 1 then
      raise exception 'Multiple customer records match this verified mobile and customer name. Contact support for account linking.';
    elsif v_match_count = 1 then
      select c.* into v_customer
      from public.customers c
      where public.customer_login_mobile_key(c.phone) = v_verified_phone_key
        and lower(coalesce(c.status, 'active')) = 'active'
        and (c.profile_id is null or c.profile_id = auth.uid())
        and (
          public.customer_login_name_key(c.contact_name) = v_name_key
          or public.customer_login_name_key(c.company_name) = v_name_key
          or public.customer_login_name_key(c.legal_trade_name) = v_name_key
        )
        and not exists (
          select 1
          from public.customer_memberships cm
          where cm.customer_id = c.id
            and cm.status = 'active'
            and cm.profile_id <> auth.uid()
        )
      order by c.created_at asc, c.id asc
      limit 1
      for update;

      update public.customers
      set profile_id = auth.uid(),
          email = coalesce(nullif(email, ''), nullif(trim(p_email), '')),
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
          membership_role = excluded.membership_role,
          is_primary = true,
          status = 'active',
          updated_at = now();

      insert into public.audit_logs (
        actor_id,
        action,
        table_name,
        record_id,
        new_data
      ) values (
        auth.uid(),
        'link_customer_app_profile_to_existing_master',
        'customers',
        v_customer.id,
        jsonb_build_object(
          'profile_id', auth.uid(),
          'matching_rule', 'verified_phone_and_exact_name',
          'source', 'customer_app_signup'
        )
      );
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
        membership_role = excluded.membership_role,
        is_primary = true,
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

comment on function public.ensure_customer_signup_profile(text, text, text) is
  'Creates or resolves a Customer App profile. Reuses one active unclaimed customer only when verified auth phone and normalized account name match exactly; blocks ambiguous matches.';

commit;
