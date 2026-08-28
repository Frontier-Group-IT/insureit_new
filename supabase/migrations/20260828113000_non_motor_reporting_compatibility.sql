-- Non-Motor reporting compatibility.
-- Adds line-aware reporting functions without changing legacy v2 contracts.
-- Vehicle joins are optional; Non-Motor risk context is derived from non_motor_policy_details.

create or replace function public.get_policy_business_report_v3(
  p_customer_ids uuid[] default null,
  p_from_date date default null,
  p_to_date date default null,
  p_insurer_id uuid default null,
  p_rm_employee_id uuid default null,
  p_intermediary_code text default null,
  p_business_line text default null,
  p_category text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with params as (
  select greatest(coalesce(p_page,1),1) page_no,
         least(greatest(coalesce(p_page_size,25),1),200) page_size,
         case when p_rm_employee_id is null then null else (select full_name from public.employees where id=p_rm_employee_id) end rm_name
),
scope_base as (
  select
    p.id,p.policy_no,p.policy_type,p.policy_product,p.business_type,
    coalesce(nullif(trim(p.business_line),''),'Motor') business_line,
    case when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor'
      then coalesce(nullif(trim(nm.category),''),nullif(trim(p.policy_type),''),'Other')
      else coalesce(nullif(trim(p.policy_type),''),'Other') end category,
    p.start_date,p.end_date,p.issuance_date,p.created_at,
    coalesce(p.issuance_date::date,p.created_at::date) business_date,
    p.status,p.customer_id,p.vehicle_id,p.insurance_company_id,p.insured_declared_value,
    p.intermediary_code,p.intermediary_type,nullif(trim(p.rm_name),'') rm_name,
    coalesce(ppd.gross_premium,p.premium_amount,0)::numeric gross_premium,
    coalesce(ppd.net_premium,0)::numeric net_premium,
    coalesce(ppd.od_premium,0)::numeric od_premium,
    coalesce(ppd.tp_premium,0)::numeric tp_premium,
    coalesce(ppd.cpa_amount,0)::numeric cpa_amount,
    coalesce(nullif(trim(c.company_name),''),nullif(trim(c.legal_trade_name),''),nullif(trim(c.contact_name),''),c.customer_code,'Customer') customer_name,
    c.customer_code,
    coalesce(nullif(trim(v.vehicle_no),''),'') vehicle_no,
    coalesce(nullif(trim(ic.name),''),'Unassigned') insurer_name,
    case
      when coalesce(nullif(trim(p.business_line),''),'Motor')<>'Non Motor'
        then coalesce(nullif(trim(v.vehicle_no),''),'—')
      else coalesce(
        nullif(trim(nm.risk_title),''),
        nullif(trim(nm.risk_details->>'cargoDescription'),''),
        nullif(trim(nm.risk_details->>'projectName'),''),
        nullif(trim(nm.risk_details->>'businessName'),''),
        nullif(trim(concat_ws(' → ',nullif(trim(nm.transit_from),''),nullif(trim(nm.transit_to),''))),''),
        nullif(trim(nm.nature_of_business),''),
        nullif(trim(nm.liability_type),''),
        nullif(trim(nm.risk_location),''),
        'Non-Motor risk'
      )
    end risk_reference,
    case
      when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor' then nullif(trim(nm.risk_location),'')
      else null end risk_secondary
  from public.policies p
  left join public.policy_premium_details ppd on ppd.policy_id=p.id
  join public.customers c on c.id=p.customer_id
  left join public.vehicles v on v.id=p.vehicle_id
  left join public.non_motor_policy_details nm on nm.policy_id=p.id
  left join public.insurance_companies ic on ic.id=p.insurance_company_id
  where (p_customer_ids is null or p.customer_id=any(p_customer_ids))
    and (p_from_date is null or coalesce(p.issuance_date::date,p.created_at::date)>=p_from_date)
    and (p_to_date is null or coalesce(p.issuance_date::date,p.created_at::date)<=p_to_date)
),
filtered as (
  select s.*
  from scope_base s, params x
  where (p_insurer_id is null or s.insurance_company_id=p_insurer_id)
    and (x.rm_name is null or s.rm_name=x.rm_name)
    and (p_intermediary_code is null or s.intermediary_code=p_intermediary_code)
    and (p_business_line is null or lower(s.business_line)=lower(p_business_line))
    and (p_category is null or lower(s.category)=lower(p_category))
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
  select date_trunc('month',business_date)::date month,count(*)::bigint policy_count,coalesce(sum(gross_premium),0)::numeric gross_premium
  from filtered group by 1 order by 1 desc limit 24
),
trend as (
  select coalesce(jsonb_agg(jsonb_build_object('month',month,'policy_count',policy_count,'gross_premium',gross_premium) order by month),'[]'::jsonb) rows
  from trend_ranked
),
category_ranked as (
  select category,count(*)::bigint policy_count,coalesce(sum(gross_premium),0)::numeric gross_premium
  from filtered
  where business_line='Non Motor'
  group by category
  order by gross_premium desc,policy_count desc,category
  limit 12
),
category_mix as (
  select coalesce(jsonb_agg(to_jsonb(category_ranked) order by gross_premium desc,policy_count desc,category),'[]'::jsonb) rows
  from category_ranked
),
insurer_ranked as (
  select insurance_company_id id,insurer_name name,count(*)::bigint policy_count,coalesce(sum(gross_premium),0)::numeric gross_premium,
    case when (select gross_premium from summary)>0 then round((sum(gross_premium)/(select gross_premium from summary))*100,2) else 0::numeric end share_percent
  from filtered group by insurance_company_id,insurer_name order by gross_premium desc,policy_count desc,insurer_name limit 12
),
insurer_summary as (
  select coalesce(jsonb_agg(to_jsonb(insurer_ranked) order by gross_premium desc,policy_count desc,name),'[]'::jsonb) rows from insurer_ranked
),
rm_ranked as (
  select coalesce(rm_name,'Unassigned') name,count(*)::bigint policy_count,count(distinct nullif(intermediary_code,''))::bigint intermediary_count,
    coalesce(sum(gross_premium),0)::numeric gross_premium,coalesce(avg(nullif(gross_premium,0)),0)::numeric average_premium
  from filtered group by coalesce(rm_name,'Unassigned') order by gross_premium desc,policy_count desc,name limit 12
),
rm_summary as (
  select coalesce(jsonb_agg(to_jsonb(rm_ranked) order by gross_premium desc,policy_count desc,name),'[]'::jsonb) rows from rm_ranked
),
filter_insurers as (
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb) rows
  from (select distinct insurance_company_id id,insurer_name name from scope_base where insurance_company_id is not null)x
),
filter_intermediaries as (
  select coalesce(jsonb_agg(jsonb_build_object('code',code,'type',intermediary_type,'name',display_name) order by display_name,code),'[]'::jsonb) rows
  from (
    select distinct sb.intermediary_code code,sb.intermediary_type,coalesce(i.display_name,sb.intermediary_code) display_name
    from scope_base sb left join public.intermediaries i on i.intermediary_code=sb.intermediary_code
    where sb.intermediary_code is not null and sb.intermediary_code<>''
  )x
),
filter_categories as (
  select coalesce(jsonb_agg(category order by category),'[]'::jsonb) rows
  from (select distinct category from scope_base where business_line='Non Motor' and category is not null)x
),
row_page as (
  select f.* from filtered f,params p
  order by f.business_date desc,f.created_at desc,f.policy_no
  offset ((p.page_no-1)*p.page_size) limit p.page_size
),
register_rows as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'policy_no',policy_no,'business_date',business_date,'policy_type',policy_type,'policy_product',policy_product,
    'business_type',business_type,'business_line',business_line,'category',category,'start_date',start_date,'end_date',end_date,'status',status,
    'customer_name',customer_name,'customer_code',customer_code,'vehicle_no',vehicle_no,'risk_reference',risk_reference,'risk_secondary',risk_secondary,
    'insurer_name',insurer_name,'rm_name',rm_name,'intermediary_code',intermediary_code,'intermediary_type',intermediary_type,
    'gross_premium',gross_premium,'net_premium',net_premium,'od_premium',od_premium,'tp_premium',tp_premium,'cpa_amount',cpa_amount,
    'insured_declared_value',insured_declared_value
  ) order by business_date desc,created_at desc,policy_no),'[]'::jsonb) rows from row_page
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
$$;

