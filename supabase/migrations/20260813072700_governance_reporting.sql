create or replace function public.get_governance_report(
  p_from_date date default null,
  p_to_date date default null,
  p_action text default null,
  p_page integer default 1,
  p_page_size integer default 25
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page integer := greatest(coalesce(p_page,1),1);
  v_page_size integer := least(greatest(coalesce(p_page_size,25),1),100);
  v_offset integer := (greatest(coalesce(p_page,1),1)-1) * least(greatest(coalesce(p_page_size,25),1),100);
  v_result jsonb;
begin
  with
  filtered_changes as (
    select pcl.* from public.permission_change_logs pcl
    where (p_from_date is null or pcl.created_at >= p_from_date::timestamptz)
      and (p_to_date is null or pcl.created_at < (p_to_date + 1)::timestamptz)
  ),
  filtered_audit as (
    select al.* from public.audit_logs al
    where (p_from_date is null or al.created_at >= p_from_date::timestamptz)
      and (p_to_date is null or al.created_at < (p_to_date + 1)::timestamptz)
      and (p_action is null or al.action = p_action)
  ),
  summary as (
    select jsonb_build_object(
      'profile_count', (select count(*) from public.profiles),
      'active_profile_count', (select count(*) from public.profiles where is_active is true),
      'inactive_profile_count', (select count(*) from public.profiles where is_active is not true),
      'active_employee_override_count', (select count(*) from public.employee_permission_overrides where expires_at is null or expires_at > now()),
      'role_override_count', (select count(*) from public.role_permission_overrides),
      'permission_change_count', (select count(*) from filtered_changes),
      'audit_event_count', (select count(*) from filtered_audit)
    ) value
  ),
  role_distribution as (
    select coalesce(jsonb_agg(jsonb_build_object('role', role::text, 'profile_count', profile_count) order by profile_count desc, role::text), '[]'::jsonb) value
    from (select role, count(*) profile_count from public.profiles group by role) x
  ),
  override_breakdown as (
    select coalesce(jsonb_agg(jsonb_build_object('access_level', access_level, 'scope_type', scope_type, 'override_count', override_count) order by override_count desc), '[]'::jsonb) value
    from (
      select access_level, scope_type, count(*) override_count
      from public.employee_permission_overrides
      where expires_at is null or expires_at > now()
      group by access_level, scope_type
    ) x
  ),
  active_overrides as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', epo.id, 'profile_id', epo.profile_id,
      'profile_name', coalesce(p.full_name, p.email, 'Unknown user'),
      'profile_role', p.role::text, 'capability', epo.capability,
      'access_level', epo.access_level, 'scope_type', epo.scope_type,
      'reason', epo.reason, 'expires_at', epo.expires_at, 'updated_at', epo.updated_at
    ) order by epo.updated_at desc), '[]'::jsonb) value
    from public.employee_permission_overrides epo
    left join public.profiles p on p.id = epo.profile_id
    where epo.expires_at is null or epo.expires_at > now()
  ),
  permission_changes as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'created_at', q.created_at,
      'target_profile_id', q.target_profile_id,
      'target_name', coalesce(tp.full_name, tp.email, 'Unknown user'),
      'target_role', q.target_role, 'capability', q.capability,
      'previous_access', q.previous_access, 'new_access', q.new_access,
      'previous_scope', q.previous_scope, 'new_scope', q.new_scope,
      'change_type', q.change_type, 'reason', q.reason,
      'changed_by_name', coalesce(cp.full_name, cp.email, 'System')
    ) order by q.created_at desc), '[]'::jsonb) value
    from (select * from filtered_changes order by created_at desc limit 50) q
    left join public.profiles tp on tp.id = q.target_profile_id
    left join public.profiles cp on cp.id = q.changed_by_profile_id
  ),
  audit_actions as (
    select coalesce(jsonb_agg(jsonb_build_object('action', action, 'event_count', event_count) order by event_count desc, action), '[]'::jsonb) value
    from (select action, count(*) event_count from filtered_audit group by action) x
  ),
  audit_page as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'created_at', q.created_at, 'action', q.action,
      'table_name', q.table_name, 'record_id', q.record_id,
      'actor_name', coalesce(p.full_name, p.email, 'System')
    ) order by q.created_at desc), '[]'::jsonb) rows
    from (select * from filtered_audit order by created_at desc offset v_offset limit v_page_size) q
    left join public.profiles p on p.id = q.actor_id
  )
  select jsonb_build_object(
    'summary', (select value from summary),
    'role_distribution', (select value from role_distribution),
    'override_breakdown', (select value from override_breakdown),
    'active_overrides', (select value from active_overrides),
    'permission_changes', (select value from permission_changes),
    'audit_actions', (select value from audit_actions),
    'audit_register', jsonb_build_object(
      'rows', (select rows from audit_page),
      'total_count', (select count(*) from filtered_audit),
      'page', v_page, 'page_size', v_page_size
    )
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_governance_report(date,date,text,integer,integer) from public;
revoke all on function public.get_governance_report(date,date,text,integer,integer) from anon;
revoke all on function public.get_governance_report(date,date,text,integer,integer) from authenticated;
grant execute on function public.get_governance_report(date,date,text,integer,integer) to service_role;
