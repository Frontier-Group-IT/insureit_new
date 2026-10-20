-- Optional: apply only where Access Control V2 shadow tables have been installed.
-- Shadow Access Control V2 registration for the operational IT User role.
-- Existing primary IT Super User remains the sole holder of identity administration
-- and protected system integration configuration.

insert into public.access_roles_v2
(code,label,purpose,category,status,assignable,protected,default_scope,is_active)
values
('it_user','IT User','Technical operational access without protected administrator identity, role or integration control.','technical','active',true,false,'organization',true)
on conflict (code) do update set
 label=excluded.label,purpose=excluded.purpose,category=excluded.category,
 status=excluded.status,assignable=excluded.assignable,protected=excluded.protected,
 default_scope=excluded.default_scope,is_active=true,updated_at=now();

insert into public.access_role_permissions_v2
(role_id,permission_id,access_level,scope_type,is_active,reason)
select it.id,rp.permission_id,rp.access_level,rp.scope_type,true,'IT User operational role parity'
from public.access_role_permissions_v2 rp
join public.access_roles_v2 old_role on old_role.id=rp.role_id and old_role.code='it_super_user'
join public.access_roles_v2 it on it.code='it_user'
join public.access_permissions_v2 permission on permission.id=rp.permission_id
where rp.is_active=true
and permission.permission_key not in
('admin.portal_users.manage','admin.roles.manage','admin.permissions.manage','system.integrations.configure')
on conflict (role_id,permission_id) do update set
 access_level=excluded.access_level,scope_type=excluded.scope_type,is_active=true,
 reason=excluded.reason,updated_at=now();

do $$
begin
 if exists (
  select 1 from public.access_role_permissions_v2 rp
  join public.access_roles_v2 r on r.id=rp.role_id
  join public.access_permissions_v2 p on p.id=rp.permission_id
  where r.code='it_user' and rp.is_active
    and p.permission_key in ('admin.portal_users.manage','admin.roles.manage','admin.permissions.manage','system.integrations.configure')
 ) then
   raise exception 'IT User cannot receive protected identity and integration privileges';
 end if;
end $$;
