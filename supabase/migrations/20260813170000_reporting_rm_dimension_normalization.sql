-- Reporting UX R6: normalize the Relationship Manager dimension on stable employee IDs.
-- Backward compatible: existing report RPCs remain untouched while *_v2 functions are introduced.

alter table public.policies
  add column if not exists rm_employee_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'policies_rm_employee_id_fkey'
      and conrelid = 'public.policies'::regclass
  ) then
    alter table public.policies
      add constraint policies_rm_employee_id_fkey
      foreign key (rm_employee_id)
      references public.employees(id)
      on delete set null;
  end if;
end $$;

create index if not exists policies_rm_employee_id_idx
  on public.policies(rm_employee_id);

create or replace function public.sync_policy_rm_employee_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_employee_name text;
begin
  v_employee_id := null;
  v_employee_name := null;

  if nullif(btrim(new.intermediary_code), '') is not null then
    select coalesce(i.associate_employee_id, op.associate_employee_id), e.full_name
      into v_employee_id, v_employee_name
    from public.intermediaries i
    left join public.posp_misp_onboarding_profiles op on op.application_id = i.application_id
    left join public.employees e on e.id = coalesce(i.associate_employee_id, op.associate_employee_id)
    where i.intermediary_code = new.intermediary_code
    order by i.updated_at desc nulls last, i.created_at desc nulls last
    limit 1;
  end if;

  if v_employee_id is null and nullif(btrim(new.rm_name), '') is not null then
    select min(e.id), min(e.full_name)
      into v_employee_id, v_employee_name
    from public.employees e
    where lower(btrim(e.full_name)) = lower(btrim(new.rm_name))
    having count(*) = 1;
  end if;

  new.rm_employee_id := v_employee_id;
  if v_employee_name is not null then
    new.rm_name := v_employee_name;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_policy_rm_employee_id on public.policies;
create trigger trg_sync_policy_rm_employee_id
before insert or update of intermediary_code, rm_name
on public.policies
for each row
execute function public.sync_policy_rm_employee_id();

-- Backfill from the canonical intermediary assignment first.
with resolved as (
  select
    p.id as policy_id,
    coalesce(i.associate_employee_id, op.associate_employee_id) as employee_id,
    e.full_name as employee_name
  from public.policies p
  left join public.intermediaries i on i.intermediary_code = p.intermediary_code
  left join public.posp_misp_onboarding_profiles op on op.application_id = i.application_id
  left join public.employees e on e.id = coalesce(i.associate_employee_id, op.associate_employee_id)
)
update public.policies p
set rm_employee_id = r.employee_id,
    rm_name = coalesce(r.employee_name, p.rm_name)
from resolved r
where r.policy_id = p.id
  and r.employee_id is not null;

-- Safe fallback for historical rows that have only a unique employee name.
with unique_names as (
  select lower(btrim(full_name)) as normalized_name,
         min(id) as employee_id,
         min(full_name) as employee_name
  from public.employees
  where nullif(btrim(full_name), '') is not null
  group by lower(btrim(full_name))
  having count(*) = 1
)
update public.policies p
set rm_employee_id = u.employee_id,
    rm_name = u.employee_name
from unique_names u
where p.rm_employee_id is null
  and nullif(btrim(p.rm_name), '') is not null
  and lower(btrim(p.rm_name)) = u.normalized_name;

