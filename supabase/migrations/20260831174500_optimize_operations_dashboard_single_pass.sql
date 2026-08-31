create or replace function public.get_operations_dashboard()
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  with
  clock as (
    select
      (now() at time zone 'Asia/Kolkata')::date as today,
      ((now() at time zone 'Asia/Kolkata')::date + 45) as renewal_cutoff,
      now() - interval '30 days' as recent_cutoff
  ),
  customer_stats as (
    select
      count(*) as customers,
      count(*) filter (where onboarding_status = 'active') as active_customers,
      count(*) filter (where created_at >= clock.recent_cutoff) as new_customers,
      count(*) filter (where partner_type = 'group') as groups,
      count(*) filter (where partner_type = 'corporate') as corporate,
      count(*) filter (where partner_type = 'dealership') as dealerships,
      count(*) filter (where partner_type = 'individual_proprietor') as individual,
      count(*) filter (where partner_type = 'posp') as posp,
      count(*) filter (where partner_type = 'misp') as misp
    from public.customers, clock
  ),
  vehicle_stats as (
    select count(*) as vehicles
    from public.vehicles
  ),
  policy_stats as (
    select
      count(*) as policies,
      count(*) filter (where end_date >= clock.today) as active_policies,
      count(*) filter (
        where end_date >= clock.today
          and end_date <= clock.renewal_cutoff
      ) as expiring_policies,
      count(*) filter (where end_date < clock.today) as expired_policies
    from public.policies, clock
  ),
  claim_stats as (
    select
      count(*) as claims,
      count(*) filter (
        where current_status::text not in ('Claim Complete', 'Settled', 'Closed')
      ) as open_claims,
      count(*) filter (where created_at >= clock.recent_cutoff) as recent_claims
    from public.claims, clock
  ),
  onboarding_stats as (
    select
      count(*) filter (
        where status in ('submitted', 'under_review', 'changes_requested')
      ) as onboarding,
      count(*) filter (where status = 'submitted') as submitted_onboarding,
      count(*) filter (where status = 'changes_requested') as changes_requested
    from public.customer_onboarding_applications
  ),
  task_stats as (
    select
      count(*) filter (
        where status in ('open', 'in_progress')
          and due_date < clock.today
      ) as overdue_tasks,
      count(*) filter (where status in ('open', 'in_progress')) as open_tasks
    from public.claim_tasks, clock
  ),
  document_stats as (
    select
      (select count(*)
       from public.claim_documents
       where verification_status in ('pending', 'rejected'))
      +
      (select count(*)
       from public.customer_onboarding_documents
       where verification_status in ('pending', 'rejected')) as documents
  ),
  activity_stats as (
    select count(*) as high_priority_activity
    from public.customer_activity_events
    where status in ('new', 'seen', 'in_progress')
      and priority in ('high', 'critical')
  ),
  recent_applications as (
    select
      application.id,
      application.partner_type,
      application.status,
      application.applicant_phone,
      application.applicant_email,
      application.updated_at,
      case application.partner_type
        when 'group' then coalesce(
          nullif(trim(application.draft_data->>'group_name'), ''),
          nullif(trim(application.draft_data->>'owner_name'), '')
        )
        when 'corporate' then coalesce(
          nullif(trim(application.draft_data->>'company_name'), ''),
          nullif(trim(application.draft_data->>'contact_name'), '')
        )
        when 'dealership' then coalesce(
          nullif(trim(application.draft_data->>'dealership_name'), ''),
          nullif(trim(application.draft_data->>'owner_name'), '')
        )
        when 'posp' then coalesce(
          nullif(trim(application.draft_data->>'pos_name'), ''),
          nullif(trim(application.draft_data->>'associate_name'), '')
        )
        when 'misp' then coalesce(
          nullif(trim(application.draft_data->>'misp_name'), ''),
          nullif(trim(application.draft_data->>'dp_name'), '')
        )
        else coalesce(
          nullif(trim(application.draft_data->>'contact_name'), ''),
          nullif(trim(application.draft_data->>'owner_name'), '')
        )
      end as display_name
    from public.customer_onboarding_applications application
    order by application.updated_at desc
    limit 5
  ),
  latest_claims as (
    select
      claim.id,
      claim.claim_no,
      claim.current_status::text as current_status,
      claim.updated_at,
      customer.company_name,
      customer.contact_name,
      vehicle.vehicle_no
    from public.claims claim
    left join public.customers customer on customer.id = claim.customer_id
    left join public.vehicles vehicle on vehicle.id = claim.vehicle_id
    order by claim.updated_at desc
    limit 5
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'customers', customers.customers,
      'activeCustomers', customers.active_customers,
      'newCustomers', customers.new_customers,
      'vehicles', vehicles.vehicles,
      'policies', policies.policies,
      'activePolicies', policies.active_policies,
      'expiringPolicies', policies.expiring_policies,
      'expiredPolicies', policies.expired_policies,
      'claims', claims.claims,
      'openClaims', claims.open_claims,
      'recentClaims', claims.recent_claims
    ),
    'portfolio', jsonb_build_array(
      jsonb_build_object('key', 'group', 'label', 'Groups', 'value', customers.groups),
      jsonb_build_object('key', 'corporate', 'label', 'Corporate', 'value', customers.corporate),
      jsonb_build_object('key', 'dealership', 'label', 'Dealerships', 'value', customers.dealerships),
      jsonb_build_object('key', 'individual', 'label', 'Individual / Proprietor', 'value', customers.individual),
      jsonb_build_object('key', 'posp', 'label', 'POSP', 'value', customers.posp),
      jsonb_build_object('key', 'misp', 'label', 'MISP', 'value', customers.misp)
    ),
    'attention', jsonb_build_object(
      'onboarding', onboarding.onboarding,
      'submittedOnboarding', onboarding.submitted_onboarding,
      'changesRequested', onboarding.changes_requested,
      'overdueTasks', tasks.overdue_tasks,
      'openTasks', tasks.open_tasks,
      'documents', documents.documents,
      'highPriorityActivity', activity.high_priority_activity
    ),
    'recentApplications', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', item.id,
            'partner_type', item.partner_type,
            'status', item.status,
            'applicant_phone', item.applicant_phone,
            'applicant_email', item.applicant_email,
            'display_name', item.display_name,
            'updated_at', item.updated_at
          )
          order by item.updated_at desc
        )
        from recent_applications item
      ),
      '[]'::jsonb
    ),
    'latestClaims', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', item.id,
            'claim_no', item.claim_no,
            'current_status', item.current_status,
            'updated_at', item.updated_at,
            'customers', jsonb_build_object(
              'company_name', item.company_name,
              'contact_name', item.contact_name
            ),
            'vehicles', jsonb_build_object('vehicle_no', item.vehicle_no)
          )
          order by item.updated_at desc
        )
        from latest_claims item
      ),
      '[]'::jsonb
    )
  )
  from customer_stats customers,
       vehicle_stats vehicles,
       policy_stats policies,
       claim_stats claims,
       onboarding_stats onboarding,
       task_stats tasks,
       document_stats documents,
       activity_stats activity;
$function$;
