create or replace function public.get_reporting_readiness_report(
  p_customer_ids uuid[] default null,
  p_domain text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language sql
security definer
set search_path = public
as $$
with params as (
  select greatest(coalesce(p_page,1),1) page_no,
         least(greatest(coalesce(p_page_size,25),1),100) page_size
),
bill_agg as (
  select policy_id,
         case when bool_or(status='Billed') then 'Billed'
              when bool_or(status='Billing details incomplete') then 'Billing details incomplete'
              else 'Unbilled' end billing_status
  from public.policy_payin_bills
  group by policy_id
),
payout_agg as (
  select policy_id,
         coalesce(sum(retention_amount),0)::numeric retention_amount,
         case when bool_or(lower(coalesce(status,''))='paid') then 'Paid'
              when bool_or(lower(coalesce(status,''))='approved') then 'Approved'
              else coalesce(max(status),'Pending') end payout_status
  from public.policy_intermediary_payouts
  group by policy_id
),
vehicle_base as (
  select v.id,v.customer_id,v.vehicle_no,
         coalesce(c.company_name,c.contact_name,c.customer_code,'—') customer_name,
         v.registration_status,coalesce(v.authbridge_verified,false) authbridge_verified,
         ((v.fitness_expiry_date is null)::int + (v.puc_expiry_date is null)::int + (v.road_tax_expiry_date is null)::int + (v.national_permit_expiry_date is null)::int + (v.local_permit_expiry_date is null)::int) missing_count,
         (((v.fitness_expiry_date is not null and v.fitness_expiry_date < current_date))::int + ((v.puc_expiry_date is not null and v.puc_expiry_date < current_date))::int + ((v.road_tax_expiry_date is not null and v.road_tax_expiry_date < current_date))::int + ((v.national_permit_expiry_date is not null and v.national_permit_expiry_date < current_date))::int + ((v.local_permit_expiry_date is not null and v.local_permit_expiry_date < current_date))::int) expired_count,
         (((v.fitness_expiry_date between current_date and current_date+30))::int + ((v.puc_expiry_date between current_date and current_date+30))::int + ((v.road_tax_expiry_date between current_date and current_date+30))::int + ((v.national_permit_expiry_date between current_date and current_date+30))::int + ((v.local_permit_expiry_date between current_date and current_date+30))::int) due_count
  from public.vehicles v
  join public.customers c on c.id=v.customer_id
  where p_customer_ids is null or v.customer_id=any(p_customer_ids)
),
vehicle_normalized as (
  select *,coalesce(due_count,0) due_count_safe from vehicle_base
),
vehicle_issues as (
  select 'vehicle'::text domain,id entity_id,customer_id,
         vehicle_no primary_label,customer_name secondary_label,
         (missing_count + expired_count + due_count_safe + (not authbridge_verified)::int + coalesce((registration_status='registration_pending')::int,0)) issue_count,
         array_remove(array[
           case when missing_count>0 then missing_count||' compliance date'||case when missing_count=1 then '' else 's' end||' missing' end,
           case when expired_count>0 then expired_count||' compliance document'||case when expired_count=1 then '' else 's' end||' expired' end,
           case when due_count_safe>0 then due_count_safe||' compliance document'||case when due_count_safe=1 then '' else 's' end||' due within 30 days' end,
           case when not authbridge_verified then 'AuthBridge RC unverified' end,
           case when registration_status='registration_pending' then 'Registration pending' end
         ],null)::text[] issue_labels,
         case when expired_count>0 then 'critical' when missing_count>0 or not authbridge_verified then 'warning' else 'attention' end severity,
         '/vehicles/'||id||'/edit' action_path,
         greatest(expired_count*100,missing_count*10,(not authbridge_verified)::int*5,due_count_safe*3,coalesce((registration_status='registration_pending')::int,0)) sort_weight
  from vehicle_normalized
  where missing_count>0 or expired_count>0 or due_count_safe>0 or not authbridge_verified or registration_status='registration_pending'
),
policy_base as (
  select p.id,p.customer_id,p.policy_no,
         coalesce(c.company_name,c.contact_name,c.customer_code,'—') customer_name,
         p.insurance_company_id,p.rm_name,
         coalesce(ppd.gross_premium,p.premium_amount,0)::numeric gross_premium,
         coalesce(pid.total_projected_payin,0)::numeric projected_payin,
         coalesce(ba.billing_status,'Unbilled') billing_status,
         coalesce(pa.retention_amount,0)::numeric retention_amount,
         coalesce(pa.payout_status,'Pending') payout_status
  from public.policies p
  join public.customers c on c.id=p.customer_id
  left join public.policy_premium_details ppd on ppd.policy_id=p.id
  left join public.policy_payin_details pid on pid.policy_id=p.id
  left join bill_agg ba on ba.policy_id=p.id
  left join payout_agg pa on pa.policy_id=p.id
  where p_customer_ids is null or p.customer_id=any(p_customer_ids)
),
policy_issues as (
  select 'policy_finance'::text domain,id entity_id,customer_id,
         policy_no primary_label,customer_name secondary_label,
         ((insurance_company_id is null)::int + (gross_premium<=0)::int + (coalesce(nullif(btrim(rm_name),''),'')='')::int + (projected_payin<=0)::int + (billing_status='Billing details incomplete')::int + (billing_status='Unbilled')::int + (lower(coalesce(payout_status,''))<>'paid')::int + (retention_amount<0)::int) issue_count,
         array_remove(array[
           case when insurance_company_id is null then 'Insurance company missing' end,
           case when gross_premium<=0 then 'Premium amount missing' end,
           case when coalesce(nullif(btrim(rm_name),''),'')='' then 'Relationship manager unassigned' end,
           case when projected_payin<=0 then 'Projected PayIn missing' end,
           case when billing_status='Billing details incomplete' then 'Billing details incomplete' end,
           case when billing_status='Unbilled' then 'PayIn unbilled' end,
           case when lower(coalesce(payout_status,''))<>'paid' then 'Partner payout pending' end,
           case when retention_amount<0 then 'Negative retention' end
         ],null)::text[] issue_labels,
         case when insurance_company_id is null or gross_premium<=0 or retention_amount<0 then 'critical'
              when projected_payin<=0 or billing_status='Billing details incomplete' or coalesce(nullif(btrim(rm_name),''),'')='' then 'warning'
              else 'attention' end severity,
         '/policies/'||id action_path,
         greatest((insurance_company_id is null)::int*100,(gross_premium<=0)::int*100,(retention_amount<0)::int*100,(projected_payin<=0)::int*20,(billing_status='Billing details incomplete')::int*15,(coalesce(nullif(btrim(rm_name),''),'')='')::int*10,(billing_status='Unbilled')::int*3,(lower(coalesce(payout_status,''))<>'paid')::int*2) sort_weight
  from policy_base
  where insurance_company_id is null or gross_premium<=0 or coalesce(nullif(btrim(rm_name),''),'')='' or projected_payin<=0 or billing_status in ('Billing details incomplete','Unbilled') or lower(coalesce(payout_status,''))<>'paid' or retention_amount<0
),
claim_doc_agg as (
  select cd.claim_id,
         count(*) filter (where lower(cd.verification_status::text)='pending')::int pending_count,
         count(*) filter (where lower(cd.verification_status::text)='rejected')::int rejected_count
  from public.claim_documents cd
  group by cd.claim_id
),
claim_issues as (
  select 'claim'::text domain,cl.id entity_id,cl.customer_id,
         cl.claim_no primary_label,coalesce(c.company_name,c.contact_name,c.customer_code,'—') secondary_label,
         (coalesce(d.pending_count,0)+coalesce(d.rejected_count,0)) issue_count,
         array_remove(array[
           case when coalesce(d.rejected_count,0)>0 then d.rejected_count||' rejected claim document'||case when d.rejected_count=1 then '' else 's' end end,
           case when coalesce(d.pending_count,0)>0 then d.pending_count||' claim document'||case when d.pending_count=1 then '' else 's' end||' pending verification' end
         ],null)::text[] issue_labels,
         case when coalesce(d.rejected_count,0)>0 then 'critical' else 'warning' end severity,
         '/claims/'||cl.id action_path,
         greatest(coalesce(d.rejected_count,0)*100,coalesce(d.pending_count,0)*10) sort_weight
  from public.claims cl
  join public.customers c on c.id=cl.customer_id
  join claim_doc_agg d on d.claim_id=cl.id
  where (p_customer_ids is null or cl.customer_id=any(p_customer_ids))
    and (coalesce(d.pending_count,0)>0 or coalesce(d.rejected_count,0)>0)
),
customer_doc_agg as (
  select cd.customer_id,
         count(*) filter (where lower(coalesce(cd.verification_status,''))='pending')::int pending_count,
         count(*) filter (where lower(coalesce(cd.verification_status,''))='rejected')::int rejected_count
  from public.customer_documents cd
  group by cd.customer_id
),
customer_issues as (
  select 'customer'::text domain,c.id entity_id,c.id customer_id,
         coalesce(c.company_name,c.contact_name,c.customer_code,'—') primary_label,c.customer_code secondary_label,
         (coalesce(d.pending_count,0)+coalesce(d.rejected_count,0)) issue_count,
         array_remove(array[
           case when coalesce(d.rejected_count,0)>0 then d.rejected_count||' rejected customer document'||case when d.rejected_count=1 then '' else 's' end end,
           case when coalesce(d.pending_count,0)>0 then d.pending_count||' customer document'||case when d.pending_count=1 then '' else 's' end||' pending verification' end
         ],null)::text[] issue_labels,
         case when coalesce(d.rejected_count,0)>0 then 'critical' else 'warning' end severity,
         '/customers/'||c.id||'/edit' action_path,
         greatest(coalesce(d.rejected_count,0)*100,coalesce(d.pending_count,0)*10) sort_weight
  from public.customers c
  join customer_doc_agg d on d.customer_id=c.id
  where (p_customer_ids is null or c.id=any(p_customer_ids))
    and (coalesce(d.pending_count,0)>0 or coalesce(d.rejected_count,0)>0)
),
all_issues as (
  select * from vehicle_issues
  union all select * from policy_issues
  union all select * from claim_issues
  union all select * from customer_issues
),
filtered as (
  select * from all_issues where p_domain is null or p_domain='all' or domain=p_domain
),
summary as (
 select jsonb_build_object(
   'exception_records',(select count(*)::int from all_issues),
   'critical_records',(select count(*)::int from all_issues where severity='critical'),
   'warning_records',(select count(*)::int from all_issues where severity='warning'),
   'attention_records',(select count(*)::int from all_issues where severity='attention'),
   'vehicle_records',(select count(*)::int from vehicle_issues),
   'vehicles_missing_compliance',(select count(*)::int from vehicle_normalized where missing_count>0),
   'missing_compliance_fields',(select coalesce(sum(missing_count),0)::int from vehicle_normalized),
   'expired_compliance_fields',(select coalesce(sum(expired_count),0)::int from vehicle_normalized),
   'due_30_compliance_fields',(select coalesce(sum(due_count_safe),0)::int from vehicle_normalized),
   'authbridge_unverified',(select count(*)::int from vehicle_normalized where not authbridge_verified),
   'registration_pending',(select count(*)::int from vehicle_normalized where registration_status='registration_pending'),
   'policy_finance_records',(select count(*)::int from policy_issues),
   'policy_missing_insurer',(select count(*)::int from policy_base where insurance_company_id is null),
   'policy_missing_premium',(select count(*)::int from policy_base where gross_premium<=0),
   'policy_unassigned_rm',(select count(*)::int from policy_base where coalesce(nullif(btrim(rm_name),''),'')=''),
   'finance_missing_payin',(select count(*)::int from policy_base where projected_payin<=0),
   'billing_incomplete',(select count(*)::int from policy_base where billing_status='Billing details incomplete'),
   'unbilled',(select count(*)::int from policy_base where billing_status='Unbilled'),
   'pending_payout',(select count(*)::int from policy_base where lower(coalesce(payout_status,''))<>'paid'),
   'negative_retention',(select count(*)::int from policy_base where retention_amount<0),
   'claim_records',(select count(*)::int from claim_issues),
   'claim_pending_documents',(select coalesce(sum(pending_count),0)::int from claim_doc_agg d join public.claims cl on cl.id=d.claim_id where p_customer_ids is null or cl.customer_id=any(p_customer_ids)),
   'claim_rejected_documents',(select coalesce(sum(rejected_count),0)::int from claim_doc_agg d join public.claims cl on cl.id=d.claim_id where p_customer_ids is null or cl.customer_id=any(p_customer_ids)),
   'customer_records',(select count(*)::int from customer_issues),
   'customer_pending_documents',(select coalesce(sum(pending_count),0)::int from customer_doc_agg d where p_customer_ids is null or d.customer_id=any(p_customer_ids)),
   'customer_rejected_documents',(select coalesce(sum(rejected_count),0)::int from customer_doc_agg d where p_customer_ids is null or d.customer_id=any(p_customer_ids)),
   'workflow_backlog',(
      (select count(*) from vehicle_normalized where registration_status='registration_pending') +
      (select count(*) from policy_base where billing_status in ('Unbilled','Billing details incomplete')) +
      (select count(*) from policy_base where lower(coalesce(payout_status,''))<>'paid') +
      (select coalesce(sum(pending_count),0) from claim_doc_agg d join public.claims cl on cl.id=d.claim_id where p_customer_ids is null or cl.customer_id=any(p_customer_ids)) +
      (select coalesce(sum(pending_count),0) from customer_doc_agg d where p_customer_ids is null or d.customer_id=any(p_customer_ids))
   )::int
 ) obj
),
domains as (
 select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order),'[]'::jsonb) arr from (
   select 'vehicle' domain,'Vehicles' label,(select count(*)::int from vehicle_issues) exception_records,1 sort_order
   union all select 'policy_finance','Policy & Finance',(select count(*)::int from policy_issues),2
   union all select 'claim','Claims',(select count(*)::int from claim_issues),3
   union all select 'customer','Customer documents',(select count(*)::int from customer_issues),4
 ) x
),
register_total as (select count(*)::int total_count from filtered),
register_rows as (
 select coalesce(jsonb_agg(to_jsonb(x) - 'sort_weight' order by x.sort_weight desc,x.primary_label),'[]'::jsonb) arr from (
   select domain,entity_id,customer_id,primary_label,secondary_label,issue_count,issue_labels,severity,action_path,sort_weight
   from filtered
   order by sort_weight desc,primary_label
   limit least(greatest(coalesce(p_page_size,25),1),100)
   offset ((greatest(coalesce(p_page,1),1)-1)*least(greatest(coalesce(p_page_size,25),1),100))
 ) x
)
select jsonb_build_object(
  'summary',(select obj from summary),
  'domains',(select arr from domains),
  'register',jsonb_build_object('rows',(select arr from register_rows),'total_count',(select total_count from register_total),'page',(select page_no from params),'page_size',(select page_size from params))
);
$$;

revoke execute on function public.get_reporting_readiness_report(uuid[],text,integer,integer) from public;
revoke execute on function public.get_reporting_readiness_report(uuid[],text,integer,integer) from anon;
revoke execute on function public.get_reporting_readiness_report(uuid[],text,integer,integer) from authenticated;
grant execute on function public.get_reporting_readiness_report(uuid[],text,integer,integer) to service_role;
