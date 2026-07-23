-- Provide one RLS-aware read contract for the web operations dashboard.
-- The function is security invoker so every aggregate remains scoped to the
-- authenticated user's existing table policies.

create index if not exists policies_end_date_idx
  on public.policies(end_date);

create index if not exists claims_created_at_idx
  on public.claims(created_at desc);

create index if not exists claims_updated_at_idx
  on public.claims(updated_at desc);

create index if not exists claim_tasks_status_due_date_idx
  on public.claim_tasks(status, due_date)
  where status in ('open', 'in_progress');

create index if not exists onboarding_applications_status_updated_idx
  on public.customer_onboarding_applications(status, updated_at desc);

create index if not exists claim_documents_verification_status_idx
  on public.claim_documents(verification_status);

create index if not exists onboarding_documents_verification_status_idx
  on public.customer_onboarding_documents(verification_status);

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
      'customers', (select count(*) from public.customers),
      'activeCustomers', (select count(*) from public.customers where onboarding_status = 'active'),
      'newCustomers', (select count(*) from public.customers, clock where created_at >= clock.recent_cutoff),
      'vehicles', (select count(*) from public.vehicles),
      'policies', (select count(*) from public.policies),
      'activePolicies', (select count(*) from public.policies, clock where end_date >= clock.today),
      'expiringPolicies', (
        select count(*)
        from public.policies, clock
        where end_date >= clock.today
          and end_date <= clock.renewal_cutoff
      ),
      'expiredPolicies', (select count(*) from public.policies, clock where end_date < clock.today),
      'claims', (select count(*) from public.claims),
      'openClaims', (
        select count(*)
        from public.claims
        where current_status::text not in ('Claim Complete', 'Settled', 'Closed')
      ),
      'recentClaims', (select count(*) from public.claims, clock where created_at >= clock.recent_cutoff)
    ),
    'portfolio', jsonb_build_array(
      jsonb_build_object('key', 'group', 'label', 'Groups', 'value', (select count(*) from public.customers where partner_type = 'group')),
      jsonb_build_object('key', 'corporate', 'label', 'Corporate', 'value', (select count(*) from public.customers where partner_type = 'corporate')),
      jsonb_build_object('key', 'dealership', 'label', 'Dealerships', 'value', (select count(*) from public.customers where partner_type = 'dealership')),
      jsonb_build_object('key', 'individual', 'label', 'Individual / Proprietor', 'value', (select count(*) from public.customers where partner_type = 'individual_proprietor')),
      jsonb_build_object('key', 'posp', 'label', 'POSP', 'value', (select count(*) from public.customers where partner_type = 'posp')),
      jsonb_build_object('key', 'misp', 'label', 'MISP', 'value', (select count(*) from public.customers where partner_type = 'misp'))
    ),
    'attention', jsonb_build_object(
      'onboarding', (
        select count(*)
        from public.customer_onboarding_applications
        where status in ('submitted', 'under_review', 'changes_requested')
      ),
      'submittedOnboarding', (
        select count(*)
        from public.customer_onboarding_applications
        where status = 'submitted'
      ),
      'changesRequested', (
        select count(*)
        from public.customer_onboarding_applications
        where status = 'changes_requested'
      ),
      'overdueTasks', (
        select count(*)
        from public.claim_tasks, clock
        where status in ('open', 'in_progress')
          and due_date < clock.today
      ),
      'openTasks', (
        select count(*)
        from public.claim_tasks
        where status in ('open', 'in_progress')
      ),
      'documents', (
        (select count(*) from public.claim_documents where verification_status in ('pending', 'rejected'))
        +
        (select count(*) from public.customer_onboarding_documents where verification_status in ('pending', 'rejected'))
      ),
      'highPriorityActivity', (
        select count(*)
        from public.customer_activity_events
        where status in ('new', 'seen', 'in_progress')
          and priority in ('high', 'critical')
      )
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
  );
$$;

revoke all on function public.get_operations_dashboard() from public;
grant execute on function public.get_operations_dashboard() to authenticated;
grant execute on function public.get_operations_dashboard() to service_role;
