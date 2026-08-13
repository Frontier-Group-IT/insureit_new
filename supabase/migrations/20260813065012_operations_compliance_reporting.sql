create or replace function public.get_operations_compliance_report(
  p_customer_ids uuid[] default null,
  p_horizon_days integer default 90,
  p_exception text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language sql
security definer
set search_path = public
as $$
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
  from vehicles v
  join customers c on c.id=v.customer_id
  where p_customer_ids is null or v.customer_id = any(p_customer_ids)
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
  from customer_documents cd
  where p_customer_ids is null or cd.customer_id=any(p_customer_ids)
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
$$;

revoke all on function public.get_operations_compliance_report(uuid[],integer,text,integer,integer) from public;
revoke all on function public.get_operations_compliance_report(uuid[],integer,text,integer,integer) from anon;
revoke all on function public.get_operations_compliance_report(uuid[],integer,text,integer,integer) from authenticated;
grant execute on function public.get_operations_compliance_report(uuid[],integer,text,integer,integer) to service_role;
