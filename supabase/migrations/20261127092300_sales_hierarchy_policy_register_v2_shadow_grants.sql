-- Additive shadow-RBAC alignment for Policy Register viewers in the RM reporting hierarchy.
-- Keep the original Phase 4 foundation seed immutable. Production currently uses
-- legacy effective permissions; the three approved role overrides are applied separately.
do $policy_register_shadow$
begin
  if to_regclass('public.access_role_permissions_v2') is not null
     and to_regclass('public.access_roles_v2') is not null
     and to_regclass('public.access_permissions_v2') is not null then
    insert into public.access_role_permissions_v2
      (role_id,permission_id,access_level,scope_type,is_active,reason)
    select r.id, p.id, 'view', 'hierarchy', true,
      'Approved Policy Register read-only RM supervisor hierarchy access 2026-11-27'
    from (values
      ('relationship_manager','policies.view','view','self'),
      ('zonal_head','policies.view','view','hierarchy'),
      ('asm','policies.view','view','hierarchy'),
      ('sales_manager','policies.view','view','hierarchy')
    ) as role_grants(role_code,permission_key,access_level,scope_type)
    join public.access_roles_v2 r on r.code = role_grants.role_code
    join public.access_permissions_v2 p on p.permission_key = role_grants.permission_key
    where 'view' = any(p.allowed_access_levels)
      and 'hierarchy' = any(p.allowed_scopes)
    on conflict (role_id,permission_id) do update set
      access_level = excluded.access_level,
      scope_type = excluded.scope_type,
      is_active = true,
      reason = excluded.reason,
      updated_at = now();
  end if;
end;
$policy_register_shadow$;
