-- Create Group-associated onboarding applications through a validated RPC.
-- This avoids client-side RLS insert failures while preserving Group membership checks.

alter table public.customer_onboarding_applications
  add column if not exists group_customer_id uuid references public.customers(id) on delete restrict;

drop index if exists public.customer_onboarding_active_profile_uidx;
create unique index if not exists customer_onboarding_active_profile_uidx
  on public.customer_onboarding_applications(profile_id)
  where profile_id is not null
    and group_customer_id is null
    and status not in ('approved', 'rejected', 'cancelled');

create or replace function public.can_manage_group_associated_onboarding(
  p_group_customer_id uuid,
  p_profile_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customers customer
    where customer.id = p_group_customer_id
      and customer.partner_type = 'group'
      and customer.onboarding_status = 'active'
      and customer.profile_id = p_profile_id
  ) or exists (
    select 1
    from public.customer_memberships membership
    join public.customers customer on customer.id = membership.customer_id
    where membership.customer_id = p_group_customer_id
      and customer.partner_type = 'group'
      and customer.onboarding_status = 'active'
      and membership.profile_id = p_profile_id
      and membership.status = 'active'
      and coalesce(membership.membership_role, '') in (
        'owner',
        'admin',
        'manager',
        'group_owner',
        'group_admin'
      )
  );
$$;

grant execute on function public.can_manage_group_associated_onboarding(uuid, uuid) to authenticated;

create or replace function public.start_group_associated_onboarding_application(
  p_group_customer_id uuid,
  p_partner_type text,
  p_current_step integer,
  p_applicant_phone text,
  p_applicant_email text,
  p_draft_data jsonb
)
returns public.customer_onboarding_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_application public.customer_onboarding_applications;
  v_draft jsonb := coalesce(p_draft_data, '{}'::jsonb);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_partner_type not in ('corporate', 'individual_proprietor', 'dealership') then
    raise exception 'Unsupported associated customer type';
  end if;

  if not public.can_manage_group_associated_onboarding(p_group_customer_id, v_user_id) then
    raise exception 'You do not have permission to add customers to this Group';
  end if;

  v_draft := jsonb_set(v_draft, '{group_customer_id}', to_jsonb(p_group_customer_id::text), true);
  v_draft := jsonb_set(v_draft, '{initiated_from}', '"group_mobile"'::jsonb, true);

  insert into public.customer_onboarding_applications (
    profile_id,
    initiated_by,
    source,
    partner_type,
    status,
    current_step,
    applicant_phone,
    applicant_email,
    group_customer_id,
    draft_data
  ) values (
    v_user_id,
    v_user_id,
    'customer_app',
    p_partner_type,
    'in_progress',
    least(greatest(coalesce(p_current_step, 1), 1), 4),
    nullif(btrim(coalesce(p_applicant_phone, '')), ''),
    nullif(lower(btrim(coalesce(p_applicant_email, ''))), ''),
    p_group_customer_id,
    v_draft
  )
  returning * into v_application;

  return v_application;
end;
$$;

grant execute on function public.start_group_associated_onboarding_application(uuid, text, integer, text, text, jsonb) to authenticated;

create or replace function public.submit_group_associated_onboarding_application(
  p_application_id uuid,
  p_draft_data jsonb
)
returns public.customer_onboarding_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_application public.customer_onboarding_applications;
  v_draft jsonb := coalesce(p_draft_data, '{}'::jsonb);
  v_role text;
  v_name text;
  v_phone text;
  v_seen_phones text[] := array[]::text[];
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_application
  from public.customer_onboarding_applications
  where id = p_application_id
  for update;

  if v_application.id is null then
    raise exception 'Onboarding application not found';
  end if;

  if v_application.profile_id is distinct from v_user_id
     or v_application.initiated_by is distinct from v_user_id then
    raise exception 'You cannot submit this onboarding application';
  end if;

  if v_application.partner_type not in ('corporate', 'individual_proprietor', 'dealership') then
    raise exception 'Unsupported associated customer type';
  end if;

  if v_application.group_customer_id is null then
    raise exception 'Group account is required';
  end if;

  if not public.can_manage_group_associated_onboarding(v_application.group_customer_id, v_user_id) then
    raise exception 'You do not have permission to add customers to this Group';
  end if;

  if v_application.partner_type = 'corporate' then
    foreach v_role in array array['corporate_creator','ceo_head','admin_head','dedicated_spoc'] loop
      v_name := nullif(btrim(v_draft->>(v_role || '_name')), '');
      v_phone := regexp_replace(coalesce(v_draft->>(v_role || '_mobile'), ''), '\D', '', 'g');

      if length(v_phone) = 10 then
        v_phone := '+91' || v_phone;
      elsif length(v_phone) = 12 and left(v_phone, 2) = '91' then
        v_phone := '+' || v_phone;
      end if;

      if v_name is null or v_phone !~ '^\+91[0-9]{10}$' then
        raise exception 'Enter valid names and 10-digit mobile numbers for all four Corporate login contacts.';
      end if;

      if v_phone = any(v_seen_phones) then
        raise exception 'Each Corporate login contact must use a different mobile number.';
      end if;

      v_seen_phones := array_append(v_seen_phones, v_phone);
    end loop;
  end if;

  update public.customer_onboarding_applications
  set draft_data = v_draft,
      status = 'submitted',
      current_step = 4,
      submitted_at = now(),
      updated_at = now()
  where id = p_application_id
  returning * into v_application;

  return v_application;
end;
$$;

grant execute on function public.submit_group_associated_onboarding_application(uuid, jsonb) to authenticated;
