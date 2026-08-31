create or replace function public.get_finance_report_v3(
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
language sql
security definer
set search_path to 'public'
as $function$
with params as (
  select
    greatest(coalesce(p_page,1),1) page_no,
    least(greatest(coalesce(p_page_size,25),1),100) page_size,
    case when p_rm_employee_id is null then null else (
      select full_name from public.employees where id=p_rm_employee_id
    ) end rm_name
),
bill_agg as (
  select
    policy_id,
    case when bool_or(status='Billed') then coalesce(sum(billed_amount),0)::numeric else 0::numeric end billed_amount,
    max(bill_date) filter(where status='Billed') latest_bill_date,
    case
      when bool_or(status='Billed') then 'Billed'
      when bool_or(status='Billing details incomplete') then 'Billing details incomplete'
      else 'Unbilled'
    end billing_status
  from public.policy_payin_bills
  group by policy_id
),
payout_agg as (
  select
    policy_id,
    coalesce(sum(gross_payout),0)::numeric gross_payout,
    coalesce(sum(retention_amount),0)::numeric retention_amount,
    case
      when bool_or(lower(coalesce(status,''))='paid') then 'Paid'
      when bool_or(lower(coalesce(status,''))='approved') then 'Approved'
      else coalesce(max(status),'Pending')
    end payout_status,
    max(payout_date) latest_payout_date
  from public.policy_intermediary_payouts
  group by policy_id
),
base as (
  select
    p.id,
    p.customer_id,
    p.vehicle_id,
    p.insurance_company_id,
    p.policy_no,
    p.policy_type,
    p.policy_product,
    coalesce(nullif(trim(p.business_line),''),'Motor') business_line,
    case
      when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor'
        then coalesce(nullif(trim(nm.category),''),p.policy_type,'Other')
      else coalesce(p.policy_type,'Other')
    end category,
    coalesce(p.issuance_date,p.start_date,p.created_at::date) business_date,
    p.rm_name,
    p.intermediary_code,
    coalesce(ic.name,'Unassigned insurer') insurer_name,
    coalesce(ppd.gross_premium,p.premium_amount,0)::numeric gross_premium,
    coalesce(pid.total_projected_payin,0)::numeric projected_payin,
    coalesce(pid.tds_amount,0)::numeric payin_tds,
    coalesce(pid.payin_after_tds,0)::numeric payin_after_tds,
    coalesce(ba.billed_amount,0)::numeric billed_amount,
    coalesce(ba.billing_status,'Unbilled') billing_status,
    ba.latest_bill_date,
    coalesce(pa.gross_payout,0)::numeric gross_payout,
    coalesce(pa.retention_amount,0)::numeric retention_amount,
    coalesce(pa.payout_status,'Pending') payout_status,
    pa.latest_payout_date,
    nm.risk_title,
    nm.risk_details,
    nm.transit_from,
    nm.transit_to,
    nm.nature_of_business,
    nm.liability_type,
    nm.risk_location
  from public.policies p
  left join public.non_motor_policy_details nm on nm.policy_id=p.id
  left join public.insurance_companies ic on ic.id=p.insurance_company_id
  left join public.policy_premium_details ppd on ppd.policy_id=p.id
  left join public.policy_payin_details pid on pid.policy_id=p.id
  left join bill_agg ba on ba.policy_id=p.id
  left join payout_agg pa on pa.policy_id=p.id,
  params x
  where (p_customer_ids is null or p.customer_id=any(p_customer_ids))
    and (p_from_date is null or coalesce(p.issuance_date,p.start_date,p.created_at::date)>=p_from_date)
    and (p_to_date is null or coalesce(p.issuance_date,p.start_date,p.created_at::date)<=p_to_date)
    and (p_insurer_id is null or p.insurance_company_id=p_insurer_id)
    and (x.rm_name is null or p.rm_name=x.rm_name)
    and (p_intermediary_code is null or p.intermediary_code=p_intermediary_code)
    and (p_business_line is null or lower(coalesce(nullif(trim(p.business_line),''),'Motor'))=lower(p_business_line))
    and (
      p_category is null
      or lower(
        case
          when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor'
            then coalesce(nullif(trim(nm.category),''),p.policy_type,'Other')
          else coalesce(p.policy_type,'Other')
        end
      )=lower(p_category)
    )
),
filtered as (
  select *
  from base
  where p_billing_status is null or billing_status=p_billing_status
),
summary as (
  select jsonb_build_object(
    'policy_count',count(*)::int,
    'gross_premium',coalesce(sum(gross_premium),0),
    'projected_payin',coalesce(sum(projected_payin),0),
    'payin_after_tds',coalesce(sum(payin_after_tds),0),
    'billed_amount',coalesce(sum(billed_amount),0),
    'gross_payout',coalesce(sum(gross_payout),0),
    'retention_amount',coalesce(sum(retention_amount),0),
    'unbilled_count',count(*) filter(where billing_status='Unbilled')::int,
    'billing_incomplete_count',count(*) filter(where billing_status='Billing details incomplete')::int,
    'billed_count',count(*) filter(where billing_status='Billed')::int,
    'pending_payout_count',count(*) filter(where lower(coalesce(payout_status,''))<>'paid')::int,
    'missing_payin_count',count(*) filter(where projected_payin=0)::int,
    'negative_retention_count',count(*) filter(where retention_amount<0)::int
  ) obj
  from filtered
),
insurers as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.projected_payin desc),'[]'::jsonb) arr
  from (
    select
      insurance_company_id id,
      insurer_name,
      count(*)::int policy_count,
      coalesce(sum(gross_premium),0)::numeric gross_premium,
      coalesce(sum(projected_payin),0)::numeric projected_payin,
      coalesce(sum(payin_after_tds),0)::numeric payin_after_tds,
      coalesce(sum(billed_amount),0)::numeric billed_amount,
      coalesce(sum(gross_payout),0)::numeric gross_payout,
      coalesce(sum(retention_amount),0)::numeric retention_amount
    from filtered
    group by insurance_company_id,insurer_name
  ) x
),
rms as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.projected_payin desc),'[]'::jsonb) arr
  from (
    select
      coalesce(rm_name,'Unassigned') rm_name,
      count(*)::int policy_count,
      coalesce(sum(projected_payin),0)::numeric projected_payin,
      coalesce(sum(billed_amount),0)::numeric billed_amount,
      coalesce(sum(gross_payout),0)::numeric gross_payout,
      coalesce(sum(retention_amount),0)::numeric retention_amount
    from filtered
    group by coalesce(rm_name,'Unassigned')
  ) x
),
billing as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order),'[]'::jsonb) arr
  from (
    select
      billing_status,
      count(*)::int policy_count,
      coalesce(sum(projected_payin),0)::numeric projected_payin,
      coalesce(sum(billed_amount),0)::numeric billed_amount,
      case billing_status
        when 'Unbilled' then 1
        when 'Billing details incomplete' then 2
        when 'Billed' then 3
        else 9
      end sort_order
    from filtered
    group by billing_status
  ) x
),
filter_options as (
  select jsonb_build_object(
    'insurers',coalesce((
      select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name)
      from (
        select distinct insurance_company_id id,insurer_name name
        from base
        where insurance_company_id is not null
      ) z
    ),'[]'::jsonb),
    'rms','[]'::jsonb,
    'intermediaries',coalesce((
      select jsonb_agg(jsonb_build_object('code',code,'name',name) order by name)
      from (
        select distinct
          b.intermediary_code code,
          coalesce(i.display_name,i.legal_name,b.intermediary_code) name
        from base b
        left join public.intermediaries i on i.intermediary_code=b.intermediary_code
        where b.intermediary_code is not null
          and btrim(b.intermediary_code)<>''
      ) z
    ),'[]'::jsonb),
    'billing_statuses',coalesce((
      select jsonb_agg(status order by status)
      from (select distinct billing_status status from base) z
    ),'[]'::jsonb),
    'categories',coalesce((
      select jsonb_agg(category order by category)
      from (
        select distinct category
        from base
        where business_line='Non Motor'
      ) z
    ),'[]'::jsonb)
  ) obj
),
register_total as (
  select count(*)::int total_count from filtered
),
register_page as (
  select f.*
  from filtered f
  order by business_date desc nulls last,policy_no
  limit least(greatest(coalesce(p_page_size,25),1),100)
  offset (
    (greatest(coalesce(p_page,1),1)-1)
    * least(greatest(coalesce(p_page_size,25),1),100)
  )
),
register_rows as (
  select coalesce(
    jsonb_agg(to_jsonb(x) order by x.business_date desc nulls last,x.policy_no),
    '[]'::jsonb
  ) arr
  from (
    select
      f.id,
      f.customer_id,
      f.vehicle_id,
      f.insurance_company_id,
      f.policy_no,
      f.policy_type,
      f.policy_product,
      f.business_line,
      f.category,
      f.business_date,
      f.rm_name,
      f.intermediary_code,
      coalesce(c.company_name,c.contact_name,c.customer_code,'—') customer_name,
      c.customer_code,
      coalesce(v.vehicle_no,'') vehicle_no,
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
      f.insurer_name,
      f.gross_premium,
      f.projected_payin,
      f.payin_tds,
      f.payin_after_tds,
      f.billed_amount,
      f.billing_status,
      f.latest_bill_date,
      f.gross_payout,
      f.retention_amount,
      f.payout_status,
      f.latest_payout_date
    from register_page f
    join public.customers c on c.id=f.customer_id
    left join public.vehicles v on v.id=f.vehicle_id
  ) x
)
select jsonb_build_object(
  'summary',(select obj from summary),
  'insurers',(select arr from insurers),
  'rms',(select arr from rms),
  'billing',(select arr from billing),
  'filters',(select obj from filter_options),
  'register',jsonb_build_object(
    'rows',(select arr from register_rows),
    'total_count',(select total_count from register_total),
    'page',(select page_no from params),
    'page_size',(select page_size from params)
  )
);
$function$;
