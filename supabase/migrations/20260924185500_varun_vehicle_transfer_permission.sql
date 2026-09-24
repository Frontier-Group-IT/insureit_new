-- Grant Varun Sabharwal explicit organization-wide vehicle edit access.
-- Vehicle Transfer remains protected by the transfer-role gate plus effective view_vehicles=edit permission.

insert into public.employee_permission_overrides (
  profile_id,
  capability,
  access_level,
  scope_type,
  reason,
  expires_at,
  created_by,
  updated_by
)
select
  p.id,
  'view_vehicles',
  'edit',
  'organization',
  'Explicit Vehicle Transfer access for Varun Sabharwal',
  null,
  null,
  null
from public.profiles p
where lower(coalesce(p.email, '')) = 'varun.sabharwal@insureit.in'
  and p.is_active = true
on conflict (profile_id, capability)
do update set
  access_level = excluded.access_level,
  scope_type = excluded.scope_type,
  reason = excluded.reason,
  expires_at = excluded.expires_at,
  updated_at = now();

do $$
begin
  if not exists (
    select 1
    from public.employee_permission_overrides epo
    join public.profiles p on p.id = epo.profile_id
    where lower(coalesce(p.email, '')) = 'varun.sabharwal@insureit.in'
      and epo.capability = 'view_vehicles'
      and epo.access_level in ('edit', 'approve')
      and epo.scope_type = 'organization'
      and (epo.expires_at is null or epo.expires_at > now())
  ) then
    raise exception 'Varun Sabharwal vehicle permission override was not created.';
  end if;
end
$$;
