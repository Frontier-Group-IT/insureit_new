create or replace function public.get_policy_business_report_v3(
  p_customer_ids uuid[] default null::uuid[],
  p_from_date date default null::date,
  p_to_date date default null::date,
  p_insurer_id uuid default null::uuid,
  p_rm_employee_id uuid default null::uuid,
  p_intermediary_code text default null::text,
  p_business_line text default null::text,
  p_category text default null::text,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
with params as (
  select
    greatest(coalesce(p_page,1),1) page_no,
    least(greatest(coalesce(p_page_size,25),1),200) page_size,
    case
      when p_rm_employee_id is null then null
      else (select full_name from public.employees where id=p_rm_employee_id)
    end rm_name
),
policy_base as (
  select
    p.id,
    p.policy_no,
    p.policy_type,
    p.policy_product,
    p.business_type,
    coalesce(nullif(trim(p.business_line),''),'Motor') business_line,
    case
      when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor'
        then coalesce(nullif(trim(nm.category),''),nullif(trim(p.policy_type),''),'Other')
      else coalesce(nullif(trim(p.policy_type),''),'Other')
    end category,
    p.start_date,
    p.end_date,
    p.issuance_date,
    p.created_at,
    coalesce(p.issuance_date::date,p.created_at::date) business_date,
    p.status,
    p.customer_id,
    p.vehicle_id,
    p.insurance_company_id,
    p.insured_declared_value,
    p.intermediary_code,
    p.intermediary_type,
    nullif(trim(p.rm_name),'') rm_name,
    coalesce(ppd.gross_premium,p.premium_amount,0)::numeric gross_premium,
    coalesce(ppd.net_premium,0)::numeric net_premium,
    coalesce(ppd.od_premium,0)::numeric od_premium,
    coalesce(ppd.tp_premium,0)::numeric tp_premium,
    coalesce(ppd.cpa_amount,0)::numeric cpa_amount,
    nm.risk_title,
    nm.risk_details,
    nm.transit_from,
    nm.transit_to,
    nm.nature_of_business,
    nm.liability_type,
    nm.risk_location
  from public.policies p
  left join public.policy_premium_details ppd on ppd.policy_id=p.id
  left join public.non_motor_policy_details nm on nm.policy_id=p.id
  where (p_customer_ids is null or p.customer_id=any(p_customer_ids))
    and (p_from_date is null or coalesce(p.issuance_date::date,p.created_at::date)>=p_from_date)
    and (p_to_date is null or coalesce(p.issuance_date::date,p.created_at::date)<=p_to_date)
),
filtered as (
  select b.*
  from policy_base b, params x
  where (p_insurer_id is null or b.insurance_company_id=p_insurer_id)
    and (x.rm_name is null or b.rm_name=x.rm_name)
    and (p_intermediary_code is null or b.intermediary_code=p_intermediary_code)
    and (p_business_line is null or lower(b.business_line)=lower(p_business_line))
    and (p_category is null or lower(b.category)=lower(p_category))
),
summary as (
  select
    count(*)::bigint policy_count,
    count(*) filter(where lower(coalesce(status,''))='active')::bigint active_policy_count,
    coalesce(sum(gross_premium),0)::numeric gross_premium,
    coalesce(sum(net_premium),0)::numeric net_premium,
    coalesce(sum(od_premium),0)::numeric od_premium,
    coalesce(sum(tp_premium),0)::numeric tp_premium,
    coalesce(sum(cpa_amount),0)::numeric cpa_amount,
    coalesce(avg(nullif(gross_premium,0)),0)::numeric average_premium,
    count(distinct insurance_company_id)::bigint insurer_count,
    count(distinct nullif(intermediary_code,''))::bigint intermediary_count,
    count(*) filter(where business_line='Motor')::bigint motor_policy_count,
    count(*) filter(where business_line='Non Motor')::bigint non_motor_policy_count,
    coalesce(sum(gross_premium) filter(where business_line='Motor'),0)::numeric motor_gross_premium,
    coalesce(sum(gross_premium) filter(where business_line='Non Motor'),0)::numeric non_motor_gross_premium
  from filtered
),
trend_ranked as (
  select
    date_trunc('month',business_date)::date as trend_month,
    count(*)::bigint policy_count,
    coalesce(sum(gross_premium),0)::numeric gross_premium
  from filtered
  group by 1
  order by 1 desc
  limit 24
),
trend as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'month',trend_month,
        'policy_count',policy_count,
        'gross_premium',gross_premium
      )
      order by trend_month
    ),
    '[]'::jsonb
  ) rows
  from trend_ranked
),
category_ranked as (
  select
    category,
    count(*)::bigint policy_count,
    coalesce(sum(gross_premium),0)::numeric gross_premium
  from filtered
  where business_line='Non Motor'
  group by category
  order by gross_premium desc,policy_count desc,category
  limit 12
),
category_mix as (
  select coalesce(
    jsonb_agg(to_jsonb(category_ranked) order by gross_premium desc,policy_count desc,category),
    '[]'::jsonb
  ) rows
  from category_ranked
),
insurer_ranked_base as (
  select
    insurance_company_id id,
    count(*)::bigint policy_count,
    coalesce(sum(gross_premium),0)::numeric gross_premium,
    case
      when (select gross_premium from summary)>0
        then round((sum(gross_premium)/(select gross_premium from summary))*100,2)
      else 0::numeric
    end share_percent
  from filtered
  group by insurance_company_id
),
insurer_ranked as (
  select
    b.id,
    coalesce(nullif(trim(ic.name),''),'Unassigned') name,
    b.policy_count,
    b.gross_premium,
    b.share_percent
  from insurer_ranked_base b
  left join public.insurance_companies ic on ic.id=b.id
  order by b.gross_premium desc,b.policy_count desc,coalesce(nullif(trim(ic.name),''),'Unassigned')
  limit 12
),
insurer_summary as (
  select coalesce(
    jsonb_agg(to_jsonb(insurer_ranked) order by gross_premium desc,policy_count desc,name),
    '[]'::jsonb
  ) rows
  from insurer_ranked
),
rm_ranked as (
  select
    coalesce(rm_name,'Unassigned') name,
    count(*)::bigint policy_count,
    count(distinct nullif(intermediary_code,''))::bigint intermediary_count,
    coalesce(sum(gross_premium),0)::numeric gross_premium,
    coalesce(avg(nullif(gross_premium,0)),0)::numeric average_premium
  from filtered
  group by coalesce(rm_name,'Unassigned')
  order by gross_premium desc,policy_count desc,name
  limit 12
),
rm_summary as (
  select coalesce(
    jsonb_agg(to_jsonb(rm_ranked) order by gross_premium desc,policy_count desc,name),
    '[]'::jsonb
  ) rows
  from rm_ranked
),
filter_insurer_ids as (
  select distinct insurance_company_id id
  from policy_base
  where insurance_company_id is not null
),
filter_insurers as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id',x.id,'name',coalesce(nullif(trim(ic.name),''),'Unassigned'))
      order by coalesce(nullif(trim(ic.name),''),'Unassigned')
    ),
    '[]'::jsonb
  ) rows
  from filter_insurer_ids x
  join public.insurance_companies ic on ic.id=x.id
),
filter_intermediary_ids as (
  select distinct intermediary_code code,intermediary_type
  from policy_base
  where intermediary_code is not null and intermediary_code<>''
),
filter_intermediaries as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code',x.code,
        'type',x.intermediary_type,
        'name',coalesce(i.display_name,x.code)
      )
      order by coalesce(i.display_name,x.code),x.code
    ),
    '[]'::jsonb
  ) rows
  from filter_intermediary_ids x
  left join public.intermediaries i on i.intermediary_code=x.code
),
filter_categories as (
  select coalesce(jsonb_agg(category order by category),'[]'::jsonb) rows
  from (
    select distinct category
    from policy_base
    where business_line='Non Motor' and category is not null
  ) x
),
row_page_base as (
  select f.*
  from filtered f
  order by f.business_date desc,f.created_at desc,f.policy_no
  offset (
    (greatest(coalesce(p_page,1),1)-1)
    * least(greatest(coalesce(p_page_size,25),1),200)
  )
  limit least(greatest(coalesce(p_page_size,25),1),200)
),
row_page as (
  select
    f.*,
    coalesce(
      nullif(trim(c.company_name),''),
      nullif(trim(c.legal_trade_name),''),
      nullif(trim(c.contact_name),''),
      c.customer_code,
      'Customer'
    ) customer_name,
    c.customer_code,
    coalesce(nullif(trim(v.vehicle_no),''),'') vehicle_no,
    coalesce(nullif(trim(ic.name),''),'Unassigned') insurer_name,
    case
      when f.business_line<>'Non Motor'
        then coalesce(nullif(trim(v.vehicle_no),''),'—')
      else coalesce(
        nullif(trim(f.risk_title),''),
        nullif(trim(f.risk_details->>'cargoDescription'),''),
        nullif(trim(f.risk_details->>'projectName'),''),
        nullif(trim(f.risk_details->>'businessName'),''),
        nullif(trim(concat_ws(
          ' → ',
          nullif(trim(f.transit_from),''),
          nullif(trim(f.transit_to),'')
        )),''),
        nullif(trim(f.nature_of_business),''),
        nullif(trim(f.liability_type),''),
        nullif(trim(f.risk_location),''),
        'Non-Motor risk'
      )
    end risk_reference,
    case
      when f.business_line='Non Motor' then nullif(trim(f.risk_location),'')
      else null
    end risk_secondary
  from row_page_base f
  join public.customers c on c.id=f.customer_id
  left join public.vehicles v on v.id=f.vehicle_id
  left join public.insurance_companies ic on ic.id=f.insurance_company_id
),
register_rows as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',id,
        'policy_no',policy_no,
        'business_date',business_date,
        'policy_type',policy_type,
        'policy_product',policy_product,
        'business_type',business_type,
        'business_line',business_line,
        'category',category,
        'start_date',start_date,
        'end_date',end_date,
        'status',status,
        'customer_name',customer_name,
        'customer_code',customer_code,
        'vehicle_no',vehicle_no,
        'risk_reference',risk_reference,
        'risk_secondary',risk_secondary,
        'insurer_name',insurer_name,
        'rm_name',rm_name,
        'intermediary_code',intermediary_code,
        'intermediary_type',intermediary_type,
        'gross_premium',gross_premium,
        'net_premium',net_premium,
        'od_premium',od_premium,
        'tp_premium',tp_premium,
        'cpa_amount',cpa_amount,
        'insured_declared_value',insured_declared_value
      )
      order by business_date desc,created_at desc,policy_no
    ),
    '[]'::jsonb
  ) rows
  from row_page
)
select jsonb_build_object(
  'summary',(select to_jsonb(summary) from summary),
  'trend',(select rows from trend),
  'category_mix',(select rows from category_mix),
  'insurers',(select rows from insurer_summary),
  'rms',(select rows from rm_summary),
  'filters',jsonb_build_object(
    'insurers',(select rows from filter_insurers),
    'rms','[]'::jsonb,
    'intermediaries',(select rows from filter_intermediaries),
    'categories',(select rows from filter_categories)
  ),
  'register',jsonb_build_object(
    'rows',(select rows from register_rows),
    'total_count',(select count(*)::bigint from filtered),
    'page',(select page_no from params),
    'page_size',(select page_size from params)
  )
);
$function$;
