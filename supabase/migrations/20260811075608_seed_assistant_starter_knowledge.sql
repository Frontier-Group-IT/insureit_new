-- Starter knowledge is deliberately limited to repository-verified navigation
-- and workflow guidance. Every entry retains the destination's permission floor.

insert into public.assistant_knowledge_entries (
  route, title, content, tags, source_reference, required_capabilities,
  required_access, route_required_permissions, version, status,
  effective_from, is_revoked, published_at
)
values
  (
    '/intermediaries/posp/new',
    'POSP onboarding entry points',
    'Use Add POSP to start a new POSP application. If the POSP already exists in the customer data and needs to be linked through the existing-person workflow, use Add Existing POSP instead. Pending POSP and MISP onboarding applications are available from Pending Applications. Access to each destination still depends on the employee''s assigned permissions.',
    array['posp','onboarding','intermediary','application'],
    'apps/web-portal/lib/navigation-catalogue.ts',
    array['view_intermediaries','create_intermediary_application'],
    'view',
    '{"view_intermediaries":"view","create_intermediary_application":"edit"}'::jsonb,
    1, 'published', now(), false, now()
  ),
  (
    '/policies/new',
    'Policy Onboarding workflow',
    'Use Add Policy to open Policy Onboarding. Select the intermediary type before choosing the lead source. The assigned relationship manager and intermediary code are derived from the selected source. Fetch RC is an explicit action and its returned vehicle details must be reviewed before applying. Read Policy Copy can propose approved policy and premium fields, but the user must review them before applying. The database transaction remains authoritative when the policy is saved.',
    array['policy','onboarding','rc','ocr','premium'],
    'docs/INSUREIT_PROJECT_CONTEXT.md; docs/AUTHBRIDGE_RC_HANDOFF.md; docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md',
    array['view_customers','view_vehicles','view_policies'],
    'view',
    '{"view_customers":"view","view_vehicles":"view","view_policies":"edit"}'::jsonb,
    1, 'published', now(), false, now()
  ),
  (
    '/claims',
    'Claims workspace navigation',
    'Use All Claims for the claims register. The Work Queues group provides Documents, Verification, Survey, Under Repair, and Settlement destinations. Some operational queues require claim-management permission in addition to claims viewing permission.',
    array['claims','work queues','documents','survey','settlement'],
    'apps/web-portal/lib/navigation-catalogue.ts',
    array['view_claims'],
    'view',
    '{"view_claims":"view"}'::jsonb,
    1, 'published', now(), false, now()
  ),
  (
    '/customer-kyc',
    'Customer KYC destinations',
    'Use Customer KYC for the customer KYC workspace. Use Onboarding Applications when the task is to review customer onboarding applications. Visibility and review actions remain restricted by the employee''s customer and KYC permissions.',
    array['customer','kyc','onboarding','applications','review'],
    'apps/web-portal/lib/navigation-catalogue.ts',
    array['view_customers','view_kyc'],
    'view',
    '{"view_customers":"view","view_kyc":"view"}'::jsonb,
    1, 'published', now(), false, now()
  ),
  (
    '/tasks',
    'Task status views',
    'Use All Tasks for the complete permitted task list. Dedicated views are available for Open, In Progress, Overdue, and Completed tasks. These views do not expand the employee''s underlying task permissions.',
    array['tasks','open','in progress','overdue','completed'],
    'apps/web-portal/lib/navigation-catalogue.ts',
    array['view_tasks'],
    'view',
    '{"view_tasks":"view"}'::jsonb,
    1, 'published', now(), false, now()
  )
on conflict (route, title, version) do update
set content = excluded.content,
    tags = excluded.tags,
    source_reference = excluded.source_reference,
    required_capabilities = excluded.required_capabilities,
    required_access = excluded.required_access,
    route_required_permissions = excluded.route_required_permissions,
    status = 'published',
    effective_from = excluded.effective_from,
    effective_to = null,
    is_revoked = false,
    published_at = excluded.published_at,
    retired_at = null,
    updated_at = now();
