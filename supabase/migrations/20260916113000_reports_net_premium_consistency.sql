-- Reports net-premium consistency.
-- Keep the previous RPC versions intact for rollback and unknown consumers.

create or replace function public.get_distribution_report_v2(
  p_intermediary_ids uuid[] default null::uuid[],
  p_application_ids uuid[] default null::uuid[],
  p_from_date date default null::date,
  p_to_date date default null::date,
  p_rm_employee_id uuid default null::uuid,
  p_intermediary_type text default null::text,
  p_account_status text default null::text,
  p_page integer default 1,
  p_page_size integer default 25,
  p_onboarding_page integer default 1,
  p_onboarding_page_size integer default 25
)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
with
scoped_intermediaries as (
  select
    i.id,
    i.application_id,
    i.intermediary_code,
    i.intermediary_type,
    i.display_name,
    i.account_status,
    i.compliance_status,
    i.iib_status,
    i.registration_status,
    coalesce(i.associate_employee_id, op.associate_employee_id) as associate_employee_id,
    coalesce(e.full_name, 'Unassigned') as rm_name
  from public.intermediaries i
  left join public.posp_misp_onboarding_profiles op on op.application_id = i.application_id
  left join public.employees e on e.id = coalesce(i.associate_employee_id, op.associate_employee_id)
  where (p_intermediary_ids is null or i.id = any(p_intermediary_ids))
    and (p_rm_employee_id is null or coalesce(i.associate_employee_id, op.associate_employee_id) = p_rm_employee_id)
    and (p_intermediary_type is null or i.intermediary_type = p_intermediary_type)
    and (p_account_status is null or i.account_status = p_account_status)
),
policy_base as (
  select
    p.id,
    p.customer_id,
    p.intermediary_code,
    coalesce(p.issuance_date, p.created_at::date) as business_date,
    coalesce(ppd.gross_premium, p.premium_amount, 0)::numeric as gross_premium,
    coalesce(ppd.net_premium, 0)::numeric as net_premium
  from public.policies p
  left join public.policy_premium_details ppd on ppd.policy_id = p.id
  join scoped_intermediaries si on si.intermediary_code is not null and si.intermediary_code = p.intermediary_code
  where (p_from_date is null or coalesce(p.issuance_date, p.created_at::date) >= p_from_date)
    and (p_to_date is null or coalesce(p.issuance_date, p.created_at::date) <= p_to_date)
),
intermediary_stats as (
  select
    si.id,
    si.application_id,
    si.intermediary_code,
    si.intermediary_type,
    si.display_name,
    si.account_status,
    si.compliance_status,
    si.iib_status,
    si.registration_status,
    si.associate_employee_id,
    si.rm_name,
    count(pb.id)::integer as policy_count,
    count(distinct pb.customer_id)::integer as customer_count,
    coalesce(sum(pb.gross_premium), 0)::numeric as gross_premium,
    coalesce(sum(pb.net_premium), 0)::numeric as net_premium,
    max(pb.business_date) as last_business_date
  from scoped_intermediaries si
  left join policy_base pb on pb.intermediary_code = si.intermediary_code
  group by si.id, si.application_id, si.intermediary_code, si.intermediary_type, si.display_name,
           si.account_status, si.compliance_status, si.iib_status, si.registration_status,
           si.associate_employee_id, si.rm_name
),
rm_stats as (
  select
    associate_employee_id as employee_id,
    rm_name as name,
    count(*)::integer as intermediary_count,
    count(*) filter (where account_status = 'active')::integer as active_intermediary_count,
    count(*) filter (where policy_count > 0)::integer as producing_intermediary_count,
    sum(policy_count)::integer as policy_count,
    coalesce(sum(customer_count), 0)::integer as customer_count,
    coalesce(sum(gross_premium), 0)::numeric as gross_premium,
    coalesce(sum(net_premium), 0)::numeric as net_premium
  from intermediary_stats
  group by associate_employee_id, rm_name
),
scoped_applications as (
  select
    a.id,
    a.application_reference,
    a.requested_type,
    a.final_type,
    a.status,
    a.registration_status,
    a.submitted_at,
    a.created_at,
    a.completed_at,
    op.associate_employee_id,
    coalesce(e.full_name, 'Unassigned') as rm_name,
    coalesce(
      nullif(i.display_name, ''),
      nullif(op.pos_name, ''),
      nullif(op.misp_name, ''),
      nullif(a.draft_data->>'fullName', ''),
      nullif(a.draft_data->>'name', ''),
      nullif(a.application_reference, ''),
      'Application'
    ) as applicant_name,
    coalesce(a.final_type, a.requested_type) as effective_type,
    t.training_status,
    t.exam_status,
    t.agreement_status,
    t.iib_registration_status,
    greatest(0, current_date - coalesce(a.submitted_at, a.created_at)::date)::integer as age_days,
    case
      when a.registration_status = 'rejected' then 'Rejected'
      when a.registration_status = 'partner_active' then 'Partner active'
      when a.registration_status = 'iib_registered' then 'IIB registered'
      when a.registration_status like 'training_%' then 'Training'
      when a.registration_status like 'exam_%' then 'Exam'
      when a.registration_status like 'agreement_%' then 'Agreement'
      when a.registration_status like 'iib_%' then 'IIB registration'
      when a.registration_status in ('pan_checking', 'documents_pending', 'existing_posp_documents_pending', 'existing_posp_ready_for_activation') then 'Compliance'
      else 'Primary review'
    end as stage
  from public.intermediary_onboarding_applications a
  left join public.posp_misp_onboarding_profiles op on op.application_id = a.id
  left join public.employees e on e.id = op.associate_employee_id
  left join public.intermediary_training_exam_assignments t on t.application_id = a.id
  left join public.intermediaries i on i.application_id = a.id
  where (p_application_ids is null or a.id = any(p_application_ids))
    and (p_rm_employee_id is null or op.associate_employee_id = p_rm_employee_id)
    and (p_intermediary_type is null or coalesce(a.final_type, a.requested_type) = p_intermediary_type)
),
summary as (
  select jsonb_build_object(
    'intermediary_count', (select count(*) from intermediary_stats),
    'active_intermediary_count', (select count(*) from intermediary_stats where account_status = 'active'),
    'partner_count', (select count(*) from intermediary_stats where intermediary_type = 'partner'),
    'posp_count', (select count(*) from intermediary_stats where intermediary_type = 'posp'),
    'misp_count', (select count(*) from intermediary_stats where intermediary_type = 'misp'),
    'producing_intermediary_count', (select count(*) from intermediary_stats where policy_count > 0),
    'policy_count', (select count(*) from policy_base),
    'customer_count', (select count(distinct customer_id) from policy_base),
    'gross_premium', coalesce((select sum(gross_premium) from policy_base), 0),
    'net_premium', coalesce((select sum(net_premium) from policy_base), 0),
    'onboarding_open_count', (select count(*) from scoped_applications where registration_status not in ('partner_active','iib_registered','rejected'))
  ) as value
),
onboarding_summary as (
  select jsonb_build_object(
    'total', count(*),
    'open', count(*) filter (where registration_status not in ('partner_active','iib_registered','rejected')),
    'compliance', count(*) filter (where stage = 'Compliance' or stage = 'Primary review'),
    'training', count(*) filter (where stage = 'Training'),
    'exam', count(*) filter (where stage = 'Exam'),
    'agreement', count(*) filter (where stage = 'Agreement'),
    'iib', count(*) filter (where stage = 'IIB registration'),
    'completed', count(*) filter (where registration_status in ('partner_active','iib_registered')),
    'rejected', count(*) filter (where registration_status = 'rejected')
  ) as value
  from scoped_applications
),
rm_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_id', employee_id,
    'name', name,
    'intermediary_count', intermediary_count,
    'active_intermediary_count', active_intermediary_count,
    'producing_intermediary_count', producing_intermediary_count,
    'policy_count', policy_count,
    'customer_count', customer_count,
    'gross_premium', gross_premium,
    'net_premium', net_premium
  ) order by net_premium desc, intermediary_count desc, name), '[]'::jsonb) as value
  from rm_stats
),
intermediary_rows as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'application_id', application_id,
    'code', intermediary_code,
    'name', display_name,
    'type', intermediary_type,
    'rm_employee_id', associate_employee_id,
    'rm_name', rm_name,
    'account_status', account_status,
    'compliance_status', compliance_status,
    'iib_status', iib_status,
    'registration_status', registration_status,
    'policy_count', policy_count,
    'customer_count', customer_count,
    'gross_premium', gross_premium,
    'net_premium', net_premium,
    'last_business_date', last_business_date
  ) order by net_premium desc, display_name), '[]'::jsonb) as value
  from (
    select * from intermediary_stats
    order by net_premium desc, display_name
    limit greatest(1, least(p_page_size, 100))
    offset (greatest(p_page, 1) - 1) * greatest(1, least(p_page_size, 100))
  ) q
),
onboarding_rows as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'application_reference', application_reference,
    'name', applicant_name,
    'type', effective_type,
    'rm_employee_id', associate_employee_id,
    'rm_name', rm_name,
    'stage', stage,
    'registration_status', registration_status,
    'training_status', training_status,
    'exam_status', exam_status,
    'agreement_status', agreement_status,
    'iib_registration_status', iib_registration_status,
    'age_days', age_days,
    'submitted_at', submitted_at,
    'completed_at', completed_at
  ) order by age_days desc, applicant_name), '[]'::jsonb) as value
  from (
    select * from scoped_applications
    order by age_days desc, applicant_name
    limit greatest(1, least(p_onboarding_page_size, 100))
    offset (greatest(p_onboarding_page, 1) - 1) * greatest(1, least(p_onboarding_page_size, 100))
  ) q
),
filter_rms as (
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', full_name) order by full_name), '[]'::jsonb) as value
  from (
    select distinct e.id, e.full_name
    from public.intermediaries i
    left join public.posp_misp_onboarding_profiles op on op.application_id = i.application_id
    join public.employees e on e.id = coalesce(i.associate_employee_id, op.associate_employee_id)
    where (p_intermediary_ids is null or i.id = any(p_intermediary_ids))
      and e.employment_status = 'active'
  ) q
)
select jsonb_build_object(
  'summary', (select value from summary),
  'rms', (select value from rm_json),
  'intermediaries', jsonb_build_object(
    'rows', (select value from intermediary_rows),
    'total_count', (select count(*) from intermediary_stats),
    'page', greatest(p_page, 1),
    'page_size', greatest(1, least(p_page_size, 100))
  ),
  'onboarding_summary', (select value from onboarding_summary),
  'onboarding', jsonb_build_object(
    'rows', (select value from onboarding_rows),
    'total_count', (select count(*) from scoped_applications),
    'page', greatest(p_onboarding_page, 1),
    'page_size', greatest(1, least(p_onboarding_page_size, 100))
  ),
  'filters', jsonb_build_object(
    'rms', (select value from filter_rms),
    'types', jsonb_build_array('partner','posp','misp'),
    'account_statuses', jsonb_build_array('active','under_onboarding','inactive','suspended','terminated','rejected')
  )
);
$function$;

