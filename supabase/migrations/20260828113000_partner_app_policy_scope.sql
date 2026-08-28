begin;

create or replace function public.partner_app_policy_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_actor_kind text;
  v_scope_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_result jsonb;
begin
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable'
      using errcode = '28000';
  end if;

  v_actor_kind := v_scope ->> 'actor_kind';
  v_scope_mode := coalesce(v_scope ->> 'scope_mode', 'none');

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'employee_ids', '[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'intermediary_ids', '[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'group_ids', '[]'::jsonb)) value;

  with scoped_policies as (
    select p.*
    from public.policies p
    left join public.intermediaries i
      on i.intermediary_code = p.intermediary_code
    where
      case
        when v_scope_mode = 'none' then false
        when v_actor_kind = 'intermediary' then
          i.id = any(v_intermediary_ids)
        when v_actor_kind = 'employee' and v_scope_mode = 'organization' then
          true
        when v_actor_kind = 'employee' then
          p.rm_employee_id = any(v_employee_ids)
          or i.id = any(v_intermediary_ids)
          or (
            p.intermediary_group_id is not null
            and p.intermediary_group_id = any(v_group_ids)
          )
        else false
      end
  )
  select jsonb_build_object(
    'total_policies', count(*),
    'in_force_policies', count(*) filter (
      where coalesce(start_date, current_date) <= current_date
        and (end_date is null or end_date >= current_date)
    ),
    'expiring_30_days', count(*) filter (
      where end_date between current_date and current_date + 30
    ),
    'expired_policies', count(*) filter (
      where end_date is not null and end_date < current_date
    ),
    'upcoming_policies', count(*) filter (
      where start_date is not null and start_date > current_date
    ),
    'total_premium', coalesce(sum(premium_amount), 0),
    'motor_policies', count(*) filter (
      where lower(coalesce(policy_type, '')) = 'motor'
        or lower(coalesce(business_line, '')) = 'motor'
    )
  )
  into v_result
  from scoped_policies;

  return v_result;
end;
$$;

create or replace function public.partner_app_list_policies(
  p_limit integer default 25,
  p_offset integer default 0,
  p_search text default null,
  p_lifecycle text default 'all'
)
returns table (
  policy_id uuid,
  policy_code text,
  policy_no text,
  policy_type text,
  policy_product text,
  business_line text,
  business_type text,
  start_date date,
  end_date date,
  issuance_date date,
  premium_amount numeric,
  policy_status text,
  lifecycle_status text,
  customer_id uuid,
  customer_name text,
  vehicle_id uuid,
  vehicle_no text,
  insurer_name text,
  intermediary_type text,
  intermediary_code text,
  rm_name text,
  intermediary_group_code text,
  intermediary_group_name text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_actor_kind text;
  v_scope_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_offset integer := greatest(0, least(coalesce(p_offset, 0), 100000));
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_lifecycle text := lower(coalesce(nullif(btrim(p_lifecycle), ''), 'all'));
begin
  if v_lifecycle not in ('all', 'in_force', 'expiring', 'expired', 'upcoming') then
    raise exception 'Invalid policy lifecycle filter';
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable'
      using errcode = '28000';
  end if;

  v_actor_kind := v_scope ->> 'actor_kind';
  v_scope_mode := coalesce(v_scope ->> 'scope_mode', 'none');

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'employee_ids', '[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'intermediary_ids', '[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'group_ids', '[]'::jsonb)) value;

  return query
  with base as (
    select
      p.id as policy_id,
      p.policy_code,
      p.policy_no,
      p.policy_type,
      p.policy_product,
      p.business_line,
      p.business_type,
      p.start_date,
      p.end_date,
      p.issuance_date,
      p.premium_amount,
      p.status as policy_status,
      p.customer_id,
      coalesce(nullif(c.company_name, ''), nullif(c.contact_name, ''), c.customer_code, 'Customer') as customer_name,
      p.vehicle_id,
      v.vehicle_no,
      ic.name as insurer_name,
      p.intermediary_type,
      p.intermediary_code,
      p.rm_name,
      p.intermediary_group_code,
      p.intermediary_group_name,
      p.created_at,
      i.id as intermediary_id,
      case
        when p.end_date is not null and p.end_date < current_date then 'expired'
        when p.start_date is not null and p.start_date > current_date then 'upcoming'
        when p.end_date between current_date and current_date + 30 then 'expiring'
        else 'in_force'
      end as lifecycle_status
    from public.policies p
    left join public.intermediaries i
      on i.intermediary_code = p.intermediary_code
    left join public.customers c
      on c.id = p.customer_id
    left join public.vehicles v
      on v.id = p.vehicle_id
    left join public.insurance_companies ic
      on ic.id = p.insurance_company_id
    where
      case
        when v_scope_mode = 'none' then false
        when v_actor_kind = 'intermediary' then
          i.id = any(v_intermediary_ids)
        when v_actor_kind = 'employee' and v_scope_mode = 'organization' then
          true
        when v_actor_kind = 'employee' then
          p.rm_employee_id = any(v_employee_ids)
          or i.id = any(v_intermediary_ids)
          or (
            p.intermediary_group_id is not null
            and p.intermediary_group_id = any(v_group_ids)
          )
        else false
      end
  ),
  filtered as (
    select b.*
    from base b
    where
      (v_lifecycle = 'all' or b.lifecycle_status = v_lifecycle)
      and (
        v_search is null
        or b.policy_no ilike '%' || v_search || '%'
        or b.policy_code ilike '%' || v_search || '%'
        or b.customer_name ilike '%' || v_search || '%'
        or b.vehicle_no ilike '%' || v_search || '%'
        or b.insurer_name ilike '%' || v_search || '%'
        or b.intermediary_code ilike '%' || v_search || '%'
      )
  )
  select
    f.policy_id,
    f.policy_code,
    f.policy_no,
    f.policy_type,
    f.policy_product,
    f.business_line,
    f.business_type,
    f.start_date,
    f.end_date,
    f.issuance_date,
    f.premium_amount,
    f.policy_status,
    f.lifecycle_status,
    f.customer_id,
    f.customer_name,
    f.vehicle_id,
    f.vehicle_no,
    f.insurer_name,
    f.intermediary_type,
    f.intermediary_code,
    f.rm_name,
    f.intermediary_group_code,
    f.intermediary_group_name,
    count(*) over() as total_count
  from filtered f
  order by coalesce(f.issuance_date, f.start_date, f.created_at::date) desc, f.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.partner_app_policy_summary() from public, anon;
revoke all on function public.partner_app_list_policies(integer, integer, text, text) from public, anon;

grant execute on function public.partner_app_policy_summary() to authenticated, service_role;
grant execute on function public.partner_app_list_policies(integer, integer, text, text) to authenticated, service_role;

commit;
