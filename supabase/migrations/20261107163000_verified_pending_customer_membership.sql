-- SEC-PR-01: verified phone only for pending customer links.
-- Draft for isolated synthetic verification. DO NOT apply to production until approved.
-- Preserve the three existing pending-link surfaces and active membership return contract.
create or replace function public.claim_pending_customer_memberships()
returns setof public.customer_memberships
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  normalized_phone text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  -- auth.users.phone is server-controlled; raw_user_meta_data is user-editable.
  -- Require a confirmed phone before activating pending links.
  select case
    when nullif(phone, '') is null or phone_confirmed_at is null then null
    when regexp_replace(phone, '[^0-9]', '', 'g') ~ '^91[0-9]{10}$'
      then '+' || regexp_replace(phone, '[^0-9]', '', 'g')
    when regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
      then '+91' || regexp_replace(phone, '[^0-9]', '', 'g')
    else phone
  end into normalized_phone
  from auth.users
  where id = auth.uid();

  if normalized_phone is null then
    return query
    select * from public.customer_memberships
    where profile_id = auth.uid() and status = 'active';
    return;
  end if;

  update public.customer_memberships
  set profile_id = auth.uid(), status = 'active', updated_at = now()
  where profile_id is null and status = 'pending'
    and invited_phone = normalized_phone;

  update public.customer_contacts
  set profile_id = auth.uid(), access_status = 'active', updated_at = now()
  where profile_id is null and access_status = 'pending'
    and phone = normalized_phone;

  update public.customer_onboarding_contacts
  set linked_profile_id = auth.uid(), membership_status = 'active', updated_at = now()
  where linked_profile_id is null and membership_status = 'pending'
    and phone = normalized_phone;

  return query
  select * from public.customer_memberships
  where profile_id = auth.uid() and status = 'active';
end;
$function$;

revoke all on function public.claim_pending_customer_memberships() from public;
grant execute on function public.claim_pending_customer_memberships() to authenticated;