revoke all on function public.get_distribution_report_v2(uuid[], uuid[], date, date, uuid, text, text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.get_distribution_report_v2(uuid[], uuid[], date, date, uuid, text, text, integer, integer, integer, integer) to service_role;

create or replace function public.get_renewal_report_v4(
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
      coalesce(d.net_premium,0)::numeric net_premium,
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
      count(distinct customer_id) filter(where days_to_expiry>=0)::int customer_count,coalesce(sum(net_premium) filter(where days_to_expiry>=0),0) premium_at_risk,
      coalesce(sum(net_premium) filter(where days_to_expiry between 0 and 30),0) premium_due_30,min(end_date) filter(where days_to_expiry>=0) nearest_expiry
    from w
  ),
  b as (select jsonb_agg(to_jsonb(x) order by n) data from (
    select 1 n,'expired' key,'Expired' label,count(*) filter(where renewal_bucket='expired')::int policy_count,coalesce(sum(gross_premium) filter(where renewal_bucket='expired'),0) gross_premium,coalesce(sum(net_premium) filter(where renewal_bucket='expired'),0) net_premium from w
    union all select 2,'due_30','0–30 days',count(*) filter(where renewal_bucket='due_30')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_30'),0),coalesce(sum(net_premium) filter(where renewal_bucket='due_30'),0) from w
    union all select 3,'due_31_60','31–60 days',count(*) filter(where renewal_bucket='due_31_60')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_31_60'),0),coalesce(sum(net_premium) filter(where renewal_bucket='due_31_60'),0) from w
    union all select 4,'due_61_90','61–90 days',count(*) filter(where renewal_bucket='due_61_90')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_61_90'),0),coalesce(sum(net_premium) filter(where renewal_bucket='due_61_90'),0) from w
    union all select 5,'due_91_180','91–180 days',count(*) filter(where renewal_bucket='due_91_180')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_91_180'),0),coalesce(sum(net_premium) filter(where renewal_bucket='due_91_180'),0) from w
    union all select 6,'due_181_365','181–365 days',count(*) filter(where renewal_bucket='due_181_365')::int,coalesce(sum(gross_premium) filter(where renewal_bucket='due_181_365'),0),coalesce(sum(net_premium) filter(where renewal_bucket='due_181_365'),0) from w
  )x),
  ins as (select coalesce(jsonb_agg(to_jsonb(x) order by premium_at_risk desc,insurer_name),'[]') data from (
    select insurance_company_id id,insurer_name,count(*) filter(where days_to_expiry>=0)::int upcoming_policy_count,count(*) filter(where days_to_expiry between 0 and 30)::int due_30_count,
      count(*) filter(where days_to_expiry<0)::int expired_count,coalesce(sum(net_premium) filter(where days_to_expiry>=0),0) premium_at_risk,min(end_date) filter(where days_to_expiry>=0) nearest_expiry
    from w group by insurance_company_id,insurer_name)x),
  rms as (select coalesce(jsonb_agg(to_jsonb(x) order by premium_at_risk desc,rm_name),'[]') data from (
    select coalesce(rm_name,'Unassigned') rm_name,count(*) filter(where days_to_expiry>=0)::int upcoming_policy_count,count(distinct customer_id) filter(where days_to_expiry>=0)::int customer_count,
      count(*) filter(where days_to_expiry between 0 and 30)::int due_30_count,count(*) filter(where days_to_expiry<0)::int expired_count,
      coalesce(sum(net_premium) filter(where days_to_expiry>=0),0) premium_at_risk,min(end_date) filter(where days_to_expiry>=0) nearest_expiry
    from w group by coalesce(rm_name,'Unassigned'))x),
  rr as (select coalesce(jsonb_agg(to_jsonb(x) order by end_date,policy_no),'[]') data from (
    select id,policy_no,policy_type,policy_product,business_line,category,start_date,end_date,status,customer_name,customer_code,vehicle_no,risk_reference,
      insurer_name,coalesce(rm_name,'Unassigned') rm_name,intermediary_type,intermediary_code,gross_premium,net_premium,days_to_expiry,renewal_bucket
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
end $function$;

revoke all on function public.get_renewal_report_v4(uuid[], integer, uuid, uuid, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_renewal_report_v4(uuid[], integer, uuid, uuid, text, text, text, text, integer, integer) to service_role;

create or replace function public.get_finance_report_v4(
  p_customer_ids uuid[] default null::uuid[],
  p_from_date date default null::date,
  p_to_date date default null::date,
  p_insurer_id uuid default null::uuid,
  p_rm_employee_id uuid default null::uuid,
  p_intermediary_code text default null::text,
  p_business_line text default null::text,
  p_category text default null::text,
  p_billing_status text default null::text,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  result jsonb;
  enriched_rows jsonb;
begin
  result := public.get_finance_report_v3(
    p_customer_ids,
    p_from_date,
    p_to_date,
    p_insurer_id,
    p_rm_employee_id,
    p_intermediary_code,
    p_business_line,
    p_category,
    p_billing_status,
    p_page,
    p_page_size
  );

  select coalesce(jsonb_agg(row_data || jsonb_build_object('net_premium', coalesce(ppd.net_premium, 0)) order by ord), '[]'::jsonb)
  into enriched_rows
  from jsonb_array_elements(coalesce(result #> '{register,rows}', '[]'::jsonb)) with ordinality as r(row_data, ord)
  left join public.policy_premium_details ppd on ppd.policy_id = nullif(r.row_data->>'id','')::uuid;

  return jsonb_set(coalesce(result, '{}'::jsonb), '{register,rows}', coalesce(enriched_rows, '[]'::jsonb), true);
end $function$;

revoke all on function public.get_finance_report_v4(uuid[], date, date, uuid, uuid, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_finance_report_v4(uuid[], date, date, uuid, uuid, text, text, text, text, integer, integer) to service_role;
