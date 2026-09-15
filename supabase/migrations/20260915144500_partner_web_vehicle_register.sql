begin;

create or replace function public.partner_app_list_vehicles(
  p_limit integer default 25,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  vehicle_id uuid,
  customer_id uuid,
  vehicle_no text,
  vehicle_type text,
  make text,
  model text,
  registration_status text,
  customer_name text,
  policy_count bigint,
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
  v_limit integer := greatest(1, least(coalesce(p_limit,25),100));
  v_offset integer := greatest(0, least(coalesce(p_offset,0),100000));
  v_search text := nullif(btrim(coalesce(p_search,'')),'');
begin
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_actor_kind := v_scope->>'actor_kind';
  v_scope_mode := coalesce(v_scope->>'scope_mode','none');

  select coalesce(array_agg(value::uuid),array[]::uuid[])
    into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
    into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
    into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;

  return query
  with scoped_policies as (
    select p.id, p.vehicle_id
    from public.policies p
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    where p.vehicle_id is not null
      and case
        when v_scope_mode='none' then false
        when v_actor_kind='intermediary' then i.id=any(v_intermediary_ids)
        when v_actor_kind='employee' and v_scope_mode='organization' then true
        when v_actor_kind='employee' then
          p.rm_employee_id=any(v_employee_ids)
          or i.id=any(v_intermediary_ids)
          or (p.intermediary_group_id is not null and p.intermediary_group_id=any(v_group_ids))
        else false
      end
  ),
  base as (
    select
      v.id as vehicle_id,
      v.customer_id,
      v.vehicle_no,
      v.vehicle_type,
      v.make,
      v.model,
      v.registration_status,
      coalesce(nullif(c.company_name,''), nullif(c.contact_name,''), c.customer_code, 'Customer') as customer_name,
      count(sp.id)::bigint as policy_count,
      max(v.created_at) as created_at
    from public.vehicles v
    join scoped_policies sp on sp.vehicle_id=v.id
    left join public.customers c on c.id=v.customer_id
    group by v.id, v.customer_id, v.vehicle_no, v.vehicle_type, v.make, v.model, v.registration_status, c.company_name, c.contact_name, c.customer_code
  ),
  filtered as (
    select b.*
    from base b
    where v_search is null
      or b.vehicle_no ilike '%'||v_search||'%'
      or coalesce(b.make,'') ilike '%'||v_search||'%'
      or coalesce(b.model,'') ilike '%'||v_search||'%'
      or b.customer_name ilike '%'||v_search||'%'
      or coalesce(b.vehicle_type,'') ilike '%'||v_search||'%'
  )
  select
    f.vehicle_id,
    f.customer_id,
    f.vehicle_no,
    f.vehicle_type,
    f.make,
    f.model,
    f.registration_status,
    f.customer_name,
    f.policy_count,
    count(*) over() as total_count
  from filtered f
  order by f.created_at desc, f.vehicle_no asc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.partner_app_list_vehicles(integer,integer,text) from public, anon;
grant execute on function public.partner_app_list_vehicles(integer,integer,text) to authenticated, service_role;

commit;
