begin;

create or replace function public.partner_app_customer_summary()
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
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_result jsonb;
begin
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_actor_kind := v_scope ->> 'actor_kind';
  v_scope_mode := coalesce(v_scope ->> 'scope_mode','none');

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'intermediary_ids','[]'::jsonb)) value;

  with scoped_customers as (
    select c.*
    from public.customers c
    where
      case
        when v_scope_mode='none' then false
        when v_actor_kind='employee' and v_scope_mode='organization' then true
        else c.lead_source_intermediary_id=any(v_intermediary_ids)
      end
  )
  select jsonb_build_object(
    'total_customers', count(*),
    'active_customers', count(*) filter(where lower(coalesce(status,''))='active'),
    'with_phone', count(*) filter(where nullif(btrim(coalesce(phone,'')),'') is not null),
    'with_email', count(*) filter(where nullif(btrim(coalesce(email,'')),'') is not null)
  )
  into v_result
  from scoped_customers;

  return v_result;
end;
$$;

create or replace function public.partner_app_list_customers(
  p_limit integer default 25,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  customer_id uuid,
  customer_code text,
  customer_name text,
  company_name text,
  contact_name text,
  phone text,
  email text,
  city text,
  state text,
  customer_type text,
  fleet_size_band text,
  customer_status text,
  intermediary_type text,
  intermediary_code text,
  created_at timestamptz,
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
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_limit integer := greatest(1, least(coalesce(p_limit,25),100));
  v_offset integer := greatest(0, least(coalesce(p_offset,0),100000));
  v_search text := nullif(btrim(coalesce(p_search,'')), '');
begin
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_actor_kind := v_scope ->> 'actor_kind';
  v_scope_mode := coalesce(v_scope ->> 'scope_mode','none');

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'intermediary_ids','[]'::jsonb)) value;

  return query
  with base as (
    select
      c.id as customer_id,
      c.customer_code,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as customer_name,
      c.company_name,
      c.contact_name,
      c.phone,
      c.email,
      c.city,
      c.state,
      c.customer_type,
      c.fleet_size_band,
      c.status as customer_status,
      i.intermediary_type,
      i.intermediary_code,
      c.created_at
    from public.customers c
    left join public.intermediaries i on i.id=c.lead_source_intermediary_id
    where
      case
        when v_scope_mode='none' then false
        when v_actor_kind='employee' and v_scope_mode='organization' then true
        else c.lead_source_intermediary_id=any(v_intermediary_ids)
      end
  ),
  filtered as (
    select b.*
    from base b
    where
      v_search is null
      or b.customer_code ilike '%'||v_search||'%'
      or b.customer_name ilike '%'||v_search||'%'
      or b.company_name ilike '%'||v_search||'%'
      or b.contact_name ilike '%'||v_search||'%'
      or b.phone ilike '%'||v_search||'%'
      or b.email ilike '%'||v_search||'%'
      or b.city ilike '%'||v_search||'%'
      or b.intermediary_code ilike '%'||v_search||'%'
  )
  select
    f.customer_id,
    f.customer_code,
    f.customer_name,
    f.company_name,
    f.contact_name,
    f.phone,
    f.email,
    f.city,
    f.state,
    f.customer_type,
    f.fleet_size_band,
    f.customer_status,
    f.intermediary_type,
    f.intermediary_code,
    f.created_at,
    count(*) over() as total_count
  from filtered f
  order by f.customer_name asc, f.created_at desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.partner_app_customer_summary() from public, anon;
revoke all on function public.partner_app_list_customers(integer,integer,text) from public, anon;

grant execute on function public.partner_app_customer_summary() to authenticated, service_role;
grant execute on function public.partner_app_list_customers(integer,integer,text) to authenticated, service_role;

commit;
