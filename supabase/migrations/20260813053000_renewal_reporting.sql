create or replace function public.get_renewal_report(
  p_customer_ids uuid[] default null,
  p_horizon_days integer default 365,
  p_insurer_id uuid default null,
  p_rm_name text default null,
  p_intermediary_code text default null,
  p_bucket text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_horizon integer := greatest(1, least(coalesce(p_horizon_days, 365), 3650));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := greatest(1, least(coalesce(p_page_size, 25), 10001));
  v_offset integer := (v_page - 1) * v_page_size;
  v_result jsonb;
begin
  with scoped as (
    select p.id,p.customer_id,p.policy_no,p.policy_type,p.start_date,p.end_date,p.status,p.insurance_company_id,p.intermediary_type,p.intermediary_code,
      nullif(trim(p.rm_name),'') as rm_name,coalesce(ppd.gross_premium,p.premium_amount,0)::numeric as gross_premium,
      coalesce(nullif(trim(c.company_name),''),nullif(trim(c.contact_name),''),c.customer_code,'Customer') as customer_name,c.customer_code,
      coalesce(nullif(trim(v.vehicle_no),''),'—') as vehicle_no,coalesce(nullif(trim(ic.name),''),'Unassigned') as insurer_name,
      (p.end_date-current_date)::integer as days_to_expiry,
      case when p.end_date<current_date then 'expired' when p.end_date<=current_date+30 then 'due_30' when p.end_date<=current_date+60 then 'due_31_60'
        when p.end_date<=current_date+90 then 'due_61_90' when p.end_date<=current_date+180 then 'due_91_180' when p.end_date<=current_date+365 then 'due_181_365' else 'later' end as renewal_bucket
    from public.policies p
    left join public.policy_premium_details ppd on ppd.policy_id=p.id
    left join public.customers c on c.id=p.customer_id
    left join public.vehicles v on v.id=p.vehicle_id
    left join public.insurance_companies ic on ic.id=p.insurance_company_id
    where p.end_date is not null and (p_customer_ids is null or p.customer_id=any(p_customer_ids))
      and (p_insurer_id is null or p.insurance_company_id=p_insurer_id)
      and (p_rm_name is null or lower(coalesce(nullif(trim(p.rm_name),''),'Unassigned'))=lower(p_rm_name))
      and (p_intermediary_code is null or p.intermediary_code=p_intermediary_code)
  ), windowed as (select * from scoped where days_to_expiry<0 or days_to_expiry between 0 and v_horizon),
  filtered as (select * from windowed where p_bucket is null or renewal_bucket=p_bucket),
  summary as (
    select count(*) filter(where days_to_expiry>=0)::integer as upcoming_policy_count,count(*) filter(where days_to_expiry<0)::integer as expired_policy_count,
      count(*) filter(where days_to_expiry between 0 and 30)::integer as due_30_count,count(*) filter(where days_to_expiry between 0 and 90)::integer as due_90_count,
      count(distinct customer_id) filter(where days_to_expiry>=0)::integer as customer_count,coalesce(sum(gross_premium) filter(where days_to_expiry>=0),0)::numeric as premium_at_risk,
      coalesce(sum(gross_premium) filter(where days_to_expiry between 0 and 30),0)::numeric as premium_due_30,min(end_date) filter(where days_to_expiry>=0) as nearest_expiry from windowed
  ), buckets as (
    select jsonb_agg(to_jsonb(x) order by x.sort_order) data from (
      select 1 sort_order,'expired'::text key,'Expired'::text label,count(*) filter(where renewal_bucket='expired')::integer policy_count,coalesce(sum(gross_premium) filter(where renewal_bucket='expired'),0)::numeric gross_premium from windowed
      union all select 2,'due_30','0–30 days',count(*) filter(where renewal_bucket='due_30')::integer,coalesce(sum(gross_premium) filter(where renewal_bucket='due_30'),0)::numeric from windowed
      union all select 3,'due_31_60','31–60 days',count(*) filter(where renewal_bucket='due_31_60')::integer,coalesce(sum(gross_premium) filter(where renewal_bucket='due_31_60'),0)::numeric from windowed
      union all select 4,'due_61_90','61–90 days',count(*) filter(where renewal_bucket='due_61_90')::integer,coalesce(sum(gross_premium) filter(where renewal_bucket='due_61_90'),0)::numeric from windowed
      union all select 5,'due_91_180','91–180 days',count(*) filter(where renewal_bucket='due_91_180')::integer,coalesce(sum(gross_premium) filter(where renewal_bucket='due_91_180'),0)::numeric from windowed
      union all select 6,'due_181_365','181–365 days',count(*) filter(where renewal_bucket='due_181_365')::integer,coalesce(sum(gross_premium) filter(where renewal_bucket='due_181_365'),0)::numeric from windowed
    ) x
  ), insurer_rows as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.premium_at_risk desc,x.insurer_name),'[]'::jsonb) data from (
      select insurance_company_id id,insurer_name,count(*) filter(where days_to_expiry>=0)::integer upcoming_policy_count,count(*) filter(where days_to_expiry between 0 and 30)::integer due_30_count,
        count(*) filter(where days_to_expiry<0)::integer expired_count,coalesce(sum(gross_premium) filter(where days_to_expiry>=0),0)::numeric premium_at_risk,min(end_date) filter(where days_to_expiry>=0) nearest_expiry
      from windowed group by insurance_company_id,insurer_name
    ) x
  ), rm_rows as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.premium_at_risk desc,x.rm_name),'[]'::jsonb) data from (
      select coalesce(rm_name,'Unassigned') rm_name,count(*) filter(where days_to_expiry>=0)::integer upcoming_policy_count,count(distinct customer_id) filter(where days_to_expiry>=0)::integer customer_count,
        count(*) filter(where days_to_expiry between 0 and 30)::integer due_30_count,count(*) filter(where days_to_expiry<0)::integer expired_count,
        coalesce(sum(gross_premium) filter(where days_to_expiry>=0),0)::numeric premium_at_risk,min(end_date) filter(where days_to_expiry>=0) nearest_expiry
      from windowed group by coalesce(rm_name,'Unassigned')
    ) x
  ), register_count as (select count(*)::integer total_count from filtered), register_rows as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.end_date,x.policy_no),'[]'::jsonb) data from (
      select id,policy_no,policy_type,start_date,end_date,status,customer_name,customer_code,vehicle_no,insurer_name,coalesce(rm_name,'Unassigned') rm_name,
        intermediary_type,intermediary_code,gross_premium,days_to_expiry,renewal_bucket from filtered order by end_date,policy_no limit v_page_size offset v_offset
    ) x
  ), filter_values as (
    select jsonb_build_object(
      'insurers',coalesce((select jsonb_agg(to_jsonb(i) order by i.name) from (select distinct insurance_company_id id,insurer_name name from scoped where insurance_company_id is not null)i),'[]'::jsonb),
      'rms',coalesce((select jsonb_agg(r.name order by r.name) from (select distinct coalesce(rm_name,'Unassigned') name from scoped)r),'[]'::jsonb),
      'intermediaries',coalesce((select jsonb_agg(to_jsonb(i) order by i.name,i.code) from (
        select distinct s.intermediary_code code,s.intermediary_type type,coalesce(nullif(trim(im.display_name),''),nullif(trim(im.legal_name),''),s.intermediary_code) name
        from scoped s left join public.intermediaries im on im.intermediary_code=s.intermediary_code where s.intermediary_code is not null
      )i),'[]'::jsonb)
    ) data
  )
  select jsonb_build_object('summary',to_jsonb(summary),'buckets',coalesce(buckets.data,'[]'::jsonb),'insurers',insurer_rows.data,'rms',rm_rows.data,
    'register',jsonb_build_object('rows',register_rows.data,'total_count',register_count.total_count,'page',v_page,'page_size',v_page_size),'filters',filter_values.data)
  into v_result from summary,buckets,insurer_rows,rm_rows,register_count,register_rows,filter_values;
  return coalesce(v_result,'{}'::jsonb);
end;
$$;

revoke all on function public.get_renewal_report(uuid[],integer,uuid,text,text,text,integer,integer) from public;
revoke all on function public.get_renewal_report(uuid[],integer,uuid,text,text,text,integer,integer) from anon;
revoke all on function public.get_renewal_report(uuid[],integer,uuid,text,text,text,integer,integer) from authenticated;
grant execute on function public.get_renewal_report(uuid[],integer,uuid,text,text,text,integer,integer) to service_role;
