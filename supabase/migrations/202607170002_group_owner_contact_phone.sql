-- Separate Group login mobile from Group owner business contact mobile.

drop function if exists public.submit_group_onboarding_application(uuid, text, text, text);
drop function if exists public.submit_group_onboarding_application(uuid, text, text, text, text);

create or replace function public.submit_group_onboarding_application(
  p_application_id uuid,
  p_group_name text,
  p_owner_name text,
  p_email text default null,
  p_owner_phone text default null
)
returns public.customer_onboarding_applications
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result public.customer_onboarding_applications;
  normalized_group_name text := nullif(trim(p_group_name), '');
  normalized_owner_name text := nullif(trim(p_owner_name), '');
  normalized_email text := nullif(lower(trim(p_email)), '');
  owner_phone_digits text := regexp_replace(coalesce(p_owner_phone, ''), '\D', '', 'g');
  normalized_owner_phone text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if length(owner_phone_digits) > 10 then
    owner_phone_digits := right(owner_phone_digits, 10);
  end if;
  normalized_owner_phone := case when length(owner_phone_digits) = 10 then '+91' || owner_phone_digits else null end;

  if normalized_group_name is null or length(normalized_group_name) < 2 then
    raise exception 'Enter the group name.';
  end if;
  if normalized_owner_name is null or length(normalized_owner_name) < 2 then
    raise exception 'Enter the owner name.';
  end if;
  if normalized_owner_phone is null then
    raise exception 'Enter the owner contact mobile number.';
  end if;
  if normalized_email is not null and normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.';
  end if;

  update public.customer_onboarding_applications
  set
    partner_type = 'group',
    status = 'submitted',
    current_step = 4,
    submitted_at = now(),
    applicant_email = coalesce(normalized_email, applicant_email),
    draft_data = coalesce(draft_data, '{}'::jsonb) || jsonb_build_object(
      'group_name', normalized_group_name,
      'owner_name', normalized_owner_name,
      'owner_phone', normalized_owner_phone,
      'login_phone', applicant_phone,
      'email', normalized_email
    )
  where id = p_application_id
    and profile_id = auth.uid()
    and partner_type = 'group'
    and status in ('in_progress', 'changes_requested')
  returning * into result;

  if result.id is null then
    raise exception 'The Group KYC application is not available for submission.';
  end if;

  insert into public.customer_onboarding_contacts (
    application_id, contact_role, full_name, phone, email, login_required,
    linked_profile_id, membership_status
  )
  values (
    result.id,
    'group_owner',
    normalized_owner_name,
    normalized_owner_phone,
    normalized_email,
    true,
    auth.uid(),
    'pending'
  )
  on conflict (application_id, contact_role) do update
  set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email,
    linked_profile_id = excluded.linked_profile_id,
    updated_at = now();

  return result;
end;
$$;

revoke all on function public.submit_group_onboarding_application(uuid, text, text, text, text) from public;
grant execute on function public.submit_group_onboarding_application(uuid, text, text, text, text) to authenticated;
