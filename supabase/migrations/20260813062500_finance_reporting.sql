create or replace function public.get_finance_report(
  p_customer_ids uuid[] default null,
  p_from_date date default null,
  p_to_date date default null,
  p_insurer_id uuid default null,
  p_rm_name text default null,
  p_intermediary_code text default null,
  p_billing_status text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language sql
security definer
set search_path = public
as $$
with params as (
  select greatest(coalesce(p_page,1),1) as page_no,
         least(greatest(coalesce(p_page_size,25),1),100) as page_size
),
bill_agg as (
  select policy_id,
         coalesce(sum(billed_amount),0)::numeric as billed_amount,
         max(bill_date) as latest_bill_date,
         case
           when bool_or(status = 'Billed') then 'Billed'
           when bool_or(status = 'Billing details incomplete') then 'Billing details incomplete'
           else 'Unbilled'
         end as billing_status
  from public.policy_payin_bills
  group by policy_id
),
payout_agg as (
  select policy_id,
         coalesce(sum(gross_payout),0)::numeric as gross_payout,
         coalesce(sum(retention_amount),0)::numeric as retention_amount,
         case
           when bool_or(lower(coalesce(status,'')) = 'paid') then 'Paid'
           when bool_or(lower(coalesce(status,'')) = 'approved') then 'Approved'
           else coalesce(max(status),'Pending')
         end as payout_status,
         max(payout_date) as latest_payout_date
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
    coalesce(p.issuance_date,p.start_date,p.created_at::date) as business_date,
    p.rm_name,
    p.intermediary_code,
    coalesce(c.company_name,c.contact_name,c.customer_code,'—') as customer_name,
    c.customer_code,
    coalesce(v.vehicle_no,'—') as vehicle_no,
    coalesce(ic.name,'Unassigned insurer') as insurer_name,
    coalesce(ppd.gross_premium,p.premium_amount,0)::numeric as gross_premium,
    coalesce(pid.total_projected_payin,0)::numeric as projected_payin,
    coalesce(pid.tds_amount,0)::numeric as payin_tds,
    coalesce(pid.payin_after_tds,0)::numeric as payin_after_tds,
    coalesce(ba.billed_amount,0)::numeric as billed_amount,
    coalesce(ba.billing_status,'Unbilled') as billing_status,
    ba.latest_bill_date,
    coalesce(pa.gross_payout,0)::numeric as gross_payout,
    coalesce(pa.retention_amount,0)::numeric as retention_amount,
    coalesce(pa.payout_status,'Pending') as payout_status,
    pa.latest_payout_date
  from public.policies p
  join public.customers c on c.id=p.customer_id
  left join public.vehicles v on v.id=p.vehicle_id
  left join public.insurance_companies ic on ic.id=p.insurance_company_id
  left join public.policy_premium_details ppd on ppd.policy_id=p.id
  left join public.policy_payin_details pid on pid.policy_id=p.id
  left join bill_agg ba on ba.policy_id=p.id
  left join payout_agg pa on pa.policy_id=p.id
  where (p_customer_ids is null or p.customer_id = any(p_customer_ids))
    and (p_from_date is null or coalesce(p.issuance_date,p.start_date,p.created_at::date) >= p_from_date)
    and (p_to_date is null or coalesce(p.issuance_date,p.start_date,p.created_at::date) <= p_to_date)
    and (p_insurer_id is null or p.insurance_company_id=p_insurer_id)
    and (p_rm_name is null or p.rm_name=p_rm_name)
    and (p_intermediary_code is null or p.intermediary_code=p_intermediary_code)
),
filtered as (
  select * from base
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
    'unbilled_count',count(*) filter (where billing_status='Unbilled')::int,
    'billing_incomplete_count',count(*) filter (where billing_status='Billing details incomplete')::int,
    'billed_count',count(*) filter (where billing_status='Billed')::int,
    'pending_payout_count',count(*) filter (where lower(coalesce(payout_status,'')) <> 'paid')::int
  ) obj from filtered
),
insurers as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.projected_payin desc), '[]'::jsonb) arr
  from (
    select insurance_company_id as id, insurer_name,
           count(*)::int policy_count,
           coalesce(sum(gross_premium),0)::numeric gross_premium,
           coalesce(sum(projected_payin),0)::numeric projected_payin,
           coalesce(sum(payin_after_tds),0)::numeric payin_after_tds,
           coalesce(sum(billed_amount),0)::numeric billed_amount,
           coalesce(sum(gross_payout),0)::numeric gross_payout,
           coalesce(sum(retention_amount),0)::numeric retention_amount
    from filtered group by insurance_company_id,insurer_name
  ) x
),
rms as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.projected_payin desc), '[]'::jsonb) arr
  from (
    select coalesce(rm_name,'Unassigned') rm_name,
           count(*)::int policy_count,
           coalesce(sum(projected_payin),0)::numeric projected_payin,
           coalesce(sum(billed_amount),0)::numeric billed_amount,
           coalesce(sum(gross_payout),0)::numeric gross_payout,
           coalesce(sum(retention_amount),0)::numeric retention_amount
    from filtered group by coalesce(rm_name,'Unassigned')
  ) x
),
billing as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order), '[]'::jsonb) arr
  from (
    select billing_status,
           count(*)::int policy_count,
           coalesce(sum(projected_payin),0)::numeric projected_payin,
           coalesce(sum(billed_amount),0)::numeric billed_amount,
           case billing_status when 'Unbilled' then 1 when 'Billing details incomplete' then 2 when 'Billed' then 3 else 9 end sort_order
    from filtered group by billing_status
  ) x
),
filter_options as (
  select jsonb_build_object(
    'insurers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from (select distinct insurance_company_id id,insurer_name name from base where insurance_company_id is not null) z),'[]'::jsonb),
    'rms',coalesce((select jsonb_agg(rm order by rm) from (select distinct rm_name rm from base where rm_name is not null and btrim(rm_name)<>'' ) z),'[]'::jsonb),
    'intermediaries',coalesce((select jsonb_agg(jsonb_build_object('code',code,'name',name) order by name) from (select distinct b.intermediary_code code, coalesce(i.display_name,i.legal_name,b.intermediary_code) name from base b left join public.intermediaries i on i.intermediary_code=b.intermediary_code where b.intermediary_code is not null and btrim(b.intermediary_code)<>'' ) z),'[]'::jsonb),
    'billing_statuses',coalesce((select jsonb_agg(status order by status) from (select distinct billing_status status from base) z),'[]'::jsonb)
  ) obj
),
register_total as (select count(*)::int total_count from filtered),
register_rows as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.business_date desc nulls last, x.policy_no), '[]'::jsonb) arr
  from (
    select f.*
    from filtered f
    order by business_date desc nulls last, policy_no
    limit least(greatest(coalesce(p_page_size,25),1),100)
    offset ((greatest(coalesce(p_page,1),1)-1) * least(greatest(coalesce(p_page_size,25),1),100))
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
$$;

revoke all on function public.get_finance_report(uuid[],date,date,uuid,text,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.get_finance_report(uuid[],date,date,uuid,text,text,text,integer,integer) to service_role;