create or replace function public.get_renewal_report_v3(
  p_customer_ids uuid[] default null,p_horizon_days integer default 365,p_insurer_id uuid default null,
  p_rm_employee_id uuid default null,p_intermediary_code text default null,p_business_line text default null,
  p_category text default null,p_bucket text default null,p_page integer default 1,p_page_size integer default 25
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare h integer:=greatest(1,least(coalesce(p_horizon_days,365),3650)); pg integer:=greatest(coalesce(p_page,1),1);
ps integer:=greatest(1,least(coalesce(p_page_size,25),10001)); offn integer; result jsonb; rm text;
begin
  offn:=(pg-1)*ps;
  rm:=case when p_rm_employee_id is null then null else (select full_name from public.employees where id=p_rm_employee_id) end;
  with s as (
    select p.id,p.customer_id,p.policy_no,p.policy_type,p.policy_product,
      coalesce(nullif(trim(p.business_line),''),'Motor') business_line,
      case when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor' then coalesce(nullif(trim(nm.category),''),p.policy_type,'Other') else coalesce(p.policy_type,'Other') end category,
      p.start_date,p.end_date,p.status,p.insurance_company_id,p.intermediary_type,p.intermediary_code,nullif(trim(p.rm_name),'') rm_name,
      coalesce(d.gross_premium,p.premium_amount,0)::numeric gross_premium,
      coalesce(nullif(trim(c.company_name),''),nullif(trim(c.contact_name),''),c.customer_code,'Customer') customer_name,c.customer_code,
      coalesce(nullif(trim(v.vehicle_no),''),'') vehicle_no,coalesce(nullif(trim(ic.name),''),'Unassigned') insurer_name,
      case when coalesce(nullif(trim(p.business_line),''),'Motor')<>'Non Motor' then coalesce(nullif(trim(v.vehicle_no),''),'—')
      else coalesce(nullif(trim(nm.risk_title),''),nullif(trim(nm.risk_details->>'cargoDescription'),''),nullif(trim(nm.risk_details->>'projectName'),''),nullif(trim(nm.risk_details->>'businessName'),''),
        nullif(trim(concat_ws(' → ',nullif(trim(nm.transit_from),''),nullif(trim(nm.transit_to),''))),''),
        nullif(trim(nm.nature_of_business),''),nullif(trim(nm.liability_type),''),nullif(trim(nm.risk_location),''),'Non-Motor risk') end risk_reference,
      (p.end_date-current_date)::integer days_to_expiry,
      case when p.end_date<current_date then 'expired' when p.end_date<=current_date+30 then 'due_30' when p.end_date<=current_date+60 then 'due_31_60'
        when p.end_date<=current_date+90 then 'due_61_90' when p.end_date<=current_date+180 then 'due_91_180'
        when p.end_date<=current_date+365 then 'due_181_365' else 'later' end renewal_bucket
    from public.policies p
    left join public.policy_premium_details d on d.policy_id=p.id
    left join public.customers c on c.id=p.customer_id
    left join public.vehicles v on v.id=p.vehicle_id
    left join public.non_motor_policy_details nm on nm.policy_id=p.id
    left join public.insurance_companies ic on ic.id=p.insurance_company_id
    where p.end_date is not null and (p_customer_ids is null or p.customer_id=any(p_customer_ids))
      and (p_insurer_id is null or p.insurance_company_id=p_insurer_id)
      and (rm is null or lower(coalesce(nullif(trim(p.rm_name),''),'Unassigned'))=lower(rm))
      and (p_intermediary_code is null or p.intermediary_code=p_intermediary_code)
      and (p_business_line is null or lower(coalesce(nullif(trim(p.business_line),''),'Motor'))=lower(p_business_line))
      and (p_category is null or lower(case when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor' then coalesce(nullif(trim(nm.category),''),p.policy_type,'Other') else coalesce(p.policy_type,'Other') end)=lower(p_category))
  ),w as (select * from s where days_to_expiry<0 or days_to_expiry between 0 and h),
  f as (select * from w where p_bucket is null or renewal_bucket=p_bucket),
  sm as (
    select count(*) filter(where days_to_expiry>=0)::int upcoming_policy_count,count(*) filter(where days_to_expiry<0)::int expired_policy_count,
      count(*) filter(where days_to_expiry between 0 and 30)::int due_30_count,count(*) filter(where days_to_expiry between 0 and 90)::int due_90_count,
      count(distinct customer_id) filter(where days_to_expiry>=0)::int customer_count,coalesce(sum(gross_premium) filter(where days_to_expiry>=0),0) premium_at_risk,
      coalesce(sum(gross_premium) filter(where days_to_expiry between 0 and 30),0) premium_due_30,min(end_date) filter(where days_to_expiry>=0) nearest_expiry
    from w
  ),
  b as (select jsonb_agg(to_jsonb(x) order by n) data from (
    select 1 n,'expired' key,'Expired' label,count(*) filter(where renewal_bucket='expired')::int policy_count,coalesce(sum(gross_premium) filter(where renewal_bucket='expired'),0) gross_premium from w
    union all select 2,'due_30','0–30 days',count(*) filter(where renewal_bucket='due_30')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_30'),0) from w
    union all select 3,'due_31_60','31–60 days',count(*) filter(where renewal_bucket='due_31_60')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_31_60'),0) from w
    union all select 4,'due_61_90','61–90 days',count(*) filter(where renewal_bucket='due_61_90')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_61_90'),0) from w
    union all select 5,'due_91_180','91–180 days',count(*) filter(where renewal_bucket='due_91_180')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_91_180'),0) from w
    union all select 6,'due_181_365','181–365 days',count(*) filter(where renewal_bucket='due_181_365')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_181_365'),0) from w
  )x),
  ins as (select coalesce(jsonb_agg(to_jsonb(x) order by premium_at_risk desc,insurer_name),'[]') data from (
    select insurance_company_id id,insurer_name,count(*) filter(where days_to_expiry>=0)::int upcoming_policy_count,count(*) filter(where days_to_expiry between 0 and 30)::int due_30_count,
      count(*) filter(where days_to_expiry<0)::int expired_count,coalesce(sum(gross_premium) filter(where days_to_expiry>=0),0) premium_at_risk,min(end_date) filter(where days_to_expiry>=0) nearest_expiry
    from w group by insurance_company_id,insurer_name)x),
  rms as (select coalesce(jsonb_agg(to_jsonb(x) order by premium_at_risk desc,rm_name),'[]') data from (
    select coalesce(rm_name,'Unassigned') rm_name,count(*) filter(where days_to_expiry>=0)::int upcoming_policy_count,count(distinct customer_id) filter(where days_to_expiry>=0)::int customer_count,
      count(*) filter(where days_to_expiry between 0 and 30)::int due_30_count,count(*) filter(where days_to_expiry<0)::int expired_count,
      coalesce(sum(gross_premium) filter(where days_to_expiry>=0),0) premium_at_risk,min(end_date) filter(where days_to_expiry>=0) nearest_expiry
    from w group by coalesce(rm_name,'Unassigned'))x),
  rr as (select coalesce(jsonb_agg(to_jsonb(x) order by end_date,policy_no),'[]') data from (
    select id,policy_no,policy_type,policy_product,business_line,category,start_date,end_date,status,customer_name,customer_code,vehicle_no,risk_reference,
      insurer_name,coalesce(rm_name,'Unassigned') rm_name,intermediary_type,intermediary_code,gross_premium,days_to_expiry,renewal_bucket
    from f order by end_date,policy_no limit ps offset offn)x),
  flt as (select jsonb_build_object(
    'insurers',coalesce((select jsonb_agg(to_jsonb(x) order by name) from (select distinct insurance_company_id id,insurer_name name from s where insurance_company_id is not null)x),'[]'),
    'rms','[]'::jsonb,
    'intermediaries',coalesce((select jsonb_agg(to_jsonb(x) order by name,code) from (select distinct s.intermediary_code code,s.intermediary_type type,coalesce(nullif(trim(i.display_name),''),nullif(trim(i.legal_name),''),s.intermediary_code) name from s left join public.intermediaries i on i.intermediary_code=s.intermediary_code where s.intermediary_code is not null)x),'[]'),
    'categories',coalesce((select jsonb_agg(category order by category) from (select distinct category from s where business_line='Non Motor')x),'[]')
  ) data)
  select jsonb_build_object('summary',to_jsonb(sm),'buckets',b.data,'insurers',ins.data,'rms',rms.data,
    'register',jsonb_build_object('rows',rr.data,'total_count',(select count(*) from f),'page',pg,'page_size',ps),'filters',flt.data)
  into result from sm,b,ins,rms,rr,flt;
  return coalesce(result,'{}');
end $$;

create or replace function public.get_finance_report_v3(
  p_customer_ids uuid[] default null,p_from_date date default null,p_to_date date default null,
  p_insurer_id uuid default null,p_rm_employee_id uuid default null,p_intermediary_code text default null,
  p_business_line text default null,p_category text default null,p_billing_status text default null,
  p_page integer default 1,p_page_size integer default 25
)
returns jsonb language sql security definer set search_path=public as $$
with params as (
  select greatest(coalesce(p_page,1),1) page_no,least(greatest(coalesce(p_page_size,25),1),100) page_size,
    case when p_rm_employee_id is null then null else (select full_name from public.employees where id=p_rm_employee_id) end rm_name
),
bill_agg as (
  select policy_id,case when bool_or(status='Billed') then coalesce(sum(billed_amount),0)::numeric else 0::numeric end billed_amount,
    max(bill_date) filter(where status='Billed') latest_bill_date,
    case when bool_or(status='Billed') then 'Billed' when bool_or(status='Billing details incomplete') then 'Billing details incomplete' else 'Unbilled' end billing_status
  from public.policy_payin_bills group by policy_id
),
payout_agg as (
  select policy_id,coalesce(sum(gross_payout),0)::numeric gross_payout,coalesce(sum(retention_amount),0)::numeric retention_amount,
    case when bool_or(lower(coalesce(status,''))='paid') then 'Paid' when bool_or(lower(coalesce(status,''))='approved') then 'Approved' else coalesce(max(status),'Pending') end payout_status,
    max(payout_date) latest_payout_date
  from public.policy_intermediary_payouts group by policy_id
),
base as (
  select p.id,p.customer_id,p.vehicle_id,p.insurance_company_id,p.policy_no,p.policy_type,p.policy_product,
    coalesce(nullif(trim(p.business_line),''),'Motor') business_line,
    case when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor' then coalesce(nullif(trim(nm.category),''),p.policy_type,'Other') else coalesce(p.policy_type,'Other') end category,
    coalesce(p.issuance_date,p.start_date,p.created_at::date) business_date,p.rm_name,p.intermediary_code,
    coalesce(c.company_name,c.contact_name,c.customer_code,'—') customer_name,c.customer_code,coalesce(v.vehicle_no,'') vehicle_no,
    case when coalesce(nullif(trim(p.business_line),''),'Motor')<>'Non Motor' then coalesce(nullif(trim(v.vehicle_no),''),'—')
      else coalesce(nullif(trim(nm.risk_title),''),nullif(trim(nm.risk_details->>'cargoDescription'),''),nullif(trim(nm.risk_details->>'projectName'),''),nullif(trim(nm.risk_details->>'businessName'),''),
        nullif(trim(concat_ws(' → ',nullif(trim(nm.transit_from),''),nullif(trim(nm.transit_to),''))),''),
        nullif(trim(nm.nature_of_business),''),nullif(trim(nm.liability_type),''),nullif(trim(nm.risk_location),''),'Non-Motor risk') end risk_reference,
    coalesce(ic.name,'Unassigned insurer') insurer_name,coalesce(ppd.gross_premium,p.premium_amount,0)::numeric gross_premium,
    coalesce(pid.total_projected_payin,0)::numeric projected_payin,coalesce(pid.tds_amount,0)::numeric payin_tds,coalesce(pid.payin_after_tds,0)::numeric payin_after_tds,
    coalesce(ba.billed_amount,0)::numeric billed_amount,coalesce(ba.billing_status,'Unbilled') billing_status,ba.latest_bill_date,
    coalesce(pa.gross_payout,0)::numeric gross_payout,coalesce(pa.retention_amount,0)::numeric retention_amount,coalesce(pa.payout_status,'Pending') payout_status,pa.latest_payout_date
  from public.policies p
  join public.customers c on c.id=p.customer_id
  left join public.vehicles v on v.id=p.vehicle_id
  left join public.non_motor_policy_details nm on nm.policy_id=p.id
  left join public.insurance_companies ic on ic.id=p.insurance_company_id
  left join public.policy_premium_details ppd on ppd.policy_id=p.id
  left join public.policy_payin_details pid on pid.policy_id=p.id
  left join bill_agg ba on ba.policy_id=p.id
  left join payout_agg pa on pa.policy_id=p.id, params x
  where (p_customer_ids is null or p.customer_id=any(p_customer_ids))
    and (p_from_date is null or coalesce(p.issuance_date,p.start_date,p.created_at::date)>=p_from_date)
    and (p_to_date is null or coalesce(p.issuance_date,p.start_date,p.created_at::date)<=p_to_date)
    and (p_insurer_id is null or p.insurance_company_id=p_insurer_id)
    and (x.rm_name is null or p.rm_name=x.rm_name)
    and (p_intermediary_code is null or p.intermediary_code=p_intermediary_code)
    and (p_business_line is null or lower(coalesce(nullif(trim(p.business_line),''),'Motor'))=lower(p_business_line))
    and (p_category is null or lower(case when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor' then coalesce(nullif(trim(nm.category),''),p.policy_type,'Other') else coalesce(p.policy_type,'Other') end)=lower(p_category))
),
filtered as (select * from base where p_billing_status is null or billing_status=p_billing_status),
summary as (
  select jsonb_build_object('policy_count',count(*)::int,'gross_premium',coalesce(sum(gross_premium),0),'projected_payin',coalesce(sum(projected_payin),0),
    'payin_after_tds',coalesce(sum(payin_after_tds),0),'billed_amount',coalesce(sum(billed_amount),0),'gross_payout',coalesce(sum(gross_payout),0),
    'retention_amount',coalesce(sum(retention_amount),0),'unbilled_count',count(*) filter(where billing_status='Unbilled')::int,
    'billing_incomplete_count',count(*) filter(where billing_status='Billing details incomplete')::int,'billed_count',count(*) filter(where billing_status='Billed')::int,
    'pending_payout_count',count(*) filter(where lower(coalesce(payout_status,''))<>'paid')::int,'missing_payin_count',count(*) filter(where projected_payin=0)::int,
    'negative_retention_count',count(*) filter(where retention_amount<0)::int) obj from filtered
),
insurers as (select coalesce(jsonb_agg(to_jsonb(x) order by x.projected_payin desc),'[]'::jsonb) arr from (
  select insurance_company_id id,insurer_name,count(*)::int policy_count,coalesce(sum(gross_premium),0)::numeric gross_premium,coalesce(sum(projected_payin),0)::numeric projected_payin,
    coalesce(sum(payin_after_tds),0)::numeric payin_after_tds,coalesce(sum(billed_amount),0)::numeric billed_amount,coalesce(sum(gross_payout),0)::numeric gross_payout,coalesce(sum(retention_amount),0)::numeric retention_amount
  from filtered group by insurance_company_id,insurer_name)x),
rms as (select coalesce(jsonb_agg(to_jsonb(x) order by x.projected_payin desc),'[]'::jsonb) arr from (
  select coalesce(rm_name,'Unassigned') rm_name,count(*)::int policy_count,coalesce(sum(projected_payin),0)::numeric projected_payin,coalesce(sum(billed_amount),0)::numeric billed_amount,
    coalesce(sum(gross_payout),0)::numeric gross_payout,coalesce(sum(retention_amount),0)::numeric retention_amount
  from filtered group by coalesce(rm_name,'Unassigned'))x),
billing as (select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order),'[]'::jsonb) arr from (
  select billing_status,count(*)::int policy_count,coalesce(sum(projected_payin),0)::numeric projected_payin,coalesce(sum(billed_amount),0)::numeric billed_amount,
    case billing_status when 'Unbilled' then 1 when 'Billing details incomplete' then 2 when 'Billed' then 3 else 9 end sort_order
  from filtered group by billing_status)x),
filter_options as (select jsonb_build_object(
  'insurers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from(select distinct insurance_company_id id,insurer_name name from base where insurance_company_id is not null)z),'[]'::jsonb),
  'rms','[]'::jsonb,
  'intermediaries',coalesce((select jsonb_agg(jsonb_build_object('code',code,'name',name) order by name) from(select distinct b.intermediary_code code,coalesce(i.display_name,i.legal_name,b.intermediary_code) name from base b left join public.intermediaries i on i.intermediary_code=b.intermediary_code where b.intermediary_code is not null and btrim(b.intermediary_code)<>'')z),'[]'::jsonb),
  'billing_statuses',coalesce((select jsonb_agg(status order by status) from(select distinct billing_status status from base)z),'[]'::jsonb),
  'categories',coalesce((select jsonb_agg(category order by category) from(select distinct category from base where business_line='Non Motor')z),'[]'::jsonb)
) obj),
register_total as(select count(*)::int total_count from filtered),
register_rows as(select coalesce(jsonb_agg(to_jsonb(x) order by x.business_date desc nulls last,x.policy_no),'[]'::jsonb) arr from(
  select f.* from filtered f,params p order by business_date desc nulls last,policy_no limit p.page_size offset((p.page_no-1)*p.page_size))x)
select jsonb_build_object('summary',(select obj from summary),'insurers',(select arr from insurers),'rms',(select arr from rms),'billing',(select arr from billing),
  'filters',(select obj from filter_options),'register',jsonb_build_object('rows',(select arr from register_rows),'total_count',(select total_count from register_total),
  'page',(select page_no from params),'page_size',(select page_size from params)));
$$;

revoke all on function public.get_policy_business_report_v3(uuid[],date,date,uuid,uuid,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.get_policy_business_report_v3(uuid[],date,date,uuid,uuid,text,text,text,integer,integer) to postgres,service_role;
revoke all on function public.get_renewal_report_v3(uuid[],integer,uuid,uuid,text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.get_renewal_report_v3(uuid[],integer,uuid,uuid,text,text,text,text,integer,integer) to postgres,service_role;
revoke all on function public.get_finance_report_v3(uuid[],date,date,uuid,uuid,text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.get_finance_report_v3(uuid[],date,date,uuid,uuid,text,text,text,text,integer,integer) to postgres,service_role;

comment on function public.get_policy_business_report_v3(uuid[],date,date,uuid,uuid,text,text,text,integer,integer)
is 'Line-aware policy business reporting for Motor and Non-Motor portfolios; vehicle linkage is optional.';
comment on function public.get_renewal_report_v3(uuid[],integer,uuid,uuid,text,text,text,text,integer,integer)
is 'Line-aware renewal reporting for Motor and Non-Motor portfolios with adaptive risk reference.';
comment on function public.get_finance_report_v3(uuid[],date,date,uuid,uuid,text,text,text,text,integer,integer)
is 'Line-aware finance reporting for Motor and Non-Motor portfolios; uses common commercial ledgers.';
