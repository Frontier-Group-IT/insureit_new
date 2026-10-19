-- Shadow RBAC least-privilege correction for Claims Head.
-- Do not mutate the original Phase 4 historical seed.
-- No effect on authoritative legacy role resolution or existing employee access.
-- Keep claims and claim-report grants; remove general dashboard/task grants.
delete from public.access_role_permissions_v2 rp
using public.access_roles_v2 r, public.access_permissions_v2 p
where rp.role_id = r.id and rp.permission_id = p.id
  and r.code = 'claims_head'
  and p.permission_key in ('dashboard.view','tasks.view','tasks.create','tasks.assign','tasks.edit');
-- Reversal: restore these exact five grants from the immutable Phase 4 seed
-- before reversing the application role restriction.