create or replace function public.get_policy_business_report_v2(
  p_customer_ids uuid[] default null,
  p_from_date date default null,
  p_to_date date default null,
  p_insurer_id uuid default null,
  p_rm_employee_id uuid default null,
  p_intermediary_code text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with scope_base as (
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
    p.rm_employee_id,
    coalesce(nullif(btrim(e.full_name), ''), nullif(btrim(p.rm_name), '')) as rm_name,
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
  left join public.employees e on e.id = p.rm_employee_id
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
    and (p_rm_employee_id is null or rm_employee_id = p_rm_employee_id)
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
  select date_trunc('month', business_date)::date as month,
         count(*)::bigint as policy_count,
         coalesce(sum(gross_premium), 0)::numeric as gross_premium
  from filtered
  group by 1
  order by 1 desc
  limit 24
),
trend as (
  select coalesce(jsonb_agg(jsonb_build_object('month', month, 'policy_count', policy_count, 'gross_premium', gross_premium) order by month), '[]'::jsonb) as rows
  from trend_ranked
),
insurer_ranked as (
  select insurance_company_id as id,
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
  select rm_employee_id as employee_id,
         coalesce(rm_name, 'Unassigned') as name,
         count(*)::bigint as policy_count,
         count(distinct nullif(intermediary_code, ''))::bigint as intermediary_count,
         coalesce(sum(gross_premium), 0)::numeric as gross_premium,
         coalesce(avg(nullif(gross_premium, 0)), 0)::numeric as average_premium
  from filtered
  group by rm_employee_id, coalesce(rm_name, 'Unassigned')
  order by gross_premium desc, policy_count desc, name
  limit 12
),
rm_summary as (
  select coalesce(jsonb_agg(to_jsonb(rm_ranked) order by gross_premium desc, policy_count desc, name), '[]'::jsonb) as rows
  from rm_ranked
),
filter_insurers as (
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'::jsonb) as rows
  from (select distinct insurance_company_id as id, insurer_name as name from scope_base) x
),
filter_rms as (
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'::jsonb) as rows
  from (
    select distinct rm_employee_id as id, rm_name as name
    from scope_base
    where rm_employee_id is not null and rm_name is not null
  ) x
),
filter_intermediaries as (
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'type', intermediary_type, 'name', display_name) order by display_name, code), '[]'::jsonb) as rows
  from (
    select distinct sb.intermediary_code as code,
           sb.intermediary_type,
           coalesce(i.display_name, sb.intermediary_code) as display_name
    from scope_base sb
    left join public.intermediaries i on i.intermediary_code = sb.intermediary_code
    where sb.intermediary_code is not null and sb.intermediary_code <> ''
  ) x
),
row_page as (
  select f.*
  from filtered f
  order by f.business_date desc, f.created_at desc, f.policy_no
  offset ((greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 25), 1), 200))
  limit least(greatest(coalesce(p_page_size, 25), 1), 200)
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
    'rm_employee_id', rm_employee_id,
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
    'page', greatest(coalesce(p_page, 1), 1),
    'page_size', least(greatest(coalesce(p_page_size, 25), 1), 200)
  )
);
$$;

