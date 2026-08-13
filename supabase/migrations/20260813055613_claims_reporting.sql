create or replace function public.get_claims_report(
  p_customer_ids uuid[] default null,
  p_from_date date default null,
  p_to_date date default null,
  p_insurer_id uuid default null,
  p_status text default null,
  p_service_mode text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page integer := greatest(coalesce(p_page,1),1);
  v_page_size integer := greatest(1,least(coalesce(p_page_size,25),10001));
  v_offset integer := (v_page-1)*v_page_size;
  v_result jsonb;
begin
  with scoped as (
    select cl.id,cl.claim_no,cl.customer_id,cl.vehicle_id,cl.policy_id,cl.insurance_company_id,
      cl.current_status::text status,cl.claim_service_mode::text service_mode,cl.accident_at,cl.created_at,cl.updated_at,
      coalesce(cl.estimated_loss,0)::numeric estimated_loss,coalesce(cl.approved_amount,0)::numeric approved_amount,
      coalesce(cl.settlement_amount,0)::numeric settlement_amount,
      greatest(0,(current_date-cl.created_at::date))::integer age_days,
      coalesce(nullif(trim(c.company_name),''),nullif(trim(c.contact_name),''),c.customer_code,'Customer') customer_name,
      c.customer_code,coalesce(nullif(trim(v.vehicle_no),''),'—') vehicle_no,
      coalesce(nullif(trim(ic.name),''),'Unassigned') insurer_name,
      coalesce(nullif(trim(p.policy_no),''),'—') policy_no,
      coalesce(nullif(trim(p.rm_name),''),'Unassigned') rm_name,
      coalesce(nullif(trim(p.intermediary_code),''),'—') intermediary_code,
      coalesce(doc.total_docs,0)::integer document_count,
      coalesce(doc.pending_docs,0)::integer pending_documents,
      coalesce(doc.rejected_docs,0)::integer rejected_documents
    from public.claims cl
    left join public.customers c on c.id=cl.customer_id
    left join public.vehicles v on v.id=cl.vehicle_id
    left join public.insurance_companies ic on ic.id=cl.insurance_company_id
    left join public.policies p on p.id=cl.policy_id
    left join lateral (
      select count(*)::integer total_docs,
        count(*) filter(where d.verification_status::text='pending')::integer pending_docs,
        count(*) filter(where d.verification_status::text='rejected')::integer rejected_docs
      from public.claim_documents d where d.claim_id=cl.id
    ) doc on true
    where (p_customer_ids is null or cl.customer_id=any(p_customer_ids))
      and (p_from_date is null or cl.created_at::date>=p_from_date)
      and (p_to_date is null or cl.created_at::date<=p_to_date)
      and (p_insurer_id is null or cl.insurance_company_id=p_insurer_id)
      and (p_status is null or cl.current_status::text=p_status)
      and (p_service_mode is null or cl.claim_service_mode::text=p_service_mode)
  ), summary as (
    select count(*)::integer claim_count,
      count(*) filter(where status not in ('Settled','Rejected','Closed','Claim Complete'))::integer open_claim_count,
      count(*) filter(where status in ('Settled','Claim Complete'))::integer settled_claim_count,
      count(*) filter(where status='Rejected')::integer rejected_claim_count,
      coalesce(avg(age_days) filter(where status not in ('Settled','Rejected','Closed','Claim Complete')),0)::numeric average_open_age_days,
      coalesce(sum(estimated_loss),0)::numeric estimated_loss,
      coalesce(sum(approved_amount),0)::numeric approved_amount,
      coalesce(sum(settlement_amount),0)::numeric settlement_amount,
      count(*) filter(where pending_documents>0)::integer claims_with_pending_documents,
      count(*) filter(where rejected_documents>0)::integer claims_with_rejected_documents
    from scoped
  ), aging as (
    select jsonb_agg(to_jsonb(x) order by x.sort_order) data from (
      select 1 sort_order,'0_7' key,'0–7 days' label,count(*) filter(where age_days between 0 and 7 and status not in ('Settled','Rejected','Closed','Claim Complete'))::integer claim_count from scoped
      union all select 2,'8_15','8–15 days',count(*) filter(where age_days between 8 and 15 and status not in ('Settled','Rejected','Closed','Claim Complete'))::integer from scoped
      union all select 3,'16_30','16–30 days',count(*) filter(where age_days between 16 and 30 and status not in ('Settled','Rejected','Closed','Claim Complete'))::integer from scoped
      union all select 4,'31_60','31–60 days',count(*) filter(where age_days between 31 and 60 and status not in ('Settled','Rejected','Closed','Claim Complete'))::integer from scoped
      union all select 5,'61_plus','61+ days',count(*) filter(where age_days>=61 and status not in ('Settled','Rejected','Closed','Claim Complete'))::integer from scoped
    ) x
  ), statuses as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.claim_count desc,x.status),'[]'::jsonb) data from (
      select status,count(*)::integer claim_count,coalesce(sum(estimated_loss),0)::numeric estimated_loss from scoped group by status
    ) x
  ), insurers as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.claim_count desc,x.insurer_name),'[]'::jsonb) data from (
      select insurance_company_id id,insurer_name,count(*)::integer claim_count,
        count(*) filter(where status not in ('Settled','Rejected','Closed','Claim Complete'))::integer open_claim_count,
        coalesce(sum(estimated_loss),0)::numeric estimated_loss,coalesce(sum(settlement_amount),0)::numeric settlement_amount
      from scoped group by insurance_company_id,insurer_name
    ) x
  ), docs as (
    select jsonb_build_object(
      'pending_documents',coalesce(sum(pending_documents),0)::integer,
      'rejected_documents',coalesce(sum(rejected_documents),0)::integer,
      'claims_with_pending_documents',count(*) filter(where pending_documents>0)::integer,
      'claims_with_rejected_documents',count(*) filter(where rejected_documents>0)::integer
    ) data from scoped
  ), reg_count as (select count(*)::integer total_count from scoped), reg_rows as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.claim_no),'[]'::jsonb) data from (
      select id,claim_no,status,service_mode,created_at,accident_at,age_days,customer_name,customer_code,vehicle_no,policy_no,insurer_name,rm_name,intermediary_code,
        estimated_loss,approved_amount,settlement_amount,document_count,pending_documents,rejected_documents
      from scoped order by created_at desc,claim_no limit v_page_size offset v_offset
    ) x
  ), filters as (
    select jsonb_build_object(
      'insurers',coalesce((select jsonb_agg(to_jsonb(i) order by i.name) from (select distinct insurance_company_id id,insurer_name name from scoped where insurance_company_id is not null)i),'[]'::jsonb),
      'statuses',coalesce((select jsonb_agg(s.status order by s.status) from (select distinct status from scoped)s),'[]'::jsonb),
      'service_modes',coalesce((select jsonb_agg(s.service_mode order by s.service_mode) from (select distinct service_mode from scoped where service_mode is not null)s),'[]'::jsonb)
    ) data
  )
  select jsonb_build_object(
    'summary',to_jsonb(summary),'aging',coalesce(aging.data,'[]'::jsonb),'statuses',statuses.data,'insurers',insurers.data,'documents',docs.data,
    'register',jsonb_build_object('rows',reg_rows.data,'total_count',reg_count.total_count,'page',v_page,'page_size',v_page_size),'filters',filters.data
  ) into v_result from summary,aging,statuses,insurers,docs,reg_count,reg_rows,filters;
  return coalesce(v_result,'{}'::jsonb);
end;
$$;

revoke all on function public.get_claims_report(uuid[],date,date,uuid,text,text,integer,integer) from public;
revoke all on function public.get_claims_report(uuid[],date,date,uuid,text,text,integer,integer) from anon;
revoke all on function public.get_claims_report(uuid[],date,date,uuid,text,text,integer,integer) from authenticated;
grant execute on function public.get_claims_report(uuid[],date,date,uuid,text,text,integer,integer) to service_role;
