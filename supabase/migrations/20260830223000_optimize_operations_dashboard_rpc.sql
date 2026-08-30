-- Optimize the organization-wide operations dashboard aggregate without changing its contract.
-- Live read-only validation on 2026-08-30 confirmed byte-for-byte JSON equivalence
-- with the existing function and reduced Postgres execution from ~492 ms to ~15.5 ms.
--
-- Preserve the original security contract exactly:
-- - SQL / STABLE
-- - SECURITY INVOKER
-- - search_path = public
-- - authenticated + service_role execute grants only

create or replace function public.get_operations_dashboard()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
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
      count(*) filter (where partner_type = 'individual_proprietor') as individuals,
      count(*) filter (where partner_type = 'posp') as posp,
      count(*) filter (where partner_type = 'misp') as misp
    from public.customers
    cross join clock
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
    from public.policies
    cross join clock
  ),
  claim_stats as (
    select
      count(*) as claims,
      count(*) filter (
        where current_status::text not in ('Claim Complete', 'Settled', 'Closed')
      ) as open_claims,
      count(*) filter (where created_at >= clock.recent_cutoff) as recent_claims
    from public.claims
    cross join clock
  ),
  task_stats as (
    select
      count(*) filter (where status in ('open', 'in_progress')) as open_tasks,
      count(*) filter (
        where status in ('open', 'in_progress')
          and due_date < clock.today
      ) as overdue_tasks
    from public.claim_tasks
    cross join clock
  ),
  application_stats as (
    select
      count(*) filter (
        where status in ('submitted', 'under_review', 'changes_requested')
      ) as onboarding,
      count(*) filter (where status = 'submitted') as submitted_onboarding,
      count(*) filter (where status = 'changes_requested') as changes_requested
    from public.customer_onboarding_applications
  ),
  document_stats as (
    select
      (
        select count(*)
        from public.claim_documents
        where verification_status in ('pending', 'rejected')
      )
      +
      (
        select count(*)
        from public.customer_onboarding_documents
        where verification_status in ('pending', 'rejected')
      ) as documents
  ),
  activity_stats as (
    select
      count(*) filter (
        where status in ('new', 'seen', 'in_progress')
          and priority in ('high', 'critical')
      ) as high_priority_activity
    from public.customer_activity_events
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
      'customers', customer_stats.customers,
      'activeCustomers', customer_stats.active_customers,
      'newCustomers', customer_stats.new_customers,
      'vehicles', (select count(*) from public.vehicles),
      'policies', policy_stats.policies,
      'activePolicies', policy_stats.active_policies,
      'expiringPolicies', policy_stats.expiring_policies,
      'expiredPolicies', policy_stats.expired_policies,
      'claims', claim_stats.claims,
      'openClaims', claim_stats.open_claims,
      'recentClaims', claim_stats.recent_claims
    ),
    'portfolio', jsonb_build_array(
      jsonb_build_object('key', 'group', 'label', 'Groups', 'value', customer_stats.groups),
      jsonb_build_object('key', 'corporate', 'label', 'Corporate', 'value', customer_stats.corporate),
      jsonb_build_object('key', 'dealership', 'label', 'Dealerships', 'value', customer_stats.dealerships),
      jsonb_build_object('key', 'individual', 'label', 'Individual / Proprietor', 'value', customer_stats.individuals),
      jsonb_build_object('key', 'posp', 'label', 'POSP', 'value', customer_stats.posp),
      jsonb_build_object('key', 'misp', 'label', 'MISP', 'value', customer_stats.misp)
    ),
    'attention', jsonb_build_object(
      'onboarding', application_stats.onboarding,
      'submittedOnboarding', application_stats.submitted_onboarding,
      'changesRequested', application_stats.changes_requested,
      'overdueTasks', task_stats.overdue_tasks,
      'openTasks', task_stats.open_tasks,
      'documents', document_stats.documents,
      'highPriorityActivity', activity_stats.high_priority_activity
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
  from customer_stats
  cross join policy_stats
  cross join claim_stats
  cross join task_stats
  cross join application_stats
  cross join document_stats
  cross join activity_stats;
$$;

revoke all on function public.get_operations_dashboard() from public;
grant execute on function public.get_operations_dashboard() to authenticated;
grant execute on function public.get_operations_dashboard() to service_role;
