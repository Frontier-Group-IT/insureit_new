-- Harden associated-onboarding manager checks and direct Corporate contact synchronization.

begin;

create or replace function public.can_manage_group_associated_onboarding(
  p_group_customer_id uuid,
  p_profile_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    p_profile_id is not null
    and (
      p_profile_id = auth.uid()
      or coalesce(
        auth.jwt() ->> 'role',
        current_setting('request.jwt.claim.role', true),
        ''
      ) = 'service_role'
    )
    and (
      exists (
        select 1
        from public.customers customer
        where customer.id = p_group_customer_id
          and customer.partner_type in ('group', 'corporate', 'dealership')
          and customer.onboarding_status = 'active'
          and customer.profile_id = p_profile_id
      )
      or exists (
        select 1
        from public.customer_memberships membership
        join public.customers customer
          on customer.id = membership.customer_id
        where membership.customer_id = p_group_customer_id
          and customer.partner_type in ('group', 'corporate', 'dealership')
          and customer.onboarding_status = 'active'
          and membership.profile_id = p_profile_id
          and membership.status = 'active'
          and coalesce(membership.membership_role, '') in (
            'owner',
            'admin',
            'manager',
            'group_owner',
            'group_admin',
            'corporate_creator',
            'ceo_head',
            'admin_head',
            'dedicated_spoc',
            'dealership_owner'
          )
      )
    );
$$;

create or replace function public.can_manage_customer_associated_onboarding(
  p_parent_customer_id uuid,
  p_profile_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.can_manage_group_associated_onboarding(
    p_parent_customer_id,
    p_profile_id
  );
$$;

create or replace function public.sync_group_corporate_onboarding_contacts(
  p_application_id uuid,
  p_draft_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.customer_onboarding_applications%rowtype;
  v_is_service_role boolean :=
    coalesce(auth.jwt() ->> 'role', current_setting('request.jwt.claim.role', true), '') = 'service_role';
  v_ceo_name text := nullif(btrim(p_draft_data->>'ceo_head_name'), '');
  v_ceo_phone text := regexp_replace(coalesce(p_draft_data->>'ceo_head_mobile', ''), '\D', '', 'g');
  v_ceo_email text := nullif(lower(btrim(p_draft_data->>'ceo_head_email')), '');
  v_admin_name text := nullif(btrim(p_draft_data->>'admin_head_name'), '');
  v_admin_phone text := regexp_replace(coalesce(p_draft_data->>'admin_head_mobile', ''), '\D', '', 'g');
  v_admin_email text := nullif(lower(btrim(p_draft_data->>'admin_head_email')), '');
  v_spoc_name text := nullif(btrim(p_draft_data->>'dedicated_spoc_name'), '');
  v_spoc_phone text := regexp_replace(coalesce(p_draft_data->>'dedicated_spoc_mobile', ''), '\D', '', 'g');
  v_spoc_email text := nullif(lower(btrim(p_draft_data->>'dedicated_spoc_email')), '');
begin
  select *
    into v_application
  from public.customer_onboarding_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Corporate onboarding application is unavailable.';
  end if;

  if v_application.partner_type <> 'corporate' then
    raise exception 'Corporate login contacts can only be updated for Corporate onboarding.';
  end if;

  if v_application.status not in ('not_started', 'in_progress', 'changes_requested') then
    raise exception 'This onboarding application is no longer editable.';
  end if;

  if not v_is_service_role
     and (
       auth.uid() is null
       or not (
         v_application.profile_id = auth.uid()
         or (
           v_application.group_customer_id is not null
           and public.can_manage_group_associated_onboarding(
             v_application.group_customer_id,
             auth.uid()
           )
         )
       )
     ) then
    raise exception 'You cannot update Corporate login contacts for this onboarding application.';
  end if;

  if v_ceo_name is null or v_admin_name is null or v_spoc_name is null then
    raise exception 'All three Corporate login contacts are required.';
  end if;

  if length(v_ceo_phone) = 10 then v_ceo_phone := '+91' || v_ceo_phone; end if;
  if length(v_admin_phone) = 10 then v_admin_phone := '+91' || v_admin_phone; end if;
  if length(v_spoc_phone) = 10 then v_spoc_phone := '+91' || v_spoc_phone; end if;

  if v_ceo_phone !~ '^\+91[0-9]{10}$'
     or v_admin_phone !~ '^\+91[0-9]{10}$'
     or v_spoc_phone !~ '^\+91[0-9]{10}$' then
    raise exception 'Enter valid 10-digit mobile numbers for all Corporate login contacts.';
  end if;

  if v_ceo_phone = v_admin_phone
     or v_ceo_phone = v_spoc_phone
     or v_admin_phone = v_spoc_phone then
    raise exception 'Each Corporate login contact must use a different mobile number.';
  end if;

  delete from public.customer_onboarding_contacts
  where application_id = p_application_id
    and contact_role in ('ceo_head', 'admin_head', 'dedicated_spoc');

  insert into public.customer_onboarding_contacts (
    application_id,
    contact_role,
    full_name,
    phone,
    email,
    login_required
  ) values
    (p_application_id, 'ceo_head', v_ceo_name, v_ceo_phone, v_ceo_email, true),
    (p_application_id, 'admin_head', v_admin_name, v_admin_phone, v_admin_email, true),
    (p_application_id, 'dedicated_spoc', v_spoc_name, v_spoc_phone, v_spoc_email, true);

  update public.customer_onboarding_applications
  set applicant_phone = v_spoc_phone,
      applicant_email = v_spoc_email,
      draft_data = jsonb_set(
        coalesce(draft_data, '{}'::jsonb),
        '{login_contact_count}',
        '3'::jsonb,
        true
      ),
      updated_at = now()
  where id = p_application_id;
end;
$$;

commit;
