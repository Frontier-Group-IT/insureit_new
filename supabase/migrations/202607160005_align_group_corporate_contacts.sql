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
  v_allowed boolean := false;
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

  select exists (
    select 1
    from public.get_accessible_customer_contexts() context_row
    where context_row.customer_id = v_application.group_customer_id
      and context_row.partner_type = 'group'
      and context_row.access_source = 'direct'
      and coalesce(context_row.membership_role, '') in (
        'owner',
        'admin',
        'manager',
        'group_owner',
        'group_admin'
      )
  ) into v_allowed;

  if not v_allowed then
    raise exception 'You do not have permission to add customers to this Group';
  end if;

  update public.customer_onboarding_applications
  set draft_data = p_draft_data,
      status = 'in_progress',
      current_step = greatest(current_step, 4),
      updated_at = now()
  where id = p_application_id
  returning * into v_application;

  if v_application.partner_type = 'corporate' then
    perform public.sync_group_corporate_onboarding_contacts(
      p_application_id,
      p_draft_data
    );
  end if;

  update public.customer_onboarding_applications
  set status = 'submitted',
      submitted_at = now(),
      updated_at = now()
  where id = p_application_id
  returning * into v_application;

  return v_application;
end;
$$;

grant execute on function public.submit_group_associated_onboarding_application(uuid, jsonb) to authenticated;

-- Backfill existing Group-created Corporate applications so the portal review page
-- reads the same three contact rows created by the website onboarding flow.
do $$
declare
  v_application record;
begin
  for v_application in
    select id, draft_data
    from public.customer_onboarding_applications
    where partner_type = 'corporate'
      and group_customer_id is not null
      and status in ('in_progress', 'submitted', 'under_review', 'changes_requested')
      and nullif(btrim(draft_data->>'ceo_head_name'), '') is not null
      and nullif(btrim(draft_data->>'admin_head_name'), '') is not null
      and nullif(btrim(draft_data->>'dedicated_spoc_name'), '') is not null
  loop
    perform public.sync_group_corporate_onboarding_contacts(
      v_application.id,
      v_application.draft_data
    );
  end loop;
end;
$$;