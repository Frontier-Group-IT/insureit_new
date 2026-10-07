-- Harden authenticated SECURITY DEFINER helpers that previously trusted caller-supplied
-- actor/viewer identifiers. Normal signed-in callers are now bound to auth.uid();
-- service_role retains server-side scoped execution where existing workflows require it.

begin;

create or replace function public.assert_group_relationship_manager(actor_profile_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_active boolean;
  is_service_role boolean :=
    coalesce(auth.jwt() ->> 'role', current_setting('request.jwt.claim.role', true), '') = 'service_role';
begin
  if actor_profile_id is null then
    raise exception 'A reviewer profile is required to manage Group affiliations.';
  end if;

  if not is_service_role and actor_profile_id is distinct from auth.uid() then
    raise exception 'The reviewer profile does not match the authenticated user.';
  end if;

  select role::text, is_active
    into actor_role, actor_active
  from public.profiles
  where id = actor_profile_id;

  if not coalesce(actor_active, false)
     or actor_role not in (
       'super_admin', 'admin', 'manager', 'it_super_user',
       'sales_operations_head', 'backoffice_executive'
     ) then
    raise exception 'You are not allowed to manage Group affiliations.';
  end if;
end;
$$;

create or replace function public.get_user_downline(root_user_id uuid)
returns table(profile_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with recursive downline as (
    select p.id
    from public.profiles p
    where p.id = root_user_id
      and (
        root_user_id = auth.uid()
        or coalesce(
          auth.jwt() ->> 'role',
          current_setting('request.jwt.claim.role', true),
          ''
        ) = 'service_role'
      )

    union all

    select child.id
    from public.profiles child
    join downline parent on child.reporting_manager_id = parent.id
    where child.is_active = true
  )
  select id from downline;
$$;

create or replace function public.can_access_customer(viewer_id uuid, target_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    viewer_id is not null
    and target_customer_id is not null
    and (
      viewer_id = auth.uid()
      or coalesce(
        auth.jwt() ->> 'role',
        current_setting('request.jwt.claim.role', true),
        ''
      ) = 'service_role'
    )
    and (
      public.can_access_full_business_data()
      or exists (
        select 1
        from public.customers c
        where c.id = target_customer_id
          and c.profile_id = viewer_id
      )
      or exists (
        select 1
        from public.customers c
        where c.id = target_customer_id
          and c.assigned_agent_id in (
            select profile_id from public.get_user_downline(viewer_id)
          )
      )
    );
$$;

create or replace function public.can_access_claim(viewer_id uuid, target_claim_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    viewer_id is not null
    and (
      viewer_id = auth.uid()
      or coalesce(
        auth.jwt() ->> 'role',
        current_setting('request.jwt.claim.role', true),
        ''
      ) = 'service_role'
    )
    and exists (
      select 1
      from public.claims c
      where c.id = target_claim_id
        and public.can_access_customer(viewer_id, c.customer_id)
    );
$$;

create or replace function public.can_access_policy(viewer_id uuid, target_policy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    viewer_id is not null
    and (
      viewer_id = auth.uid()
      or coalesce(
        auth.jwt() ->> 'role',
        current_setting('request.jwt.claim.role', true),
        ''
      ) = 'service_role'
    )
    and exists (
      select 1
      from public.policies p
      where p.id = target_policy_id
        and public.can_access_customer(viewer_id, p.customer_id)
    );
$$;

create or replace function public.can_access_profile(viewer_id uuid, target_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_role text;
  target_role text;
  is_service_role boolean :=
    coalesce(auth.jwt() ->> 'role', current_setting('request.jwt.claim.role', true), '') = 'service_role';
begin
  if viewer_id is null or target_profile_id is null then
    return false;
  end if;

  if not is_service_role and viewer_id is distinct from auth.uid() then
    return false;
  end if;

  if viewer_id = target_profile_id then
    return true;
  end if;

  select role::text into viewer_role
  from public.profiles
  where id = viewer_id
    and is_active = true;

  select role::text into target_role
  from public.profiles
  where id = target_profile_id;

  if viewer_role is null then
    return false;
  end if;

  if viewer_role in ('it_super_user', 'admin', 'super_admin') then
    return true;
  end if;

  if viewer_role in ('sales_operations_head', 'backoffice_executive')
     and target_role = 'agent' then
    return true;
  end if;

  if viewer_role = 'director' then
    return coalesce(target_role, '') not in ('it_super_user', 'admin', 'super_admin');
  end if;

  if viewer_role = 'customer' then
    return false;
  end if;

  return exists (
    select 1
    from public.get_user_downline(viewer_id) d
    where d.profile_id = target_profile_id
  );
end;
$$;

create or replace function public.can_view_customer_via_intermediary(
  viewer_id uuid,
  target_customer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with downline_profiles as (
    select profile_id
    from public.get_user_downline(viewer_id)
    where
      viewer_id = auth.uid()
      or coalesce(
        auth.jwt() ->> 'role',
        current_setting('request.jwt.claim.role', true),
        ''
      ) = 'service_role'
  ),
  downline_employees as (
    select p.employee_id
    from public.profiles p
    join downline_profiles d on d.profile_id = p.id
    where p.employee_id is not null
  )
  select
    viewer_id is not null
    and target_customer_id is not null
    and (
      viewer_id = auth.uid()
      or coalesce(
        auth.jwt() ->> 'role',
        current_setting('request.jwt.claim.role', true),
        ''
      ) = 'service_role'
    )
    and exists (
      select 1
      from public.intermediary_customer_links link
      join public.intermediaries i on i.id = link.intermediary_id
      where link.customer_id = target_customer_id
        and link.relationship_type = 'referred_customer'
        and (
          i.associate_profile_id in (select profile_id from downline_profiles)
          or i.associate_employee_id in (select employee_id from downline_employees)
        )
    );
$$;

-- Preserve possible signed-in Operations usage of the queue, but enforce its actual
-- management capability inside the SECURITY DEFINER body.
create or replace function public.get_intermediary_application_queue(
  p_query text default null,
  p_requested_type text default null,
  p_status text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table(
  id uuid,
  partner_type text,
  source text,
  status text,
  applicant_phone text,
  applicant_name text,
  city text,
  external_onboarding_id text,
  document_count bigint,
  age_days integer,
  updated_at timestamptz,
  total_count bigint
)
language sql
security definer
set search_path = public
as $$
  with filtered as (
    select
      app.id,
      app.requested_type as partner_type,
      app.source,
      app.status,
      app.applicant_phone,
      coalesce(profile.pos_name, profile.misp_name, profile.dp_name) as applicant_name,
      profile.city,
      profile.external_onboarding_id,
      count(document.id)::bigint as document_count,
      greatest(0, floor(extract(epoch from (now() - app.updated_at)) / 86400))::integer as age_days,
      app.updated_at
    from public.intermediary_onboarding_applications app
    left join public.posp_misp_onboarding_profiles profile
      on profile.application_id = app.id
    left join public.intermediary_onboarding_documents document
      on document.application_id = app.id
    where public.can_manage_posp_misp_onboarding()
      and (p_requested_type is null or p_requested_type = '' or app.requested_type = p_requested_type)
      and (p_status is null or p_status = '' or app.status = p_status)
      and (
        p_query is null
        or p_query = ''
        or coalesce(profile.pos_name, '') ilike '%' || p_query || '%'
        or coalesce(profile.misp_name, '') ilike '%' || p_query || '%'
        or coalesce(app.applicant_phone, '') ilike '%' || p_query || '%'
        or coalesce(profile.external_onboarding_id, '') ilike '%' || p_query || '%'
      )
    group by
      app.id,
      profile.pos_name,
      profile.misp_name,
      profile.dp_name,
      profile.city,
      profile.external_onboarding_id
  ),
  numbered as (
    select filtered.*, count(*) over() as total_count
    from filtered
    order by updated_at desc
    offset greatest(0, (greatest(1, p_page) - 1) * greatest(1, p_page_size))
    limit least(greatest(1, p_page_size), 200)
  )
  select * from numbered;
$$;

-- Internal maintenance/event helpers are not signed-in browser APIs.
revoke all on function public.insert_customer_activity_event(
  uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.insert_customer_activity_event(
  uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, text, jsonb
) to service_role;

revoke all on function public.sync_existing_intermediary_migration(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.sync_existing_intermediary_migration(uuid, uuid, jsonb, text)
  to service_role;

revoke all on function public.repair_legacy_partner_record_link(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.repair_legacy_partner_record_link(uuid, uuid)
  to service_role;

revoke all on function public.resolve_intermediary_partner_record_id(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_intermediary_partner_record_id(uuid)
  to service_role;

revoke all on function public.sync_external_customer_stage_to_operations(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.sync_external_customer_stage_to_operations(uuid, uuid)
  to service_role;

commit;
