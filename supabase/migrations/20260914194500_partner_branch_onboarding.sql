-- Reversible Partner Branch onboarding foundation
--
-- Safety:
-- - Existing Partner, POSP, MISP, Group and Employee-assignment data is untouched.
-- - Only Branches created through the dedicated onboarding flow are registered here.
-- - Assign Branch can therefore distinguish true Branch profiles from ordinary Partner/POSP/MISP records.
-- - Existing parent_partner_id relationships continue to work and are not backfilled.

begin;

create table if not exists public.partner_branch_profiles (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references public.partners(id) on delete restrict,
  source_application_id uuid not null unique references public.intermediary_onboarding_applications(id) on delete restrict,
  branch_name text not null,
  contact_name text not null,
  phone text not null,
  email text not null,
  address text not null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_branch_profiles_branch_name_check check (length(btrim(branch_name)) between 2 and 120),
  constraint partner_branch_profiles_contact_name_check check (length(btrim(contact_name)) between 2 and 120),
  constraint partner_branch_profiles_phone_check check (length(regexp_replace(phone, '[^0-9]', '', 'g')) between 7 and 15),
  constraint partner_branch_profiles_email_check check (position('@' in email) > 1),
  constraint partner_branch_profiles_address_check check (length(btrim(address)) between 3 and 500)
);

create index if not exists partner_branch_profiles_branch_name_idx
  on public.partner_branch_profiles (lower(branch_name));

