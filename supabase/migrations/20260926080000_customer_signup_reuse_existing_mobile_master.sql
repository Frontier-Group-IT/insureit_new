begin;

-- Prevent Customer App signup from creating a second customer master when the
-- authenticated mobile number already belongs to an existing customer.
-- Resolution order remains profile -> membership -> unique normalized phone.
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
  v_match_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if length(v_phone) >= 10 then v_phone10 := right(v_phone, 10); else v_phone10 := v_phone; end if;

  select * into result from public.profiles where id=auth.uid();
  if result.id is null then
    insert into public.profiles(id,role,full_name,phone,email,is_active)
    values(auth.uid(),'customer',coalesce(nullif(trim(p_full_name),''),'New user'),nullif(trim(p_phone),''),nullif(trim(p_email),''),true)
    returning * into result;
  elsif result.role <> 'customer' then
    return result;
  else
    update public.profiles set
      full_name=coalesce(nullif(trim(p_full_name),''),full_name),
      phone=coalesce(nullif(trim(p_phone),''),phone),
      email=coalesce(nullif(trim(p_email),''),email)
    where id=auth.uid() returning * into result;
  end if;

  select c.* into v_customer from public.customers c
  where c.profile_id=auth.uid() order by c.updated_at desc limit 1;

  if v_customer.id is null then
    select c.* into v_customer from public.customer_memberships cm
    join public.customers c on c.id=cm.customer_id
    where cm.profile_id=auth.uid() and cm.status='active'
    order by cm.is_primary desc, cm.updated_at desc limit 1;
  end if;

  -- Existing portal/customer masters historically store 10-digit numbers while
  -- auth/profile values may contain +91. Only auto-link when the normalized
  -- number identifies exactly one customer; ambiguity is deliberately rejected.
  if v_customer.id is null and nullif(v_phone10,'') is not null then
    select count(*) into v_match_count from public.customers c
    where right(regexp_replace(coalesce(c.phone,''),'\D','','g'),10)=v_phone10;
    if v_match_count = 1 then
      select c.* into v_customer from public.customers c
      where right(regexp_replace(coalesce(c.phone,''),'\D','','g'),10)=v_phone10 limit 1;
    elsif v_match_count > 1 then
      raise exception 'Multiple customer masters use this mobile number. Please contact support to merge the duplicate records.';
    end if;
  end if;

  if v_customer.id is null then
    insert into public.customers(profile_id,customer_code,contact_name,phone,email,onboarding_status,creation_channel,created_by,updated_by)
    values(auth.uid(),public.generate_customer_signup_code(),coalesce(nullif(trim(p_full_name),''),'New user'),coalesce(nullif(trim(p_phone),''),''),nullif(trim(p_email),''),'active','direct_customer_onboarding',auth.uid(),auth.uid())
    returning * into v_customer;
  else
    -- Claim the existing master for this authenticated customer when it did not
    -- previously have an auth profile. Never overwrite another profile owner.
    if v_customer.profile_id is null then
      update public.customers set profile_id=auth.uid(), updated_by=auth.uid(), updated_at=now()
      where id=v_customer.id and profile_id is null;
    elsif v_customer.profile_id <> auth.uid() then
      raise exception 'This customer master is already linked to another login.';
    end if;
  end if;

  insert into public.customer_memberships(customer_id,profile_id,invited_phone,invited_email,membership_role,is_primary,status,created_by)
  values(v_customer.id,auth.uid(),nullif(trim(p_phone),''),nullif(trim(p_email),''),
    case v_customer.partner_type when 'group' then 'group_owner' when 'dealership' then 'dealership_owner' when 'corporate' then 'corporate_creator' else 'owner' end,
    true,'active',auth.uid())
  on conflict(customer_id,profile_id) do update set
    invited_phone=coalesce(excluded.invited_phone,public.customer_memberships.invited_phone),
    invited_email=coalesce(excluded.invited_email,public.customer_memberships.invited_email),
    membership_role=excluded.membership_role,is_primary=true,status='active',updated_at=now();

  return result;
end;
$$;

revoke all on function public.ensure_customer_signup_profile(text,text,text) from public;
grant execute on function public.ensure_customer_signup_profile(text,text,text) to authenticated;

commit;
