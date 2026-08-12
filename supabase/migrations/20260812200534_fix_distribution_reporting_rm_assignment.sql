create or replace function public.get_distribution_report(
  p_intermediary_ids uuid[] default null,
  p_application_ids uuid[] default null,
  p_from_date date default null,
  p_to_date date default null,
  p_rm_employee_id uuid default null,
  p_intermediary_type text default null,
  p_account_status text default null,
  p_page integer default 1,
  p_page_size integer default 25,
  p_onboarding_page integer default 1,
  p_onboarding_page_size integer default 25
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
scoped_intermediaries as (
  select i.id, i.application_id, i.intermediary_code, i.intermediary_type, i.display_name,
         i.account_status, i.compliance_status, i.iib_status, i.registration_status,
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
  select p.id, p.customer_id, p.intermediary_code,
         coalesce(p.issuance_date, p.created_at::date) as business_date,
         coalesce(ppd.gross_premium, p.premium_amount, 0)::numeric as gross_premium
  from public.policies p
  left join public.policy_premium_details ppd on ppd.policy_id = p.id
  join scoped_intermediaries si on si.intermediary_code is not null and si.intermediary_code = p.intermediary_code
  where (p_from_date is null or coalesce(p.issuance_date, p.created_at::date) >= p_from_date)
    and (p_to_date is null or coalesce(p.issuance_date, p.created_at::date) <= p_to_date)
),
intermediary_stats as (
  select si.id, si.application_id, si.intermediary_code, si.intermediary_type, si.display_name,
         si.account_status, si.compliance_status, si.iib_status, si.registration_status,
         si.associate_employee_id, si.rm_name,
         count(pb.id)::integer as policy_count,
         count(distinct pb.customer_id)::integer as customer_count,
         coalesce(sum(pb.gross_premium), 0)::numeric as gross_premium,
         max(pb.business_date) as last_business_date
  from scoped_intermediaries si
  left join policy_base pb on pb.intermediary_code = si.intermediary_code
  group by si.id, si.application_id, si.intermediary_code, si.intermediary_type, si.display_name,
           si.account_status, si.compliance_status, si.iib_status, si.registration_status,
           si.associate_employee_id, si.rm_name
),
rm_stats as (
  select associate_employee_id as employee_id, rm_name as name,
         count(*)::integer as intermediary_count,
         count(*) filter (where account_status = 'active')::integer as active_intermediary_count,
         count(*) filter (where policy_count > 0)::integer as producing_intermediary_count,
         sum(policy_count)::integer as policy_count,
         coalesce(sum(customer_count), 0)::integer as customer_count,
         coalesce(sum(gross_premium), 0)::numeric as gross_premium
  from intermediary_stats
  group by associate_employee_id, rm_name
),
scoped_applications as (
  select a.id, a.application_reference, a.requested_type, a.final_type, a.status,
         a.registration_status, a.submitted_at, a.created_at, a.completed_at,
         op.associate_employee_id, coalesce(e.full_name, 'Unassigned') as rm_name,
         coalesce(nullif(i.display_name, ''), nullif(op.pos_name, ''), nullif(op.misp_name, ''),
                  nullif(a.draft_data->>'fullName', ''), nullif(a.draft_data->>'name', ''),
                  nullif(a.application_reference, ''), 'Application') as applicant_name,
         coalesce(a.final_type, a.requested_type) as effective_type,
         t.training_status, t.exam_status, t.agreement_status, t.iib_registration_status,
         greatest(0, current_date - coalesce(a.submitted_at, a.created_at)::date)::integer as age_days,
         case
           when a.registration_status = 'rejected' then 'Rejected'
           when a.registration_status = 'partner_active' then 'Partner active'
           when a.registration_status = 'iib_registered' then 'IIB registered'
           when a.registration_status like 'training_%' then 'Training'
           when a.registration_status like 'exam_%' then 'Exam'
           when a.registration_status like 'agreement_%' then 'Agreement'
           when a.registration_status like 'iib_%' then 'IIB registration'
           when a.registration_status in ('pan_checking','documents_pending','existing_posp_documents_pending','existing_posp_ready_for_activation') then 'Compliance'
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
    'intermediary_count',(select count(*) from intermediary_stats),
    'active_intermediary_count',(select count(*) from intermediary_stats where account_status='active'),
    'partner_count',(select count(*) from intermediary_stats where intermediary_type='partner'),
    'posp_count',(select count(*) from intermediary_stats where intermediary_type='posp'),
    'misp_count',(select count(*) from intermediary_stats where intermediary_type='misp'),
    'producing_intermediary_count',(select count(*) from intermediary_stats where policy_count>0),
    'policy_count',(select count(*) from policy_base),
    'customer_count',(select count(distinct customer_id) from policy_base),
    'gross_premium',coalesce((select sum(gross_premium) from policy_base),0),
    'onboarding_open_count',(select count(*) from scoped_applications where registration_status not in ('partner_active','iib_registered','rejected'))
  ) as value
),
onboarding_summary as (
  select jsonb_build_object(
    'total',count(*),
    'open',count(*) filter (where registration_status not in ('partner_active','iib_registered','rejected')),
    'compliance',count(*) filter (where stage in ('Compliance','Primary review')),
    'training',count(*) filter (where stage='Training'),
    'exam',count(*) filter (where stage='Exam'),
    'agreement',count(*) filter (where stage='Agreement'),
    'iib',count(*) filter (where stage='IIB registration'),
    'completed',count(*) filter (where registration_status in ('partner_active','iib_registered')),
    'rejected',count(*) filter (where registration_status='rejected')
  ) as value from scoped_applications
),
rm_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_id',employee_id,'name',name,'intermediary_count',intermediary_count,
    'active_intermediary_count',active_intermediary_count,'producing_intermediary_count',producing_intermediary_count,
    'policy_count',policy_count,'customer_count',customer_count,'gross_premium',gross_premium
  ) order by gross_premium desc, intermediary_count desc, name),'[]'::jsonb) as value from rm_stats
),
intermediary_rows as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'application_id',application_id,'code',intermediary_code,'name',display_name,'type',intermediary_type,
    'rm_employee_id',associate_employee_id,'rm_name',rm_name,'account_status',account_status,
    'compliance_status',compliance_status,'iib_status',iib_status,'registration_status',registration_status,
    'policy_count',policy_count,'customer_count',customer_count,'gross_premium',gross_premium,'last_business_date',last_business_date
  ) order by gross_premium desc, display_name),'[]'::jsonb) as value
  from (select * from intermediary_stats order by gross_premium desc, display_name
        limit greatest(1,least(p_page_size,100))
        offset (greatest(p_page,1)-1)*greatest(1,least(p_page_size,100))) q
),
onboarding_rows as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'application_reference',application_reference,'name',applicant_name,'type',effective_type,
    'rm_employee_id',associate_employee_id,'rm_name',rm_name,'stage',stage,'registration_status',registration_status,
    'training_status',training_status,'exam_status',exam_status,'agreement_status',agreement_status,
    'iib_registration_status',iib_registration_status,'age_days',age_days,'submitted_at',submitted_at,'completed_at',completed_at
  ) order by age_days desc, applicant_name),'[]'::jsonb) as value
  from (select * from scoped_applications order by age_days desc, applicant_name
        limit greatest(1,least(p_onboarding_page_size,100))
        offset (greatest(p_onboarding_page,1)-1)*greatest(1,least(p_onboarding_page_size,100))) q
),
filter_rms as (
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',full_name) order by full_name),'[]'::jsonb) as value
  from (
    select distinct e.id,e.full_name
    from public.intermediaries i
    left join public.posp_misp_onboarding_profiles op on op.application_id=i.application_id
    join public.employees e on e.id=coalesce(i.associate_employee_id,op.associate_employee_id)
    where (p_intermediary_ids is null or i.id=any(p_intermediary_ids)) and e.employment_status='active'
  ) q
)
select jsonb_build_object(
  'summary',(select value from summary),
  'rms',(select value from rm_json),
  'intermediaries',jsonb_build_object('rows',(select value from intermediary_rows),'total_count',(select count(*) from intermediary_stats),'page',greatest(p_page,1),'page_size',greatest(1,least(p_page_size,100))),
  'onboarding_summary',(select value from onboarding_summary),
  'onboarding',jsonb_build_object('rows',(select value from onboarding_rows),'total_count',(select count(*) from scoped_applications),'page',greatest(p_onboarding_page,1),'page_size',greatest(1,least(p_onboarding_page_size,100))),
  'filters',jsonb_build_object('rms',(select value from filter_rms),'types',jsonb_build_array('partner','posp','misp'),'account_statuses',jsonb_build_array('active','under_onboarding','inactive','suspended','terminated','rejected'))
);
$$;

revoke all on function public.get_distribution_report(uuid[],uuid[],date,date,uuid,text,text,integer,integer,integer,integer) from public;
revoke all on function public.get_distribution_report(uuid[],uuid[],date,date,uuid,text,text,integer,integer,integer,integer) from anon;
revoke all on function public.get_distribution_report(uuid[],uuid[],date,date,uuid,text,text,integer,integer,integer,integer) from authenticated;
grant execute on function public.get_distribution_report(uuid[],uuid[],date,date,uuid,text,text,integer,integer,integer,integer) to service_role;
