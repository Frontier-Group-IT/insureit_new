-- Harden role derivation and privileged RPC caller identity.
--
-- This migration deliberately keeps trusted service-role server flows working while
-- binding normal authenticated RPC calls to auth.uid(). The service-role compatibility
-- path is required by existing Next.js server actions that already validate the user
-- and then invoke selected RPCs through the server-only Supabase admin client.

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select profile.role
      from public.profiles as profile
      where profile.id = auth.uid()
        and profile.is_active
    ),
    'customer'::public.app_role
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role public.app_role;
  next_name text;
  next_phone text;
  next_email text;
begin
  -- app_metadata is server-controlled. Never trust user_metadata for authorization.
  next_role := coalesce(
    nullif(new.raw_app_meta_data ->> 'app_role', ''),
    'customer'
  )::public.app_role;

  next_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'New user');
  next_phone := coalesce(nullif(new.phone, ''), nullif(new.raw_user_meta_data ->> 'phone', ''), '');
  next_email := coalesce(nullif(new.email, ''), nullif(new.raw_user_meta_data ->> 'email', ''));

  insert into public.profiles (id, role, full_name, phone, email)
  values (new.id, next_role, next_name, nullif(next_phone, ''), next_email)
  on conflict (id) do update
  set
    -- Preserve an already-provisioned database role. Auth profile refreshes must never
    -- overwrite operational authorization with mutable identity metadata.
    role = public.profiles.role,
    full_name = case
      when public.profiles.full_name in ('', 'New user') then excluded.full_name
      else public.profiles.full_name
    end,
    phone = coalesce(nullif(public.profiles.phone, ''), excluded.phone),
    email = coalesce(public.profiles.email, excluded.email);

  return new;
end;
$$;