create or replace function public.service_create_partner_branch_profile(
  p_branch_name text,
  p_phone text,
  p_email text,
  p_contact_name text,
  p_address text,
  p_parent_partner_id uuid,
  p_actor_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_application_id uuid;
  v_branch_partner_id uuid;
  v_branch_name text := nullif(btrim(p_branch_name), '');
  v_phone text := nullif(btrim(p_phone), '');
  v_email text := nullif(lower(btrim(p_email)), '');
  v_contact_name text := nullif(btrim(p_contact_name), '');
  v_address text := nullif(btrim(p_address), '');
begin
  if v_branch_name is null then raise exception 'Branch name is required.'; end if;
  if v_phone is null then raise exception 'Phone number is required.'; end if;
  if v_email is null or position('@' in v_email) <= 1 then raise exception 'A valid email is required.'; end if;
  if v_contact_name is null then raise exception 'Contact name is required.'; end if;
  if v_address is null then raise exception 'Address is required.'; end if;

  if not exists (
    select 1
    from public.partners parent
    where parent.id = p_parent_partner_id
      and parent.partner_status = 'active_partner'
      and parent.parent_partner_id is null
      and not exists (
        select 1 from public.partner_branch_profiles branch_profile where branch_profile.partner_id = parent.id
      )
  ) then
    raise exception 'Tag to a Partner requires an active root Partner.';
  end if;

  insert into public.intermediary_onboarding_applications (
    initiated_by,
    source,
    requested_type,
    final_type,
    status,
    current_step,
    applicant_phone,
    applicant_email,
    draft_data,
    submitted_at,
    reviewed_by,
    reviewed_at,
    completed_at,
    registration_status,
    partner_status,
    partner_activated_at
  ) values (
    p_actor_profile_id,
    'branch_onboarding',
    'partner',
    'partner',
    'approved',
    1,
    v_phone,
    v_email,
    jsonb_build_object(
      'workflow', 'branch_onboarding',
      'branch_name', v_branch_name,
      'contact_name', v_contact_name,
      'address', v_address,
      'parent_partner_id', p_parent_partner_id
    ),
    now(),
    p_actor_profile_id,
    now(),
    now(),
    'partner_active',
    'active_partner',
    now()
  )
  returning id into v_application_id;

  insert into public.partners (
    partner_code,
    partner_kind,
    display_name,
    legal_name,
    mobile,
    email,
    partner_status,
    portal_access_status,
    source_application_id,
    parent_partner_id,
    created_by
  ) values (
    public.next_partner_code(),
    'business',
    v_branch_name,
    v_branch_name,
    v_phone,
    v_email,
    'active_partner',
    'not_created',
    v_application_id,
    p_parent_partner_id,
    p_actor_profile_id
  )
  returning id into v_branch_partner_id;

  insert into public.partner_branch_profiles (
    partner_id,
    source_application_id,
    branch_name,
    contact_name,
    phone,
    email,
    address,
    created_by,
    updated_by
  ) values (
    v_branch_partner_id,
    v_application_id,
    v_branch_name,
    v_contact_name,
    v_phone,
    v_email,
    v_address,
    p_actor_profile_id,
    p_actor_profile_id
  );

  update public.intermediary_onboarding_applications
  set partner_record_id = v_branch_partner_id,
      updated_at = now()
  where id = v_application_id;

  insert into public.audit_logs(actor_id, action, table_name, record_id, new_data)
  values (
    p_actor_profile_id,
    'partner_branch_profile_created',
    'partners',
    v_branch_partner_id,
    jsonb_build_object(
      'source_application_id', v_application_id,
      'parent_partner_id', p_parent_partner_id,
      'branch_name', v_branch_name
    )
  );

  return v_branch_partner_id;
end;
$function$;

create or replace function public.service_assign_registered_partner_branch(
  p_parent_partner_id uuid,
  p_branch_partner_id uuid,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_parent_partner_id = p_branch_partner_id then
    raise exception 'A Partner cannot be its own Branch parent.';
  end if;

  if not exists (
    select 1
    from public.partners parent
    where parent.id = p_parent_partner_id
      and parent.partner_status = 'active_partner'
      and parent.parent_partner_id is null
      and not exists (
        select 1 from public.partner_branch_profiles branch_profile where branch_profile.partner_id = parent.id
      )
  ) then
    raise exception 'Branch parent must be an active root Partner.';
  end if;

  if not exists (
    select 1
    from public.partners branch
    join public.partner_branch_profiles branch_profile on branch_profile.partner_id = branch.id
    where branch.id = p_branch_partner_id
      and branch.partner_status = 'active_partner'
      and branch.parent_partner_id is null
  ) then
    raise exception 'Select an unassigned Branch profile created through Branch Onboarding.';
  end if;

  if exists (
    select 1 from public.intermediary_group_memberships membership
    where membership.partner_id = p_branch_partner_id
      and membership.effective_to is null
  ) then
    raise exception 'A directly grouped Partner cannot be assigned as a Branch.';
  end if;

  update public.partners
  set parent_partner_id = p_parent_partner_id,
      updated_at = now()
  where id = p_branch_partner_id;

  update public.partner_branch_profiles
  set updated_by = p_actor_profile_id,
      updated_at = now()
  where partner_id = p_branch_partner_id;

  insert into public.audit_logs(actor_id, action, table_name, record_id, new_data)
  values (
    p_actor_profile_id,
    'registered_partner_branch_assigned',
    'partners',
    p_branch_partner_id,
    jsonb_build_object('parent_partner_id', p_parent_partner_id)
  );
end;
$function$;

-- Data-level rollback for a newly created Branch profile. It succeeds only while
-- the Branch is still empty; any downstream FK usage safely blocks deletion.
create or replace function public.service_delete_empty_partner_branch_profile(
  p_branch_partner_id uuid,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_application_id uuid;
begin
  select branch_profile.source_application_id
    into v_application_id
  from public.partner_branch_profiles branch_profile
  join public.partners branch on branch.id = branch_profile.partner_id
  where branch_profile.partner_id = p_branch_partner_id
  for update;

  if not found then
    raise exception 'Branch profile not found.';
  end if;

  if exists (
    select 1 from public.intermediary_group_memberships membership
    where membership.partner_id = p_branch_partner_id
  ) then
    raise exception 'Branch has Group membership history and cannot be deleted.';
  end if;

  if exists (
    select 1 from public.partners child where child.parent_partner_id = p_branch_partner_id
  ) then
    raise exception 'Branch owns child records and cannot be deleted.';
  end if;

  update public.intermediary_onboarding_applications
  set partner_record_id = null,
      updated_at = now()
  where id = v_application_id;

  delete from public.partner_branch_profiles where partner_id = p_branch_partner_id;
  delete from public.partners where id = p_branch_partner_id;
  delete from public.intermediary_onboarding_applications where id = v_application_id;

  insert into public.audit_logs(actor_id, action, table_name, record_id, old_data)
  values (
    p_actor_profile_id,
    'empty_partner_branch_profile_deleted',
    'partners',
    p_branch_partner_id,
    jsonb_build_object('source_application_id', v_application_id)
  );
end;
$function$;

revoke all on table public.partner_branch_profiles from anon, authenticated;
grant select, insert, update, delete on table public.partner_branch_profiles to service_role;

revoke execute on function public.service_create_partner_branch_profile(text,text,text,text,text,uuid,uuid) from public, anon, authenticated;
revoke execute on function public.service_assign_registered_partner_branch(uuid,uuid,uuid) from public, anon, authenticated;
revoke execute on function public.service_delete_empty_partner_branch_profile(uuid,uuid) from public, anon, authenticated;

grant execute on function public.service_create_partner_branch_profile(text,text,text,text,text,uuid,uuid) to service_role;
grant execute on function public.service_assign_registered_partner_branch(uuid,uuid,uuid) to service_role;
grant execute on function public.service_delete_empty_partner_branch_profile(uuid,uuid) to service_role;

commit;
