-- Optional shadow RBAC correction for Claims Head.
-- Production currently runs legacy permission tables; V2 shadow tables may not exist.
-- No change to authoritative legacy permissions.
do $claims_head_shadow$
begin
  if to_regclass('public.access_role_permissions_v2') is not null
     and to_regclass('public.access_roles_v2') is not null
     and to_regclass('public.access_permissions_v2') is not null then
    delete from public.access_role_permissions_v2 rp
    using public.access_roles_v2 r, public.access_permissions_v2 p
    where rp.role_id = r.id and rp.permission_id = p.id
      and r.code = 'claims_head'
      and p.permission_key in ('dashboard.view','tasks.view','tasks.create','tasks.assign','tasks.edit');
  end if;
end;
$claims_head_shadow$;

-- Rollback: restore these five Claims Head grants from the immutable Phase 4 seed.
