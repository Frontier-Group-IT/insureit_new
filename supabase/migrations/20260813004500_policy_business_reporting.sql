create or replace function public.get_policy_business_report(
  p_customer_ids uuid[] default null,
  p_from_date date default null,
  p_to_date date default null,
  p_insurer_id uuid default null,
  p_rm_name text default null,
  p_intermediary_code text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language sql
stable
set search_path = public
as $$
with params as (
  select
    greatest(coalesce(p_page, 1), 1) as page_no,
    least(greatest(coalesce(p_page_size, 25), 1), 200) as page_size
),
scope_base as (
  select
    p.id,
    p.policy_no,
    p.policy_type,
    p.business_type,
    p.start_date,
    p.end_date,
    p.issuance_date,
    p.created_at,
    coalesce(p.issuance_date::date, p.created_at::date) as business_date,
    p.status,
    p.customer_id,
    p.vehicle_id,
    p.insurance_company_id,
    p.insured_declared_value,
    p.intermediary_code,
    p.intermediary_type,
    nullif(trim(p.rm_name), '') as rm_name,
    coalesce(ppd.gross_premium, 0)::numeric as gross_premium,
    coalesce(ppd.net_premium, 0)::numeric as net_premium,
    coalesce(ppd.od_premium, 0)::numeric as od_premium,
    coalesce(ppd.tp_premium, 0)::numeric as tp_premium,
    coalesce(ppd.cpa_amount, 0)::numeric as cpa_amount,
    coalesce(c.company_name, c.legal_trade_name, c.contact_name) as customer_name,
    c.customer_code,
    v.vehicle_no,
    ic.name as insurer_name
  from public.policies p
  left join public.policy_premium_details ppd on ppd.policy_id = p.id
  join public.customers c on c.id = p.customer_id
  join public.vehicles v on v.id = p.vehicle_id
  join public.insurance_companies ic on ic.id = p.insurance_company_id
  where (p_customer_ids is null or p.customer_id = any(p_customer_ids))
    and (p_from_date is null or coalesce(p.issuance_date::date, p.created_at::date) >= p_from_date)
    and (p_to_date is null or coalesce(p.issuance_date::date, p.created_at::date) <= p_to_date)
),
filtered as (
  select *
  from scope_base
  where (p_insurer_id is null or insurance_company_id = p_insurer_id)
    and (p_rm_name is null or rm_name = p_rm_name)
    and (p_intermediary_code is null or intermediary_code = p_intermediary_code)
),
summary as (
  select
    count(*)::bigint as policy_count,
    count(*) filter (where lower(coalesce(status, '')) = 'active')::bigint as active_policy_count,
    coalesce(sum(gross_premium), 0)::numeric as gross_premium,
    coalesce(sum(net_premium), 0)::numeric as net_premium,
    coalesce(sum(od_premium), 0)::numeric as od_premium,
    coalesce(sum(tp_premium), 0)::numeric as tp_premium,
    coalesce(sum(cpa_amount), 0)::numeric as cpa_amount,
    coalesce(avg(nullif(gross_premium, 0)), 0)::numeric as average_premium,
    count(distinct insurance_company_id)::bigint as insurer_count,
    count(distinct nullif(intermediary_code, ''))::bigint as intermediary_count
  from filtered
),
trend_ranked as (
  select
    date_trunc('month', business_date)::date as month,
    count(*)::bigint as policy_count,
    coalesce(sum(gross_premium), 0)::numeric as gross_premium
  from filtered
  group by 1
  order by 1 desc
  limit 24
),
trend as (
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'month', month,
      'policy_count', policy_count,
      'gross_premium', gross_premium
    ) order by month),
    '[]'::jsonb
  ) as rows
  from trend_ranked
),
insurer_ranked as (
  select
    insurance_company_id as id,
    insurer_name as name,
    count(*)::bigint as policy_count,
    coalesce(sum(gross_premium), 0)::numeric as gross_premium,
    case when (select gross_premium from summary) > 0
      then round((sum(gross_premium) / (select gross_premium from summary)) * 100, 2)
      else 0::numeric
    end as share_percent
  from filtered
  group by insurance_company_id, insurer_name
  order by gross_premium desc, policy_count desc, insurer_name
  limit 12
),
insurer_summary as (
  select coalesce(jsonb_agg(to_jsonb(insurer_ranked) order by gross_premium desc, policy_count desc, name), '[]'::jsonb) as rows
  from insurer_ranked
),
rm_ranked as (
  select
    coalesce(rm_name, 'Unassigned') as name,
    count(*)::bigint as policy_count,
    count(distinct nullif(intermediary_code, ''))::bigint as intermediary_count,
    coalesce(sum(gross_premium), 0)::numeric as gross_premium,
    coalesce(avg(nullif(gross_premium, 0)), 0)::numeric as average_premium
  from filtered
  group by coalesce(rm_name, 'Unassigned')
  order by gross_premium desc, policy_count desc, name
  limit 12
),
rm_summary as (
  select coalesce(jsonb_agg(to_jsonb(rm_ranked) order by gross_premium desc, policy_count desc, name), '[]'::jsonb) as rows
  from rm_ranked
),
filter_insurers as (
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'::jsonb) as rows
  from (
    select distinct insurance_company_id as id, insurer_name as name
    from scope_base
    order by insurer_name
  ) x
),
filter_rms as (
  select coalesce(jsonb_agg(name order by name), '[]'::jsonb) as rows
  from (
    select distinct rm_name as name
    from scope_base
    where rm_name is not null
    order by rm_name
  ) x
),
filter_intermediaries as (
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'type', intermediary_type, 'name', display_name) order by display_name, code), '[]'::jsonb) as rows
  from (
    select distinct
      sb.intermediary_code as code,
      sb.intermediary_type,
      coalesce(i.display_name, sb.intermediary_code) as display_name
    from scope_base sb
    left join public.intermediaries i on i.intermediary_code = sb.intermediary_code
    where sb.intermediary_code is not null and sb.intermediary_code <> ''
  ) x
),
row_page as (
  select f.*
  from filtered f, params p
  order by f.business_date desc, f.created_at desc, f.policy_no
  offset ((p.page_no - 1) * p.page_size)
  limit (select page_size from params)
),
register_rows as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'policy_no', policy_no,
    'business_date', business_date,
    'policy_type', policy_type,
    'business_type', business_type,
    'start_date', start_date,
    'end_date', end_date,
    'status', status,
    'customer_name', customer_name,
    'customer_code', customer_code,
    'vehicle_no', vehicle_no,
    'insurer_name', insurer_name,
    'rm_name', rm_name,
    'intermediary_code', intermediary_code,
    'intermediary_type', intermediary_type,
    'gross_premium', gross_premium,
    'net_premium', net_premium,
    'od_premium', od_premium,
    'tp_premium', tp_premium,
    'cpa_amount', cpa_amount,
    'insured_declared_value', insured_declared_value
  ) order by business_date desc, created_at desc, policy_no), '[]'::jsonb) as rows
  from row_page
)
select jsonb_build_object(
  'summary', (select to_jsonb(summary) from summary),
  'trend', (select rows from trend),
  'insurers', (select rows from insurer_summary),
  'rms', (select rows from rm_summary),
  'filters', jsonb_build_object(
    'insurers', (select rows from filter_insurers),
    'rms', (select rows from filter_rms),
    'intermediaries', (select rows from filter_intermediaries)
  ),
  'register', jsonb_build_object(
    'rows', (select rows from register_rows),
    'total_count', (select count(*)::bigint from filtered),
    'page', (select page_no from params),
    'page_size', (select page_size from params)
  )
);
$$;

comment on function public.get_policy_business_report(uuid[], date, date, uuid, text, text, integer, integer)
is 'Server-side policy business reporting aggregate. Caller is responsible for passing an authorization-scoped customer id set.';
