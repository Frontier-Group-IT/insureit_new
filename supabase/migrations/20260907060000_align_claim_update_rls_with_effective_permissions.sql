-- Align claim UPDATE authorization with the portal's effective manage_claims permission model.
-- This keeps existing hierarchy/customer-scoped access intact while allowing an
-- explicit organization-scoped manage_claims grant to update managed claim rows.

create or replace function public.can_update_claim_status()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select p.id, p.role::text as role
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active
  ),
  employee_override as (
    select epo.access_level, epo.scope_type
    from public.employee_permission_overrides epo
    join me on me.id = epo.profile_id
    where epo.capability = 'manage_claims'
      and (epo.expires_at is null or epo.expires_at > now())
    order by epo.updated_at desc nulls last, epo.created_at desc nulls last
    limit 1
  ),
  role_override as (
    select rpo.access_level, rpo.scope_type
    from public.role_permission_overrides rpo
    join me on me.role = rpo.role
    where rpo.capability = 'manage_claims'
    order by rpo.updated_at desc nulls last, rpo.created_at desc nulls last
    limit 1
  )
  select coalesce((
    select case
      -- Match the application-side permission ceiling: Backoffice cannot be
      -- elevated into claim editing through an override.
      when me.role = 'backoffice_executive' then false
      when exists (select 1 from employee_override where access_level <> 'inherit') then
        exists (select 1 from employee_override where access_level in ('edit', 'approve'))
      when exists (select 1 from role_override) then
        exists (select 1 from role_override where access_level in ('edit', 'approve'))
      else me.role in (
        'super_admin',
        'admin',
        'it_super_user',
        'manager',
        'sales_operations_head',
        'claims_head',
        'claim_processor'
      )
    end
    from me
  ), false);
$$;

create or replace function public.can_manage_claims_organization()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select p.id, p.role::text as role
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active
  ),
  employee_override as (
    select epo.access_level, epo.scope_type
    from public.employee_permission_overrides epo
    join me on me.id = epo.profile_id
    where epo.capability = 'manage_claims'
      and (epo.expires_at is null or epo.expires_at > now())
    order by epo.updated_at desc nulls last, epo.created_at desc nulls last
    limit 1
  ),
  role_override as (
    select rpo.access_level, rpo.scope_type
    from public.role_permission_overrides rpo
    join me on me.role = rpo.role
    where rpo.capability = 'manage_claims'
    order by rpo.updated_at desc nulls last, rpo.created_at desc nulls last
    limit 1
  )
  select coalesce((
    select case
      when me.role = 'backoffice_executive' then false
      when exists (select 1 from employee_override where access_level <> 'inherit') then
        exists (
          select 1
          from employee_override
          where access_level in ('edit', 'approve')
            and scope_type = 'organization'
        )
      when exists (select 1 from role_override) then
        exists (
          select 1
          from role_override
          where access_level in ('edit', 'approve')
            and scope_type = 'organization'
        )
      -- IT Super User is the protected organization-wide role in the portal
      -- permission model.
      else me.role = 'it_super_user'
    end
    from me
  ), false);
$$;

revoke all on function public.can_update_claim_status() from public;
grant execute on function public.can_update_claim_status() to authenticated;
grant execute on function public.can_update_claim_status() to service_role;

revoke all on function public.can_manage_claims_organization() from public;
grant execute on function public.can_manage_claims_organization() to authenticated;
grant execute on function public.can_manage_claims_organization() to service_role;

-- Existing scoped UPDATE policies continue to apply. This additional policy only
-- opens the row when the effective manage_claims permission is explicitly
-- organization-scoped, which is the same scope the portal uses for full claim
-- editing across Operations.
drop policy if exists "claims effective manage claims organization update" on public.claims;
create policy "claims effective manage claims organization update"
on public.claims
for update
to authenticated
using (public.can_manage_claims_organization())
with check (public.can_manage_claims_organization());
