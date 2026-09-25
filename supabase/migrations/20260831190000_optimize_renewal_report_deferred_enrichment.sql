create or replace function public.get_renewal_report_v3(
  p_customer_ids uuid[] default null::uuid[],
  p_horizon_days integer default 365,
  p_insurer_id uuid default null::uuid,
  p_rm_employee_id uuid default null::uuid,
  p_intermediary_code text default null::text,
  p_business_line text default null::text,
  p_category text default null::text,
  p_bucket text default null::text,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  h integer:=greatest(1,least(coalesce(p_horizon_days,365),3650));
  pg integer:=greatest(coalesce(p_page,1),1);
  ps integer:=greatest(1,least(coalesce(p_page_size,25),10001));
  offn integer;
  result jsonb;
  rm text;
begin
  offn:=(pg-1)*ps;
  rm:=case when p_rm_employee_id is null then null else (select full_name from public.employees where id=p_rm_employee_id) end;

  with s as (
    select
      p.id,p.customer_id,p.vehicle_id,p.policy_no,p.policy_type,p.policy_product,
      coalesce(nullif(trim(p.business_line),''),'Motor') business_line,
      case when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor'
        then coalesce(nullif(trim(nm.category),''),p.policy_type,'Other')
        else coalesce(p.policy_type,'Other') end category,
      p.start_date,p.end_date,p.status,p.insurance_company_id,p.intermediary_type,p.intermediary_code,
      nullif(trim(p.rm_name),'') rm_name,
      coalesce(d.gross_premium,p.premium_amount,0)::numeric gross_premium,
      coalesce(nullif(trim(ic.name),''),'Unassigned') insurer_name,
      (p.end_date-current_date)::integer days_to_expiry,
      case when p.end_date<current_date then 'expired'
        when p.end_date<=current_date+30 then 'due_30'
        when p.end_date<=current_date+60 then 'due_31_60'
        when p.end_date<=current_date+90 then 'due_61_90'
        when p.end_date<=current_date+180 then 'due_91_180'
        when p.end_date<=current_date+365 then 'due_181_365'
        else 'later' end renewal_bucket
    from public.policies p
    left join public.policy_premium_details d on d.policy_id=p.id
    left join public.non_motor_policy_details nm on nm.policy_id=p.id
    left join public.insurance_companies ic on ic.id=p.insurance_company_id
    where p.end_date is not null
      and (p_customer_ids is null or p.customer_id=any(p_customer_ids))
      and (p_insurer_id is null or p.insurance_company_id=p_insurer_id)
      and (rm is null or lower(coalesce(nullif(trim(p.rm_name),''),'Unassigned'))=lower(rm))
      and (p_intermediary_code is null or p.intermediary_code=p_intermediary_code)
      and (p_business_line is null or lower(coalesce(nullif(trim(p.business_line),''),'Motor'))=lower(p_business_line))
      and (p_category is null or lower(case when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor'
        then coalesce(nullif(trim(nm.category),''),p.policy_type,'Other') else coalesce(p.policy_type,'Other') end)=lower(p_category))
  ),
  w as (
    select * from s where days_to_expiry<0 or days_to_expiry between 0 and h
  ),
  f as (
    select * from w where p_bucket is null or renewal_bucket=p_bucket
  ),
  sm as (
    select count(*) filter(where days_to_expiry>=0)::int upcoming_policy_count,
      count(*) filter(where days_to_expiry<0)::int expired_policy_count,
      count(*) filter(where days_to_expiry between 0 and 30)::int due_30_count,
      count(*) filter(where days_to_expiry between 0 and 90)::int due_90_count,
      count(distinct customer_id) filter(where days_to_expiry>=0)::int customer_count,
      coalesce(sum(gross_premium) filter(where days_to_expiry>=0),0) premium_at_risk,
      coalesce(sum(gross_premium) filter(where days_to_expiry between 0 and 30),0) premium_due_30,
      min(end_date) filter(where days_to_expiry>=0) nearest_expiry
    from w
  ),
  b as (
    select jsonb_agg(to_jsonb(x) order by n) data from (
      select 1 n,'expired' key,'Expired' label,count(*) filter(where renewal_bucket='expired')::int policy_count,coalesce(sum(gross_premium) filter(where renewal_bucket='expired'),0) gross_premium from w
      union all select 2,'due_30','0–30 days',count(*) filter(where renewal_bucket='due_30')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_30'),0) from w
      union all select 3,'due_31_60','31–60 days',count(*) filter(where renewal_bucket='due_31_60')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_31_60'),0) from w
      union all select 4,'due_61_90','61–90 days',count(*) filter(where renewal_bucket='due_61_90')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_61_90'),0) from w
      union all select 5,'due_91_180','91–180 days',count(*) filter(where renewal_bucket='due_91_180')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_91_180'),0) from w
      union all select 6,'due_181_365','181–365 days',count(*) filter(where renewal_bucket='due_181_365')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_181_365'),0) from w
    ) x
  ),
  ins as (
    select coalesce(jsonb_agg(to_jsonb(x) order by premium_at_risk desc,insurer_name),'[]') data from (
      select insurance_company_id id,insurer_name,
        count(*) filter(where days_to_expiry>=0)::int upcoming_policy_count,
        count(*) filter(where days_to_expiry between 0 and 30)::int due_30_count,
        count(*) filter(where days_to_expiry<0)::int expired_count,
        coalesce(sum(gross_premium) filter(where days_to_expiry>=0),0) premium_at_risk,
        min(end_date) filter(where days_to_expiry>=0) nearest_expiry
      from w group by insurance_company_id,insurer_name
    ) x
  ),
  rms as (
    select coalesce(jsonb_agg(to_jsonb(x) order by premium_at_risk desc,rm_name),'[]') data from (
      select coalesce(rm_name,'Unassigned') rm_name,
        count(*) filter(where days_to_expiry>=0)::int upcoming_policy_count,
        count(distinct customer_id) filter(where days_to_expiry>=0)::int customer_count,
        count(*) filter(where days_to_expiry between 0 and 30)::int due_30_count,
        count(*) filter(where days_to_expiry<0)::int expired_count,
        coalesce(sum(gross_premium) filter(where days_to_expiry>=0),0) premium_at_risk,
        min(end_date) filter(where days_to_expiry>=0) nearest_expiry
      from w group by coalesce(rm_name,'Unassigned')
    ) x
  ),
  page_base as (
    select * from f order by end_date,policy_no limit ps offset offn
  ),
  rr as (
    select coalesce(jsonb_agg(to_jsonb(x) order by end_date,policy_no),'[]') data from (
      select pb.id,pb.policy_no,pb.policy_type,pb.policy_product,pb.business_line,pb.category,pb.start_date,pb.end_date,pb.status,
        coalesce(nullif(trim(c.company_name),''),nullif(trim(c.contact_name),''),c.customer_code,'Customer') customer_name,
        c.customer_code,coalesce(nullif(trim(v.vehicle_no),''),'') vehicle_no,
        case when pb.business_line<>'Non Motor' then coalesce(nullif(trim(v.vehicle_no),''),'—')
          else coalesce(nullif(trim(nm.risk_title),''),nullif(trim(nm.risk_details->>'cargoDescription'),''),
            nullif(trim(nm.risk_details->>'projectName'),''),nullif(trim(nm.risk_details->>'businessName'),''),
            nullif(trim(concat_ws(' → ',nullif(trim(nm.transit_from),''),nullif(trim(nm.transit_to),''))),''),
            nullif(trim(nm.nature_of_business),''),nullif(trim(nm.liability_type),''),nullif(trim(nm.risk_location),''),'Non-Motor risk') end risk_reference,
        pb.insurer_name,coalesce(pb.rm_name,'Unassigned') rm_name,pb.intermediary_type,pb.intermediary_code,pb.gross_premium,pb.days_to_expiry,pb.renewal_bucket
      from page_base pb
      left join public.customers c on c.id=pb.customer_id
      left join public.vehicles v on v.id=pb.vehicle_id
      left join public.non_motor_policy_details nm on nm.policy_id=pb.id
    ) x
  ),
  flt as (
    select jsonb_build_object(
      'insurers',coalesce((select jsonb_agg(to_jsonb(x) order by name) from (select distinct insurance_company_id id,insurer_name name from s where insurance_company_id is not null)x),'[]'),
      'rms','[]'::jsonb,
      'intermediaries',coalesce((select jsonb_agg(to_jsonb(x) order by name,code) from (
        select distinct s.intermediary_code code,s.intermediary_type type,
          coalesce(nullif(trim(i.display_name),''),nullif(trim(i.legal_name),''),s.intermediary_code) name
        from s left join public.intermediaries i on i.intermediary_code=s.intermediary_code
        where s.intermediary_code is not null
      )x),'[]'),
      'categories',coalesce((select jsonb_agg(category order by category) from (select distinct category from s where business_line='Non Motor')x),'[]')
    ) data
  )
  select jsonb_build_object(
    'summary',to_jsonb(sm),'buckets',b.data,'insurers',ins.data,'rms',rms.data,
    'register',jsonb_build_object('rows',rr.data,'total_count',(select count(*) from f),'page',pg,'page_size',ps),
    'filters',flt.data
  )
  into result
  from sm,b,ins,rms,rr,flt;

  return coalesce(result,'{}');
end
$function$;