revoke all on function public.get_policy_business_report_v2(uuid[],date,date,uuid,uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.get_policy_business_report_v2(uuid[],date,date,uuid,uuid,text,integer,integer) to postgres, service_role;

create or replace function public.get_finance_report_v2(
  p_customer_ids uuid[] default null,
  p_from_date date default null,
  p_to_date date default null,
  p_insurer_id uuid default null,
  p_rm_employee_id uuid default null,
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
         case when bool_or(status='Billed') then coalesce(sum(billed_amount),0)::numeric else 0::numeric end as billed_amount,
         max(bill_date) filter (where status='Billed') as latest_bill_date,
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
    p.id,p.customer_id,p.vehicle_id,p.insurance_company_id,p.policy_no,p.policy_type,
    coalesce(p.issuance_date,p.start_date,p.created_at::date) as business_date,
    p.rm_employee_id,
    coalesce(nullif(btrim(e.full_name), ''), nullif(btrim(p.rm_name), '')) as rm_name,
    p.intermediary_code,
    coalesce(c.company_name,c.contact_name,c.customer_code,'—') as customer_name,c.customer_code,
    coalesce(v.vehicle_no,'—') as vehicle_no,coalesce(ic.name,'Unassigned insurer') as insurer_name,
    coalesce(ppd.gross_premium,p.premium_amount,0)::numeric as gross_premium,
    coalesce(pid.total_projected_payin,0)::numeric as projected_payin,
    coalesce(pid.tds_amount,0)::numeric as payin_tds,
    coalesce(pid.payin_after_tds,0)::numeric as payin_after_tds,
    coalesce(ba.billed_amount,0)::numeric as billed_amount,
    coalesce(ba.billing_status,'Unbilled') as billing_status,ba.latest_bill_date,
    coalesce(pa.gross_payout,0)::numeric as gross_payout,
    coalesce(pa.retention_amount,0)::numeric as retention_amount,
    coalesce(pa.payout_status,'Pending') as payout_status,pa.latest_payout_date
  from public.policies p
  left join public.employees e on e.id=p.rm_employee_id
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
    and (p_rm_employee_id is null or p.rm_employee_id=p_rm_employee_id)
    and (p_intermediary_code is null or p.intermediary_code=p_intermediary_code)
),
filtered as (select * from base where p_billing_status is null or billing_status=p_billing_status),
summary as (
  select jsonb_build_object(
    'policy_count',count(*)::int,'gross_premium',coalesce(sum(gross_premium),0),
    'projected_payin',coalesce(sum(projected_payin),0),'payin_after_tds',coalesce(sum(payin_after_tds),0),
    'billed_amount',coalesce(sum(billed_amount),0),'gross_payout',coalesce(sum(gross_payout),0),
    'retention_amount',coalesce(sum(retention_amount),0),
    'unbilled_count',count(*) filter (where billing_status='Unbilled')::int,
    'billing_incomplete_count',count(*) filter (where billing_status='Billing details incomplete')::int,
    'billed_count',count(*) filter (where billing_status='Billed')::int,
    'pending_payout_count',count(*) filter (where lower(coalesce(payout_status,'')) <> 'paid')::int,
    'missing_payin_count',count(*) filter (where projected_payin=0)::int,
    'negative_retention_count',count(*) filter (where retention_amount<0)::int
  ) obj from filtered
),
insurers as (
 select coalesce(jsonb_agg(to_jsonb(x) order by x.projected_payin desc),'[]'::jsonb) arr from (
  select insurance_company_id id,insurer_name,count(*)::int policy_count,coalesce(sum(gross_premium),0)::numeric gross_premium,
  coalesce(sum(projected_payin),0)::numeric projected_payin,coalesce(sum(payin_after_tds),0)::numeric payin_after_tds,
  coalesce(sum(billed_amount),0)::numeric billed_amount,coalesce(sum(gross_payout),0)::numeric gross_payout,
  coalesce(sum(retention_amount),0)::numeric retention_amount from filtered group by insurance_company_id,insurer_name
 ) x
),
rms as (
 select coalesce(jsonb_agg(to_jsonb(x) order by x.projected_payin desc),'[]'::jsonb) arr from (
  select rm_employee_id,
         coalesce(rm_name,'Unassigned') rm_name,
         count(*)::int policy_count,
         coalesce(sum(projected_payin),0)::numeric projected_payin,
         coalesce(sum(billed_amount),0)::numeric billed_amount,
         coalesce(sum(gross_payout),0)::numeric gross_payout,
         coalesce(sum(retention_amount),0)::numeric retention_amount
  from filtered
  group by rm_employee_id,coalesce(rm_name,'Unassigned')
 ) x
),
billing as (
 select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order),'[]'::jsonb) arr from (
  select billing_status,count(*)::int policy_count,coalesce(sum(projected_payin),0)::numeric projected_payin,
  coalesce(sum(billed_amount),0)::numeric billed_amount,
  case billing_status when 'Unbilled' then 1 when 'Billing details incomplete' then 2 when 'Billed' then 3 else 9 end sort_order
  from filtered group by billing_status
 ) x
),
filter_options as (
 select jsonb_build_object(
  'insurers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from (select distinct insurance_company_id id,insurer_name name from base where insurance_company_id is not null) z),'[]'::jsonb),
  'rms',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from (select distinct rm_employee_id id,rm_name name from base where rm_employee_id is not null and rm_name is not null) z),'[]'::jsonb),
  'intermediaries',coalesce((select jsonb_agg(jsonb_build_object('code',code,'name',name) order by name) from (select distinct b.intermediary_code code,coalesce(i.display_name,i.legal_name,b.intermediary_code) name from base b left join public.intermediaries i on i.intermediary_code=b.intermediary_code where b.intermediary_code is not null and btrim(b.intermediary_code)<>'' ) z),'[]'::jsonb),
  'billing_statuses',coalesce((select jsonb_agg(status order by status) from (select distinct billing_status status from base) z),'[]'::jsonb)
 ) obj
),
register_total as (select count(*)::int total_count from filtered),
register_rows as (
 select coalesce(jsonb_agg(to_jsonb(x) order by x.business_date desc nulls last,x.policy_no),'[]'::jsonb) arr from (
  select f.* from filtered f order by business_date desc nulls last,policy_no
  limit least(greatest(coalesce(p_page_size,25),1),100)
  offset ((greatest(coalesce(p_page,1),1)-1)*least(greatest(coalesce(p_page_size,25),1),100))
 ) x
)
select jsonb_build_object('summary',(select obj from summary),'insurers',(select arr from insurers),'rms',(select arr from rms),'billing',(select arr from billing),'filters',(select obj from filter_options),'register',jsonb_build_object('rows',(select arr from register_rows),'total_count',(select total_count from register_total),'page',(select page_no from params),'page_size',(select page_size from params)));
$$;

