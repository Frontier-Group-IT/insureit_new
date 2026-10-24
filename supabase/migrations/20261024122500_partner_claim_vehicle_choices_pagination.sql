begin;

-- Dedicated claim vehicle picker: never truncate by customer list/detail page sizes.
-- Keeps the existing Partner customer scope and scoped policy visibility.
create or replace function public.partner_app_claim_vehicle_choices(
  p_limit integer default 50,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  customer_id uuid,
  customer_name text,
  vehicle_id uuid,
  vehicle_no text,
  make text,
  model text,
  policy_id uuid,
  policy_no text,
  insurer_name text,
  policy_end_date date,
  total_count bigint
)
language plpgsql stable security definer
set search_path = public, auth
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit,50),100));
  v_offset integer := greatest(0, coalesce(p_offset,0));
  v_search text := nullif(btrim(coalesce(p_search,'')),'');
begin
  if auth.uid() is null or public.partner_app_commercial_scope() is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  return query
  with scoped_vehicles as (
    select
      c.id as customer_id,
      coalesce(nullif(c.company_name,''), nullif(c.contact_name,''), c.customer_code, 'Customer')::text as customer_name,
      v.id as vehicle_id,
      v.vehicle_no::text as vehicle_no,
      v.make::text as make,
      v.model::text as model
    from public.vehicles v
    join public.customers c on c.id = v.customer_id
    where public.partner_app_customer_in_scope(c.id)
      and (
        v_search is null
        or v.vehicle_no ilike '%' || v_search || '%'
        or v.make ilike '%' || v_search || '%'
        or v.model ilike '%' || v_search || '%'
        or c.company_name ilike '%' || v_search || '%'
        or c.contact_name ilike '%' || v_search || '%'
        or c.customer_code ilike '%' || v_search || '%'
      )
  ),
  paged as (
    select sv.*, count(*) over() as total_count
    from scoped_vehicles sv
    order by sv.vehicle_no nulls last, sv.vehicle_id
    limit v_limit offset v_offset
  )
  select
    pg.customer_id,
    pg.customer_name,
    pg.vehicle_id,
    pg.vehicle_no,
    pg.make,
    pg.model,
    pol.id as policy_id,
    pol.policy_no::text as policy_no,
    insurer.name::text as insurer_name,
    pol.end_date as policy_end_date,
    pg.total_count
  from paged pg
  left join lateral (
    select p.id,p.policy_no,p.end_date,p.insurance_company_id
    from public.policies p
    where p.customer_id=pg.customer_id
      and p.vehicle_id=pg.vehicle_id
      and public.partner_app_policy_in_scope(p.id)
    order by p.end_date desc nulls last,p.id desc
    limit 1
  ) pol on true
  left join public.insurance_companies insurer on insurer.id=pol.insurance_company_id
  order by pg.vehicle_no nulls last,pg.vehicle_id;
end;
$function$;

revoke all on function public.partner_app_claim_vehicle_choices(integer,integer,text) from public,anon;
grant execute on function public.partner_app_claim_vehicle_choices(integer,integer,text) to authenticated,service_role;

commit;
