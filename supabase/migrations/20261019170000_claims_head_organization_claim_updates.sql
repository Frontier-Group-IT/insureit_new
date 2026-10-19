-- Reversible Claims Head organization-wide claim update authorization.
-- Preserves employee > role override deny/allow precedence from the current function.
-- Claims Head is only a default when neither active employee nor role override exists.
-- Does not add access to customer, policy, accounts, admin or other unrelated tables.
-- Apply only after claims-specific API, report, scope, and RLS regression acceptance.

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
      else me.role in ('it_super_user', 'claims_head')
    end
    from me
  ), false);
$$;


-- Rollback: restore public.can_manage_claims_organization() from
-- supabase/migrations/20260907060000_align_claim_update_rls_with_effective_permissions.sql.
