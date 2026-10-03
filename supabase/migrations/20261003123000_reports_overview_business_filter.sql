-- Reports Overview global business filter
-- Adds business/category-aware claims and vehicle-compliance report contracts.
-- Existing RPCs remain untouched so non-Overview callers stay backward compatible.

create or replace function public.get_claims_report_v2(
  p_customer_ids uuid[] default null::uuid[],
  p_from_date date default null::date,
  p_to_date date default null::date,
  p_insurer_id uuid default null::uuid,
  p_status text default null::text,
  p_service_mode text default null::text,
  p_business_line text default null::text,
  p_category text default null::text,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      coalesce(nullif(trim(p.business_line),''),'Motor') policy_business_line,
      case
        when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor'
          then coalesce(nullif(trim(nm.category),''),nullif(trim(p.policy_type),''),'Other')
        else coalesce(nullif(trim(p.policy_type),''),'Other')
      end policy_category,
      coalesce(doc.total_docs,0)::integer document_count,
      coalesce(doc.pending_docs,0)::integer pending_documents,
      coalesce(doc.rejected_docs,0)::integer rejected_documents
    from public.claims cl
    left join public.customers c on c.id=cl.customer_id
    left join public.vehicles v on v.id=cl.vehicle_id
    left join public.insurance_companies ic on ic.id=cl.insurance_company_id
    left join public.policies p on p.id=cl.policy_id
    left join public.non_motor_policy_details nm on nm.policy_id=p.id
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
      and (p_business_line is null or (p.id is not null and lower(coalesce(nullif(trim(p.business_line),''),'Motor'))=lower(p_business_line)))
      and (
        p_category is null
        or (
          p.id is not null
          and lower(
            case
              when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor'
                then coalesce(nullif(trim(nm.category),''),nullif(trim(p.policy_type),''),'Other')
              else coalesce(nullif(trim(p.policy_type),''),'Other')
            end
          )=lower(p_category)
        )
      )
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
$function$;

create or replace function public.get_operations_compliance_report_v2(
  p_customer_ids uuid[] default null::uuid[],
  p_horizon_days integer default 90,
  p_exception text default null::text,
  p_business_line text default null::text,
  p_category text default null::text,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
with params as (
  select greatest(1, least(coalesce(p_horizon_days,90), 3650))::int as horizon_days,
         greatest(coalesce(p_page,1),1)::int as page_no,
         greatest(1, least(coalesce(p_page_size,25),100))::int as page_size,
         nullif(btrim(coalesce(p_exception,'')),'') as exception_filter,
         current_date as today
),
scoped_vehicles as (
  select v.*, coalesce(nullif(c.company_name,''), nullif(c.contact_name,''), c.customer_code, 'Customer') as customer_name,
         c.customer_code
  from public.vehicles v
  join public.customers c on c.id=v.customer_id
  where (p_customer_ids is null or v.customer_id = any(p_customer_ids))
    and (
      (p_business_line is null and p_category is null)
      or exists (
        select 1
        from public.policies p
        left join public.non_motor_policy_details nm on nm.policy_id=p.id
        where p.vehicle_id=v.id
          and (p_business_line is null or lower(coalesce(nullif(trim(p.business_line),''),'Motor'))=lower(p_business_line))
          and (
            p_category is null
            or lower(
              case
                when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor'
                  then coalesce(nullif(trim(nm.category),''),nullif(trim(p.policy_type),''),'Other')
                else coalesce(nullif(trim(p.policy_type),''),'Other')
              end
            )=lower(p_category)
          )
      )
    )
),
vehicle_eval as (
  select sv.*,
    (case when fitness_expiry_date is null then 1 else 0 end +
     case when puc_expiry_date is null then 1 else 0 end +
     case when road_tax_expiry_date is null then 1 else 0 end +
     case when national_permit_expiry_date is null then 1 else 0 end +
     case when local_permit_expiry_date is null then 1 else 0 end)::int as missing_compliance_count,
    (case when fitness_expiry_date < p.today then 1 else 0 end +
     case when puc_expiry_date < p.today then 1 else 0 end +
     case when road_tax_expiry_date < p.today then 1 else 0 end +
     case when national_permit_expiry_date < p.today then 1 else 0 end +
     case when local_permit_expiry_date < p.today then 1 else 0 end)::int as expired_compliance_count,
    (case when fitness_expiry_date between p.today and p.today+p.horizon_days then 1 else 0 end +
     case when puc_expiry_date between p.today and p.today+p.horizon_days then 1 else 0 end +
     case when road_tax_expiry_date between p.today and p.today+p.horizon_days then 1 else 0 end +
     case when national_permit_expiry_date between p.today and p.today+p.horizon_days then 1 else 0 end +
     case when local_permit_expiry_date between p.today and p.today+p.horizon_days then 1 else 0 end)::int as due_compliance_count,
    least(fitness_expiry_date,puc_expiry_date,road_tax_expiry_date,national_permit_expiry_date,local_permit_expiry_date) as nearest_expiry_date
  from scoped_vehicles sv cross join params p
),
filtered_vehicles as (
  select ve.* from vehicle_eval ve cross join params p
  where p.exception_filter is null
     or lower(p.exception_filter)='all'
     or (lower(p.exception_filter)='missing' and ve.missing_compliance_count>0)
     or (lower(p.exception_filter)='expired' and ve.expired_compliance_count>0)
     or (lower(p.exception_filter)='due' and ve.due_compliance_count>0)
     or (lower(p.exception_filter)='unverified' and coalesce(ve.authbridge_verified,false)=false)
),
doc_rows as (
  select 'Fitness'::text label, fitness_expiry_date expiry_date from scoped_vehicles
  union all select 'PUC', puc_expiry_date from scoped_vehicles
  union all select 'Road tax', road_tax_expiry_date from scoped_vehicles
  union all select 'National permit', national_permit_expiry_date from scoped_vehicles
  union all select 'Local permit', local_permit_expiry_date from scoped_vehicles
),
doc_summary as (
  select d.label,
         count(*)::int as vehicle_count,
         count(*) filter(where d.expiry_date is null)::int as missing_count,
         count(*) filter(where d.expiry_date < p.today)::int as expired_count,
         count(*) filter(where d.expiry_date between p.today and p.today+p.horizon_days)::int as due_count,
         min(d.expiry_date) filter(where d.expiry_date >= p.today) as nearest_expiry_date
  from doc_rows d cross join params p
  group by d.label
),
customer_doc_summary as (
  select count(*)::int as document_count,
         count(*) filter(where lower(coalesce(cd.verification_status,''))='pending')::int as pending_count,
         count(*) filter(where lower(coalesce(cd.verification_status,''))='rejected')::int as rejected_count,
         count(*) filter(where lower(coalesce(cd.verification_status,''))='verified')::int as verified_count,
         count(distinct cd.customer_id) filter(where lower(coalesce(cd.verification_status,'')) in ('pending','rejected'))::int as customers_with_exceptions
  from public.customer_documents cd
  where (p_customer_ids is null or cd.customer_id=any(p_customer_ids))
    and (
      (p_business_line is null and p_category is null)
      or exists (
        select 1
        from public.policies p
        left join public.non_motor_policy_details nm on nm.policy_id=p.id
        where p.customer_id=cd.customer_id
          and (p_business_line is null or lower(coalesce(nullif(trim(p.business_line),''),'Motor'))=lower(p_business_line))
          and (
            p_category is null
            or lower(
              case
                when coalesce(nullif(trim(p.business_line),''),'Motor')='Non Motor'
                  then coalesce(nullif(trim(nm.category),''),nullif(trim(p.policy_type),''),'Other')
                else coalesce(nullif(trim(p.policy_type),''),'Other')
              end
            )=lower(p_category)
          )
      )
    )
),
summary as (
  select count(*)::int vehicle_count,
         count(*) filter(where coalesce(is_commercial,false))::int commercial_vehicle_count,
         count(*) filter(where coalesce(authbridge_verified,false))::int authbridge_verified_count,
         count(*) filter(where not coalesce(authbridge_verified,false))::int authbridge_unverified_count,
         count(*) filter(where missing_compliance_count>0)::int vehicles_missing_compliance_data,
         coalesce(sum(missing_compliance_count),0)::int missing_compliance_fields,
         coalesce(sum(expired_compliance_count),0)::int expired_document_count,
         coalesce(sum(due_compliance_count),0)::int due_document_count
  from vehicle_eval
),
reg as (
  select fv.*, count(*) over()::int total_count,
         row_number() over(order by coalesce(fv.nearest_expiry_date,date '9999-12-31'), fv.vehicle_no, fv.id) rn
  from filtered_vehicles fv
),
reg_page as (
  select r.* from reg r cross join params p
  where r.rn > ((p.page_no-1)*p.page_size) and r.rn <= (p.page_no*p.page_size)
)
select jsonb_build_object(
 'summary', (select to_jsonb(s) from summary s),
 'compliance', coalesce((select jsonb_agg(to_jsonb(ds) order by case ds.label when 'Fitness' then 1 when 'PUC' then 2 when 'Road tax' then 3 when 'National permit' then 4 else 5 end) from doc_summary ds),'[]'::jsonb),
 'customer_documents', (select to_jsonb(cds) from customer_doc_summary cds),
 'register', jsonb_build_object(
   'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'customer_id',customer_id,'customer_name',customer_name,'customer_code',customer_code,
      'vehicle_no',vehicle_no,'vehicle_type',vehicle_type,'make',make,'model',model,'registration_status',registration_status,
      'is_commercial',is_commercial,'authbridge_verified',authbridge_verified,'authbridge_last_verified_at',authbridge_last_verified_at,
      'fitness_expiry_date',fitness_expiry_date,'puc_expiry_date',puc_expiry_date,'road_tax_expiry_date',road_tax_expiry_date,
      'national_permit_expiry_date',national_permit_expiry_date,'local_permit_expiry_date',local_permit_expiry_date,
      'missing_compliance_count',missing_compliance_count,'expired_compliance_count',expired_compliance_count,
      'due_compliance_count',due_compliance_count,'nearest_expiry_date',nearest_expiry_date
   ) order by rn) from reg_page),'[]'::jsonb),
   'total_count',coalesce((select max(total_count) from reg_page),(select count(*) from filtered_vehicles),0),
   'page',(select page_no from params),
   'page_size',(select page_size from params)
 )
);
$function$;

revoke all on function public.get_claims_report_v2(uuid[],date,date,uuid,text,text,text,text,integer,integer) from public;
revoke all on function public.get_claims_report_v2(uuid[],date,date,uuid,text,text,text,text,integer,integer) from anon;
revoke all on function public.get_claims_report_v2(uuid[],date,date,uuid,text,text,text,text,integer,integer) from authenticated;
grant execute on function public.get_claims_report_v2(uuid[],date,date,uuid,text,text,text,text,integer,integer) to service_role;

revoke all on function public.get_operations_compliance_report_v2(uuid[],integer,text,text,text,integer,integer) from public;
revoke all on function public.get_operations_compliance_report_v2(uuid[],integer,text,text,text,integer,integer) from anon;
revoke all on function public.get_operations_compliance_report_v2(uuid[],integer,text,text,text,integer,integer) from authenticated;
grant execute on function public.get_operations_compliance_report_v2(uuid[],integer,text,text,text,integer,integer) to service_role;
