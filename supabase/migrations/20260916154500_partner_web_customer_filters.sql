begin;

create or replace function public.partner_app_list_customers_filtered(
  p_limit integer default 25,
  p_offset integer default 0,
  p_search text default null,
  p_status text default 'all',
  p_customer_type text default 'all'
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
  v_status text := lower(nullif(btrim(coalesce(p_status,'all')), ''));
  v_customer_type text := lower(nullif(btrim(coalesce(p_customer_type,'all')), ''));
begin
  if v_status not in ('all','active','inactive') then
    v_status := 'all';
  end if;

  if v_customer_type not in ('all','individual_proprietor','dealership','corporate','group','posp','misp') then
    v_customer_type := 'all';
  end if;

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
      c.partner_type,
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
  classified as (
    select
      b.*,
      regexp_replace(lower(coalesce(nullif(b.partner_type,''), '')), '[^a-z0-9]+', '_', 'g') as normalized_partner_type,
      regexp_replace(lower(coalesce(nullif(b.customer_type,''), '')), '[^a-z0-9]+', '_', 'g') as normalized_customer_type
    from base b
  ),
  filtered as (
    select c.*
    from classified c
    where
      (
        v_search is null
        or c.customer_code ilike '%'||v_search||'%'
        or c.customer_name ilike '%'||v_search||'%'
        or c.company_name ilike '%'||v_search||'%'
        or c.contact_name ilike '%'||v_search||'%'
        or c.phone ilike '%'||v_search||'%'
        or c.email ilike '%'||v_search||'%'
        or c.city ilike '%'||v_search||'%'
        or c.intermediary_code ilike '%'||v_search||'%'
      )
      and (
        v_status='all'
        or (v_status='active' and lower(coalesce(c.customer_status,''))='active')
        or (v_status='inactive' and lower(coalesce(c.customer_status,''))<>'active')
      )
      and (
        v_customer_type='all'
        or (
          v_customer_type='individual_proprietor'
          and (
            c.normalized_partner_type in ('individual','proprietor','individual_proprietor')
            or c.normalized_customer_type in ('individual','proprietor','individual_proprietor')
          )
        )
        or (
          v_customer_type<>'individual_proprietor'
          and (
            c.normalized_partner_type=v_customer_type
            or c.normalized_customer_type=v_customer_type
          )
        )
      )
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
    case
      when f.normalized_customer_type in ('posp','misp') then f.normalized_customer_type
      else coalesce(nullif(f.partner_type,''), nullif(f.customer_type,''))
    end as customer_type,
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

revoke all on function public.partner_app_list_customers_filtered(integer,integer,text,text,text) from public, anon;
grant execute on function public.partner_app_list_customers_filtered(integer,integer,text,text,text) to authenticated, service_role;

commit;