revoke all on function public.get_finance_report_v2(uuid[],date,date,uuid,uuid,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.get_finance_report_v2(uuid[],date,date,uuid,uuid,text,text,integer,integer) to postgres, service_role;

create or replace function public.get_renewal_report_v2(
  p_customer_ids uuid[] default null,
  p_horizon_days integer default 365,
  p_insurer_id uuid default null,
  p_rm_employee_id uuid default null,
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
    select
      p.id, p.customer_id, p.policy_no, p.policy_type, p.start_date, p.end_date, p.status,
      p.insurance_company_id, p.intermediary_type, p.intermediary_code, p.rm_employee_id,
      coalesce(nullif(btrim(e.full_name), ''), nullif(btrim(p.rm_name), '')) as rm_name,
      coalesce(ppd.gross_premium, p.premium_amount, 0)::numeric as gross_premium,
      coalesce(nullif(trim(c.company_name), ''), nullif(trim(c.contact_name), ''), c.customer_code, 'Customer') as customer_name,
      c.customer_code,
      coalesce(nullif(trim(v.vehicle_no), ''), '—') as vehicle_no,
      coalesce(nullif(trim(ic.name), ''), 'Unassigned') as insurer_name,
      (p.end_date - current_date)::integer as days_to_expiry,
      case
        when p.end_date < current_date then 'expired'
        when p.end_date <= current_date + 30 then 'due_30'
        when p.end_date <= current_date + 60 then 'due_31_60'
        when p.end_date <= current_date + 90 then 'due_61_90'
        when p.end_date <= current_date + 180 then 'due_91_180'
        when p.end_date <= current_date + 365 then 'due_181_365'
        else 'later'
      end as renewal_bucket
    from public.policies p
    left join public.employees e on e.id = p.rm_employee_id
    left join public.policy_premium_details ppd on ppd.policy_id = p.id
    left join public.customers c on c.id = p.customer_id
    left join public.vehicles v on v.id = p.vehicle_id
    left join public.insurance_companies ic on ic.id = p.insurance_company_id
    where p.end_date is not null
      and (p_customer_ids is null or p.customer_id = any(p_customer_ids))
      and (p_insurer_id is null or p.insurance_company_id = p_insurer_id)
      and (p_rm_employee_id is null or p.rm_employee_id = p_rm_employee_id)
      and (p_intermediary_code is null or p.intermediary_code = p_intermediary_code)
  ),
  windowed as (
    select * from scoped where days_to_expiry < 0 or days_to_expiry between 0 and v_horizon
  ),
  filtered as (
    select * from windowed where p_bucket is null or renewal_bucket = p_bucket
  ),
  summary as (
    select
      count(*) filter (where days_to_expiry >= 0)::integer as upcoming_policy_count,
      count(*) filter (where days_to_expiry < 0)::integer as expired_policy_count,
      count(*) filter (where days_to_expiry between 0 and 30)::integer as due_30_count,
      count(*) filter (where days_to_expiry between 0 and 90)::integer as due_90_count,
      count(distinct customer_id) filter (where days_to_expiry >= 0)::integer as customer_count,
      coalesce(sum(gross_premium) filter (where days_to_expiry >= 0), 0)::numeric as premium_at_risk,
      coalesce(sum(gross_premium) filter (where days_to_expiry between 0 and 30), 0)::numeric as premium_due_30,
      min(end_date) filter (where days_to_expiry >= 0) as nearest_expiry
    from windowed
  ),
  buckets as (
    select jsonb_agg(to_jsonb(x) order by x.sort_order) as data from (
      select 1 as sort_order, 'expired'::text as key, 'Expired'::text as label, count(*) filter (where renewal_bucket='expired')::integer as policy_count, coalesce(sum(gross_premium) filter (where renewal_bucket='expired'),0)::numeric as gross_premium from windowed
      union all select 2,'due_30','0–30 days',count(*) filter (where renewal_bucket='due_30')::integer,coalesce(sum(gross_premium) filter (where renewal_bucket='due_30'),0)::numeric from windowed
      union all select 3,'due_31_60','31–60 days',count(*) filter (where renewal_bucket='due_31_60')::integer,coalesce(sum(gross_premium) filter (where renewal_bucket='due_31_60'),0)::numeric from windowed
      union all select 4,'due_61_90','61–90 days',count(*) filter (where renewal_bucket='due_61_90')::integer,coalesce(sum(gross_premium) filter (where renewal_bucket='due_61_90'),0)::numeric from windowed
      union all select 5,'due_91_180','91–180 days',count(*) filter (where renewal_bucket='due_91_180')::integer,coalesce(sum(gross_premium) filter (where renewal_bucket='due_91_180'),0)::numeric from windowed
      union all select 6,'due_181_365','181–365 days',count(*) filter (where renewal_bucket='due_181_365')::integer,coalesce(sum(gross_premium) filter (where renewal_bucket='due_181_365'),0)::numeric from windowed
    ) x
  ),
  insurer_rows as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.premium_at_risk desc, x.insurer_name),'[]'::jsonb) as data from (
      select insurance_company_id as id, insurer_name,
        count(*) filter (where days_to_expiry>=0)::integer as upcoming_policy_count,
        count(*) filter (where days_to_expiry between 0 and 30)::integer as due_30_count,
        count(*) filter (where days_to_expiry<0)::integer as expired_count,
        coalesce(sum(gross_premium) filter (where days_to_expiry>=0),0)::numeric as premium_at_risk,
        min(end_date) filter (where days_to_expiry>=0) as nearest_expiry
      from windowed group by insurance_company_id, insurer_name
    ) x
  ),
  rm_rows as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.premium_at_risk desc, x.rm_name),'[]'::jsonb) as data from (
      select rm_employee_id,
        coalesce(rm_name,'Unassigned') as rm_name,
        count(*) filter (where days_to_expiry>=0)::integer as upcoming_policy_count,
        count(distinct customer_id) filter (where days_to_expiry>=0)::integer as customer_count,
        count(*) filter (where days_to_expiry between 0 and 30)::integer as due_30_count,
        count(*) filter (where days_to_expiry<0)::integer as expired_count,
        coalesce(sum(gross_premium) filter (where days_to_expiry>=0),0)::numeric as premium_at_risk,
        min(end_date) filter (where days_to_expiry>=0) as nearest_expiry
      from windowed group by rm_employee_id,coalesce(rm_name,'Unassigned')
    ) x
  ),
  register_count as (select count(*)::integer as total_count from filtered),
  register_rows as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.end_date asc, x.policy_no),'[]'::jsonb) as data from (
      select id, policy_no, policy_type, start_date, end_date, status, customer_name, customer_code, vehicle_no, insurer_name,
        rm_employee_id, coalesce(rm_name,'Unassigned') as rm_name, intermediary_type, intermediary_code, gross_premium, days_to_expiry, renewal_bucket
      from filtered order by end_date asc, policy_no limit v_page_size offset v_offset
    ) x
  ),
  filter_values as (
    select jsonb_build_object(
      'insurers',coalesce((select jsonb_agg(to_jsonb(i) order by i.name) from (select distinct insurance_company_id as id, insurer_name as name from scoped where insurance_company_id is not null) i),'[]'::jsonb),
      'rms',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name) order by r.name) from (select distinct rm_employee_id as id, rm_name as name from scoped where rm_employee_id is not null and rm_name is not null) r),'[]'::jsonb),
      'intermediaries',coalesce((select jsonb_agg(to_jsonb(i) order by i.name,i.code) from (
        select distinct s.intermediary_code as code, s.intermediary_type as type,
          coalesce(nullif(trim(im.display_name),''),nullif(trim(im.legal_name),''),s.intermediary_code) as name
        from scoped s left join public.intermediaries im on im.intermediary_code=s.intermediary_code where s.intermediary_code is not null
      ) i),'[]'::jsonb)
    ) as data
  )
  select jsonb_build_object(
    'summary',to_jsonb(summary),
    'buckets',coalesce(buckets.data,'[]'::jsonb),
    'insurers',insurer_rows.data,
    'rms',rm_rows.data,
    'register',jsonb_build_object('rows',register_rows.data,'total_count',register_count.total_count,'page',v_page,'page_size',v_page_size),
    'filters',filter_values.data
  ) into v_result
  from summary,buckets,insurer_rows,rm_rows,register_count,register_rows,filter_values;
  return coalesce(v_result,'{}'::jsonb);
end;
$$;

revoke all on function public.get_renewal_report_v2(uuid[],integer,uuid,uuid,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.get_renewal_report_v2(uuid[],integer,uuid,uuid,text,text,integer,integer) to postgres, service_role;