create or replace function public._effective_privileged_rpc_access(
  p_profile_id uuid,
  p_capability text
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_access text;
begin
  select profile.role::text
    into v_role
  from public.profiles as profile
  where profile.id = p_profile_id
    and profile.is_active;

  if v_role is null then
    return 'none';
  end if;

  if v_role = 'it_super_user' then
    return 'approve';
  end if;

  select override_row.access_level
    into v_access
  from public.employee_permission_overrides as override_row
  where override_row.profile_id = p_profile_id
    and override_row.capability = p_capability
    and override_row.access_level <> 'inherit'
    and (override_row.expires_at is null or override_row.expires_at > now())
  order by override_row.updated_at desc
  limit 1;

  if v_access is null then
    select override_row.access_level
      into v_access
    from public.role_permission_overrides as override_row
    where override_row.role = v_role
      and override_row.capability = p_capability
    order by override_row.updated_at desc
    limit 1;
  end if;

  if v_access is null then
    v_access := case p_capability
      when 'create_policies' then
        case when v_role in (
          'super_admin', 'admin', 'manager', 'it_super_user',
          'sales_operations_head', 'backoffice_executive'
        ) then 'edit' else 'none' end
      when 'approve_intermediary_application' then
        case when v_role in (
          'super_admin', 'admin', 'manager', 'it_super_user',
          'director', 'sales_operations_head'
        ) then 'approve' else 'none' end
      else 'none'
    end;
  end if;

  -- Keep the database guard aligned with the Backoffice permission ceiling used by
  -- the portal permission engine.
  if v_role = 'backoffice_executive' then
    if p_capability = 'create_policies' then
      if v_access = 'approve' then
        v_access := 'edit';
      end if;
    else
      v_access := 'none';
    end if;
  end if;

  if v_access not in ('none', 'view', 'edit', 'approve') then
    return 'none';
  end if;

  return v_access;
end;
$$;

revoke all on function public._effective_privileged_rpc_access(uuid, text) from public;
revoke all on function public._effective_privileged_rpc_access(uuid, text) from anon;
revoke all on function public._effective_privileged_rpc_access(uuid, text) from authenticated;

-- Preserve the existing booking implementation behind an internal function and expose
-- a guarded public wrapper. Renaming preserves the exact booking logic and dependencies.
alter function public.onboard_motor_policy(jsonb)
  rename to _onboard_motor_policy_unchecked;

revoke all on function public._onboard_motor_policy_unchecked(jsonb) from public;
revoke all on function public._onboard_motor_policy_unchecked(jsonb) from anon;
revoke all on function public._onboard_motor_policy_unchecked(jsonb) from authenticated;

create function public.onboard_motor_policy(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_actor_role text;
  v_access text;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_is_service_role boolean := coalesce(
    auth.jwt() ->> 'role',
    current_setting('request.jwt.claim.role', true),
    ''
  ) = 'service_role';
  v_can_transfer boolean := false;
begin
  if auth.uid() is not null then
    v_actor := auth.uid();
  elsif v_is_service_role then
    begin
      v_actor := nullif(v_payload #>> '{meta,requestedBy}', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'A valid requestedBy profile is required for trusted policy onboarding.';
    end;
  else
    raise exception 'Authentication is required for policy onboarding.';
  end if;

  if v_actor is null then
    raise exception 'Authenticated profile is required for policy onboarding.';
  end if;

  select profile.role::text
    into v_actor_role
  from public.profiles as profile
  where profile.id = v_actor
    and profile.is_active;

  if v_actor_role is null then
    raise exception 'Active portal profile is required for policy onboarding.';
  end if;

  v_access := public._effective_privileged_rpc_access(v_actor, 'create_policies');
  if v_access not in ('edit', 'approve') then
    raise exception 'Profile is not authorized to create policies.';
  end if;

  v_can_transfer := v_actor_role in ('manager', 'admin', 'super_admin', 'it_super_user');

  -- The database, not caller JSON, owns actor identity and transfer authority.
  v_payload := v_payload || jsonb_build_object(
    'meta', coalesce(v_payload -> 'meta', '{}'::jsonb) || jsonb_build_object(
      'requestedBy', v_actor::text,
      'requestedRole', v_actor_role
    )
  );
  v_payload := v_payload || jsonb_build_object(
    'resolution', coalesce(v_payload -> 'resolution', '{}'::jsonb) || jsonb_build_object(
      'canTransferOwnership', v_can_transfer
    )
  );

  return public._onboard_motor_policy_unchecked(v_payload);
end;
$$;

revoke all on function public.onboard_motor_policy(jsonb) from public;
revoke all on function public.onboard_motor_policy(jsonb) from anon;
grant execute on function public.onboard_motor_policy(jsonb) to authenticated;
grant execute on function public.onboard_motor_policy(jsonb) to service_role;

-- Apply the same caller-binding pattern to the legacy POSP/MISP customer activation RPC.
alter function public.approve_posp_misp_onboarding_application(uuid, uuid, uuid, uuid)
  rename to _approve_posp_misp_onboarding_application_unchecked;

revoke all on function public._approve_posp_misp_onboarding_application_unchecked(uuid, uuid, uuid, uuid) from public;
revoke all on function public._approve_posp_misp_onboarding_application_unchecked(uuid, uuid, uuid, uuid) from anon;
revoke all on function public._approve_posp_misp_onboarding_application_unchecked(uuid, uuid, uuid, uuid) from authenticated;

create function public.approve_posp_misp_onboarding_application(
  p_application_id uuid,
  p_reviewer_profile_id uuid,
  p_primary_profile_id uuid,
  p_secondary_profile_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_access text;
  v_is_service_role boolean := coalesce(
    auth.jwt() ->> 'role',
    current_setting('request.jwt.claim.role', true),
    ''
  ) = 'service_role';
begin
  if auth.uid() is not null then
    v_actor := auth.uid();
    if p_reviewer_profile_id is distinct from v_actor then
      raise exception 'Reviewer identity does not match the authenticated user.';
    end if;
  elsif v_is_service_role then
    v_actor := p_reviewer_profile_id;
  else
    raise exception 'Authentication is required to approve POSP/MISP applications.';
  end if;

  if v_actor is null then
    raise exception 'Reviewer profile is required to approve POSP/MISP applications.';
  end if;

  v_access := public._effective_privileged_rpc_access(v_actor, 'approve_intermediary_application');
  if v_access <> 'approve' then
    raise exception 'Reviewer is not authorized to approve POSP/MISP applications.';
  end if;

  return public._approve_posp_misp_onboarding_application_unchecked(
    p_application_id,
    v_actor,
    p_primary_profile_id,
    p_secondary_profile_id
  );
end;
$$;

revoke all on function public.approve_posp_misp_onboarding_application(uuid, uuid, uuid, uuid) from public;
revoke all on function public.approve_posp_misp_onboarding_application(uuid, uuid, uuid, uuid) from anon;
grant execute on function public.approve_posp_misp_onboarding_application(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.approve_posp_misp_onboarding_application(uuid, uuid, uuid, uuid) to service_role;

comment on function public.current_app_role() is
  'Returns the active database profile role for auth.uid(); JWT user metadata is never an authorization source.';
comment on function public.onboard_motor_policy(jsonb) is
  'Authenticated policy onboarding boundary that derives actor identity and ownership-transfer authority server-side.';
comment on function public.approve_posp_misp_onboarding_application(uuid, uuid, uuid, uuid) is
  'Authenticated POSP/MISP approval boundary that binds reviewer identity and effective approval capability.';
