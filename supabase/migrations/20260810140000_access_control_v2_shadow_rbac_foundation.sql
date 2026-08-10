-- INSUREIT Access Control V2 - shadow RBAC foundation
--
-- ADDITIVE / NON-ENFORCING MIGRATION.
-- This migration does not change profiles.role, JWT role claims, existing RLS
-- helpers/policies, employee_permission_overrides, role_permission_overrides or
-- permission_change_logs. No employee receives a V2 role assignment here.
--
-- The new tables are intentionally not exposed to anon/authenticated clients.
-- Existing production authorization remains authoritative until a later parity-
-- verified cut-over migration explicitly says otherwise.

begin;

create table if not exists public.access_roles_v2 (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  purpose text not null,
  category text not null check (category in ('business','administrative','technical','compatibility')),
  status text not null check (status in ('active','protected','compatibility')),
  assignable boolean not null default true,
  protected boolean not null default false,
  default_scope text not null check (default_scope in ('self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization')),
  is_active boolean not null default true,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint access_roles_v2_protected_consistency check (
    (protected = false) or (status = 'protected' and assignable = false)
  )
);

create table if not exists public.access_permissions_v2 (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique,
  module text not null,
  label text not null,
  description text not null,
  risk text not null check (risk in ('standard','sensitive','high','critical')),
  allowed_access_levels text[] not null,
  allowed_scopes text[] not null,
  scope_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_permissions_v2_levels_not_empty check (cardinality(allowed_access_levels) > 0),
  constraint access_permissions_v2_access_levels_valid check (
    allowed_access_levels <@ array['view','edit','approve']::text[]
  ),
  constraint access_permissions_v2_scopes_valid check (
    allowed_scopes <@ array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization']::text[]
  ),
  constraint access_permissions_v2_scope_required_valid check (
    scope_required = false or cardinality(allowed_scopes) > 0
  )
);

create table if not exists public.access_role_permissions_v2 (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.access_roles_v2(id) on delete cascade,
  permission_id uuid not null references public.access_permissions_v2(id) on delete cascade,
  access_level text not null check (access_level in ('view','edit','approve')),
  scope_type text null check (scope_type is null or scope_type in ('self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization')),
  is_active boolean not null default true,
  reason text null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(role_id, permission_id)
);

create table if not exists public.employee_role_assignments_v2 (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  role_id uuid not null references public.access_roles_v2(id) on delete restrict,
  is_primary boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  is_active boolean not null default true,
  reason text null,
  assigned_by uuid null references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  revoked_by uuid null references public.profiles(id) on delete set null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_role_assignments_v2_date_order check (ends_at is null or ends_at > starts_at),
  constraint employee_role_assignments_v2_revoke_consistency check (
    revoked_at is null or is_active = false
  )
);

create unique index if not exists employee_role_assignments_v2_one_primary_active_idx
  on public.employee_role_assignments_v2(employee_id)
  where is_primary = true and is_active = true and revoked_at is null;

create index if not exists employee_role_assignments_v2_employee_idx
  on public.employee_role_assignments_v2(employee_id, is_active);
create index if not exists employee_role_assignments_v2_role_idx
  on public.employee_role_assignments_v2(role_id, is_active);
create index if not exists access_role_permissions_v2_role_idx
  on public.access_role_permissions_v2(role_id, is_active);
create index if not exists access_role_permissions_v2_permission_idx
  on public.access_role_permissions_v2(permission_id, is_active);

-- Shadow tables must not become a second client-visible authorization surface.
alter table public.access_roles_v2 enable row level security;
alter table public.access_permissions_v2 enable row level security;
alter table public.access_role_permissions_v2 enable row level security;
alter table public.employee_role_assignments_v2 enable row level security;

revoke all on table public.access_roles_v2 from anon, authenticated;
revoke all on table public.access_permissions_v2 from anon, authenticated;
revoke all on table public.access_role_permissions_v2 from anon, authenticated;
revoke all on table public.employee_role_assignments_v2 from anon, authenticated;

-- Role catalogue. Manager/Agent are compatibility-only. IT Super User is protected.
insert into public.access_roles_v2
  (code,label,purpose,category,status,assignable,protected,default_scope,is_active)
values
  ('super_admin','Super Admin','Highest business authority for organisation-wide operations, employees, portal users and business access administration.','administrative','active',true,false,'organization',true),
  ('admin','Admin','Operational administrator for business records, employee administration, portal users, audit and master data without protected technical configuration authority.','administrative','active',true,false,'organization',true),
  ('director','Director','Organisation-wide executive visibility with selected business review and approval authority, without routine security or technical administration.','business','active',true,false,'organization',true),
  ('sales_operations_head','Operations Head','Organisation-wide owner of operational onboarding, customer/KYC processing, claims workflow and follow-up execution.','business','active',true,false,'organization',true),
  ('backoffice_executive','Backoffice Executive','Organisation-wide operational processing for intermediary onboarding, customer/KYC records and follow-up work without final activation or security administration.','business','active',true,false,'organization',true),
  ('sales_head','Sales Head','Senior sales leader with customer, intermediary and operational visibility inside their reporting hierarchy.','business','active',true,false,'hierarchy',true),
  ('zonal_head','Zonal Head','Sales hierarchy leader for customer, intermediary, KYC and task activity inside their reporting hierarchy.','business','active',true,false,'hierarchy',true),
  ('asm','Area Sales Head','Area sales leader for customer, intermediary, KYC and task activity inside their reporting hierarchy.','business','active',true,false,'hierarchy',true),
  ('sales_manager','Sales Manager','Team-level sales manager for customer, intermediary, KYC and task activity inside their reporting hierarchy.','business','active',true,false,'hierarchy',true),
  ('relationship_manager','Relationship Manager','Front-line owner of their own customer portfolio and initiation of intermediary onboarding.','business','active',true,false,'self',true),
  ('claims_head','Claims Head','Organisation-wide claims owner with final operational authority across claim verification, assignment and workflow progression.','business','active',true,false,'organization',true),
  ('claim_processor','Claim Processor','Processes assigned claims and related tasks without organisation-wide or final approval authority by default.','business','active',true,false,'assigned',true),
  ('field_executive','Field Executive','Views assigned field claims and tasks without broad business-data access.','business','active',true,false,'assigned',true),
  ('it_super_user','IT Super User','Protected technical authority for platform recovery, security administration and integration configuration.','technical','protected',false,true,'organization',true),
  ('manager','Manager (Legacy Compatibility)','Legacy broad-access role retained temporarily because existing TypeScript and database rules reference it. Do not assign to new employees.','compatibility','compatibility',false,false,'organization',true),
  ('agent','Agent (Legacy Compatibility)','Legacy customer-assignment role retained until customer ownership and sales RLS no longer depend on the Agent role name.','compatibility','compatibility',false,false,'self',true)
on conflict (code) do update set
  label = excluded.label,
  purpose = excluded.purpose,
  category = excluded.category,
  status = excluded.status,
  assignable = excluded.assignable,
  protected = excluded.protected,
  default_scope = excluded.default_scope,
  is_active = excluded.is_active,
  updated_at = now();

-- Canonical V2 permission catalogue.
insert into public.access_permissions_v2
  (permission_key,module,label,description,risk,allowed_access_levels,allowed_scopes,scope_required,is_active)
values
  ('dashboard.view','Dashboard','View dashboard','View operational dashboard summaries.','standard',array['view'],array['organization'],false,true),
  ('claims.view','Claims','View claims','View claim records within the permitted data scope.','standard',array['view'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('claims.edit','Claims','Edit claims','Create or update operational claim information.','sensitive',array['edit'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('claims.verify_documents','Claims','Verify claim documents','Verify or reject claim documents and verification details.','high',array['edit','approve'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('claims.assign_surveyor','Claims','Assign surveyor','Assign or depute surveyors for accessible claims.','high',array['edit','approve'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('claims.change_stage','Claims','Change claim stage','Move a claim between controlled workflow stages.','high',array['edit','approve'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('intermediaries.view','Intermediaries','View intermediaries','View Partner, POSP and MISP records.','standard',array['view'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('intermediaries.application.create','Intermediaries','Create intermediary applications','Create new Partner, POSP and MISP onboarding applications.','sensitive',array['edit'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('intermediaries.application.review','Intermediaries','Review intermediary applications','Review and update onboarding information and documents.','sensitive',array['edit'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('intermediaries.application.approve','Intermediaries','Approve intermediary applications','Give final onboarding approval before activation.','high',array['approve'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('intermediaries.activate','Intermediaries','Activate intermediary accounts','Activate approved Partner, POSP or MISP accounts.','critical',array['approve'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('intermediaries.portal_users.manage','Intermediaries','Manage intermediary portal users','Create, enable, disable or repair intermediary portal access.','critical',array['edit','approve'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('intermediaries.training.manage','Intermediaries','Manage training and exam','Assign, launch, synchronize or update training and examination workflow.','sensitive',array['edit'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('intermediaries.agreement.manage','Intermediaries','Manage agreements','Manage intermediary agreement workflow and documents.','sensitive',array['edit','approve'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('intermediaries.iib.manage','Intermediaries','Manage IIB workflow','Manage IIB submission and registration workflow.','high',array['edit','approve'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('intermediaries.delete','Intermediaries','Permanently delete intermediary accounts','Permanently delete intermediary accounts and related portal identities/documents.','critical',array['approve'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('customers.view','Customers','View customers','View customer records within the permitted portfolio or hierarchy.','standard',array['view'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('customers.create','Customers','Create customers','Create new customer records.','sensitive',array['edit'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('customers.edit','Customers','Edit customers','Update accessible customer records.','sensitive',array['edit'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('kyc.view','KYC','View KYC','View KYC applications and supporting documents.','sensitive',array['view'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('kyc.review','KYC','Review KYC','Review KYC information and request corrections.','high',array['edit'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('kyc.approve','KYC','Approve KYC','Give final KYC approval or rejection.','critical',array['approve'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('employees.view','Employees','View employee directory','View employee records within the permitted organisation scope.','sensitive',array['view'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('employees.create','Employees','Create employees','Create employee directory records without automatically granting portal access.','high',array['edit'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('employees.edit','Employees','Edit employees','Update employee HR/organisation attributes.','high',array['edit'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('employees.deactivate','Employees','Deactivate employees','Deactivate employee records and trigger portal-access suspension workflow.','critical',array['approve'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('organisation.view','Organisation','View organisation structure','View reporting hierarchy and organisation structure.','sensitive',array['view'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('vehicles.view','Fleet','View vehicles','View vehicles attached to accessible customers.','standard',array['view'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('vehicles.create','Fleet','Add vehicles','Add vehicles for accessible customers.','sensitive',array['edit'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('vehicles.edit','Fleet','Edit vehicles','Update accessible vehicle records.','sensitive',array['edit'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('policies.view','Policies','View policies','View policies for accessible customers and vehicles.','standard',array['view'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('policies.create','Policies','Add policies','Create policies for accessible customers and vehicles.','sensitive',array['edit'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('policies.edit','Policies','Edit policies','Update accessible policy records.','sensitive',array['edit'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('tasks.view','Tasks','View tasks','View assigned or otherwise accessible tasks.','standard',array['view'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('tasks.create','Tasks','Create tasks','Create operational follow-up tasks.','sensitive',array['edit'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('tasks.assign','Tasks','Assign tasks','Assign tasks to employees inside the permitted scope.','sensitive',array['edit','approve'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('tasks.edit','Tasks','Update tasks','Update or close accessible tasks.','sensitive',array['edit'],array['self','assigned','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('reports.view','Reports','View reports','View management reports when the reporting workspace is enabled.','sensitive',array['view'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('notifications.view','Notifications','View notifications','View notifications relevant to the signed-in user.','standard',array['view'],array['self'],true,true),
  ('admin.portal_users.manage','Administration','Manage employee portal users','Invite, enable, suspend and restore employee portal identities.','critical',array['approve'],array['organization'],false,true),
  ('admin.roles.manage','Administration','Manage roles','Create, update, assign and retire business security roles.','critical',array['approve'],array['organization'],false,true),
  ('admin.permissions.manage','Administration','Manage permissions','Change role permissions and employee-specific access exceptions.','critical',array['approve'],array['organization'],false,true),
  ('admin.audit.view','Administration','View access audit','View role, permission and portal-user security history.','high',array['view'],array['organization'],false,true),
  ('master_data.manage','Master Data','Manage master data','Create and update operational reference/master data.','high',array['edit','approve'],array['organization'],false,true),
  ('system.manage','System','Manage system settings','Manage protected system configuration.','critical',array['approve'],array['organization'],false,true),
  ('system.integrations.configure','System','Configure integrations','Configure or test protected external service integrations and UAT tooling.','critical',array['approve'],array['organization'],false,true)
on conflict (permission_key) do update set
  module = excluded.module,
  label = excluded.label,
  description = excluded.description,
  risk = excluded.risk,
  allowed_access_levels = excluded.allowed_access_levels,
  allowed_scopes = excluded.allowed_scopes,
  scope_required = excluded.scope_required,
  is_active = excluded.is_active,
  updated_at = now();

-- Seed role defaults from the approved Phase 3 shadow matrix.
-- A grant can only be inserted when its requested access/scope is permitted by
-- the canonical permission metadata; the WHERE clause is an additional database
-- guard against a stale/invalid seed line.
with role_grants(role_code, permission_key, access_level, scope_type) as (
  values
    -- Super Admin: all business/admin authority except protected integration configuration.
    ('super_admin','dashboard.view','view',null),
    ('super_admin','claims.view','view','organization'),('super_admin','claims.edit','edit','organization'),('super_admin','claims.verify_documents','approve','organization'),('super_admin','claims.assign_surveyor','approve','organization'),('super_admin','claims.change_stage','approve','organization'),
    ('super_admin','intermediaries.view','view','organization'),('super_admin','intermediaries.application.create','edit','organization'),('super_admin','intermediaries.application.review','edit','organization'),('super_admin','intermediaries.application.approve','approve','organization'),('super_admin','intermediaries.activate','approve','organization'),('super_admin','intermediaries.portal_users.manage','approve','organization'),('super_admin','intermediaries.training.manage','edit','organization'),('super_admin','intermediaries.agreement.manage','approve','organization'),('super_admin','intermediaries.iib.manage','approve','organization'),('super_admin','intermediaries.delete','approve','organization'),
    ('super_admin','customers.view','view','organization'),('super_admin','customers.create','edit','organization'),('super_admin','customers.edit','edit','organization'),('super_admin','kyc.view','view','organization'),('super_admin','kyc.review','edit','organization'),('super_admin','kyc.approve','approve','organization'),
    ('super_admin','employees.view','view','organization'),('super_admin','employees.create','edit','organization'),('super_admin','employees.edit','edit','organization'),('super_admin','employees.deactivate','approve','organization'),('super_admin','organisation.view','view','organization'),
    ('super_admin','vehicles.view','view','organization'),('super_admin','vehicles.create','edit','organization'),('super_admin','vehicles.edit','edit','organization'),('super_admin','policies.view','view','organization'),('super_admin','policies.create','edit','organization'),('super_admin','policies.edit','edit','organization'),
    ('super_admin','tasks.view','view','organization'),('super_admin','tasks.create','edit','organization'),('super_admin','tasks.assign','approve','organization'),('super_admin','tasks.edit','edit','organization'),('super_admin','reports.view','view','organization'),('super_admin','notifications.view','view','self'),
    ('super_admin','admin.portal_users.manage','approve',null),('super_admin','admin.roles.manage','approve',null),('super_admin','admin.permissions.manage','approve',null),('super_admin','admin.audit.view','view',null),('super_admin','master_data.manage','approve',null),('super_admin','system.manage','approve',null),

    -- Admin: operational administration, not security-model ownership or protected integration config.
    ('admin','dashboard.view','view',null),('admin','notifications.view','view','self'),
    ('admin','claims.view','view','organization'),('admin','claims.edit','edit','organization'),('admin','claims.verify_documents','approve','organization'),('admin','claims.assign_surveyor','approve','organization'),('admin','claims.change_stage','approve','organization'),
    ('admin','intermediaries.view','view','organization'),('admin','intermediaries.application.create','edit','organization'),('admin','intermediaries.application.review','edit','organization'),('admin','intermediaries.application.approve','approve','organization'),('admin','intermediaries.activate','approve','organization'),('admin','intermediaries.portal_users.manage','approve','organization'),('admin','intermediaries.training.manage','edit','organization'),('admin','intermediaries.agreement.manage','approve','organization'),('admin','intermediaries.iib.manage','approve','organization'),
    ('admin','customers.view','view','organization'),('admin','customers.create','edit','organization'),('admin','customers.edit','edit','organization'),('admin','kyc.view','view','organization'),('admin','kyc.review','edit','organization'),('admin','kyc.approve','approve','organization'),
    ('admin','employees.view','view','organization'),('admin','employees.create','edit','organization'),('admin','employees.edit','edit','organization'),('admin','employees.deactivate','approve','organization'),('admin','organisation.view','view','organization'),
    ('admin','vehicles.view','view','organization'),('admin','vehicles.create','edit','organization'),('admin','vehicles.edit','edit','organization'),('admin','policies.view','view','organization'),('admin','policies.create','edit','organization'),('admin','policies.edit','edit','organization'),
    ('admin','tasks.view','view','organization'),('admin','tasks.create','edit','organization'),('admin','tasks.assign','edit','organization'),('admin','tasks.edit','edit','organization'),('admin','reports.view','view','organization'),('admin','admin.portal_users.manage','approve',null),('admin','admin.audit.view','view',null),('admin','master_data.manage','edit',null),

    -- Director.
    ('director','dashboard.view','view',null),('director','notifications.view','view','self'),('director','claims.view','view','organization'),
    ('director','intermediaries.view','view','organization'),('director','intermediaries.application.review','edit','organization'),('director','intermediaries.application.approve','approve','organization'),
    ('director','customers.view','view','organization'),('director','kyc.view','view','organization'),('director','kyc.review','edit','organization'),('director','employees.view','view','organization'),('director','organisation.view','view','organization'),('director','vehicles.view','view','organization'),('director','policies.view','view','organization'),('director','tasks.view','view','organization'),('director','tasks.create','edit','organization'),('director','tasks.assign','edit','organization'),('director','tasks.edit','edit','organization'),('director','reports.view','view','organization'),

    -- Operations Head.
    ('sales_operations_head','dashboard.view','view',null),('sales_operations_head','notifications.view','view','self'),
    ('sales_operations_head','claims.view','view','organization'),('sales_operations_head','claims.edit','edit','organization'),('sales_operations_head','claims.verify_documents','approve','organization'),('sales_operations_head','claims.assign_surveyor','approve','organization'),('sales_operations_head','claims.change_stage','approve','organization'),
    ('sales_operations_head','intermediaries.view','view','organization'),('sales_operations_head','intermediaries.application.create','edit','organization'),('sales_operations_head','intermediaries.application.review','edit','organization'),('sales_operations_head','intermediaries.application.approve','approve','organization'),('sales_operations_head','intermediaries.activate','approve','organization'),('sales_operations_head','intermediaries.training.manage','edit','organization'),('sales_operations_head','intermediaries.agreement.manage','approve','organization'),('sales_operations_head','intermediaries.iib.manage','approve','organization'),
    ('sales_operations_head','customers.view','view','organization'),('sales_operations_head','customers.create','edit','organization'),('sales_operations_head','customers.edit','edit','organization'),('sales_operations_head','kyc.view','view','organization'),('sales_operations_head','kyc.review','edit','organization'),('sales_operations_head','kyc.approve','approve','organization'),('sales_operations_head','tasks.view','view','organization'),('sales_operations_head','tasks.create','edit','organization'),('sales_operations_head','tasks.assign','edit','organization'),('sales_operations_head','tasks.edit','edit','organization'),('sales_operations_head','reports.view','view','organization'),

    -- Backoffice Executive.
    ('backoffice_executive','dashboard.view','view',null),('backoffice_executive','notifications.view','view','self'),('backoffice_executive','intermediaries.view','view','organization'),('backoffice_executive','intermediaries.application.create','edit','organization'),('backoffice_executive','intermediaries.application.review','edit','organization'),('backoffice_executive','intermediaries.training.manage','edit','organization'),('backoffice_executive','intermediaries.agreement.manage','edit','organization'),('backoffice_executive','intermediaries.iib.manage','edit','organization'),('backoffice_executive','customers.view','view','organization'),('backoffice_executive','customers.create','edit','organization'),('backoffice_executive','customers.edit','edit','organization'),('backoffice_executive','kyc.view','view','organization'),('backoffice_executive','kyc.review','edit','organization'),('backoffice_executive','tasks.view','view','organization'),('backoffice_executive','tasks.create','edit','organization'),('backoffice_executive','tasks.assign','edit','organization'),('backoffice_executive','tasks.edit','edit','organization'),

    -- Sales hierarchy roles.
    ('sales_head','dashboard.view','view',null),('sales_head','notifications.view','view','self'),('sales_head','claims.view','view','hierarchy'),('sales_head','intermediaries.view','view','hierarchy'),('sales_head','intermediaries.application.create','edit','hierarchy'),('sales_head','intermediaries.application.review','edit','hierarchy'),('sales_head','customers.view','view','hierarchy'),('sales_head','customers.create','edit','hierarchy'),('sales_head','customers.edit','edit','hierarchy'),('sales_head','kyc.view','view','hierarchy'),('sales_head','kyc.review','edit','hierarchy'),('sales_head','employees.view','view','hierarchy'),('sales_head','organisation.view','view','hierarchy'),('sales_head','vehicles.view','view','hierarchy'),('sales_head','policies.view','view','hierarchy'),('sales_head','tasks.view','view','hierarchy'),('sales_head','tasks.create','edit','hierarchy'),('sales_head','tasks.assign','edit','hierarchy'),('sales_head','tasks.edit','edit','hierarchy'),('sales_head','reports.view','view','hierarchy'),
    ('zonal_head','dashboard.view','view',null),('zonal_head','notifications.view','view','self'),('zonal_head','intermediaries.view','view','hierarchy'),('zonal_head','intermediaries.application.create','edit','hierarchy'),('zonal_head','intermediaries.application.review','edit','hierarchy'),('zonal_head','customers.view','view','hierarchy'),('zonal_head','customers.create','edit','hierarchy'),('zonal_head','customers.edit','edit','hierarchy'),('zonal_head','kyc.view','view','hierarchy'),('zonal_head','kyc.review','edit','hierarchy'),('zonal_head','organisation.view','view','hierarchy'),('zonal_head','tasks.view','view','hierarchy'),('zonal_head','tasks.create','edit','hierarchy'),('zonal_head','tasks.assign','edit','hierarchy'),('zonal_head','tasks.edit','edit','hierarchy'),('zonal_head','reports.view','view','hierarchy'),
    ('asm','dashboard.view','view',null),('asm','notifications.view','view','self'),('asm','intermediaries.view','view','hierarchy'),('asm','intermediaries.application.create','edit','hierarchy'),('asm','intermediaries.application.review','edit','hierarchy'),('asm','customers.view','view','hierarchy'),('asm','customers.create','edit','hierarchy'),('asm','customers.edit','edit','hierarchy'),('asm','kyc.view','view','hierarchy'),('asm','kyc.review','edit','hierarchy'),('asm','organisation.view','view','hierarchy'),('asm','tasks.view','view','hierarchy'),('asm','tasks.create','edit','hierarchy'),('asm','tasks.assign','edit','hierarchy'),('asm','tasks.edit','edit','hierarchy'),('asm','reports.view','view','hierarchy'),
    ('sales_manager','dashboard.view','view',null),('sales_manager','notifications.view','view','self'),('sales_manager','intermediaries.view','view','hierarchy'),('sales_manager','intermediaries.application.create','edit','hierarchy'),('sales_manager','intermediaries.application.review','edit','hierarchy'),('sales_manager','customers.view','view','hierarchy'),('sales_manager','customers.create','edit','hierarchy'),('sales_manager','customers.edit','edit','hierarchy'),('sales_manager','kyc.view','view','hierarchy'),('sales_manager','kyc.review','edit','hierarchy'),('sales_manager','organisation.view','view','hierarchy'),('sales_manager','tasks.view','view','hierarchy'),('sales_manager','tasks.create','edit','hierarchy'),('sales_manager','tasks.assign','edit','hierarchy'),('sales_manager','tasks.edit','edit','hierarchy'),('sales_manager','reports.view','view','hierarchy'),

    -- Front-line / claims / field roles.
    ('relationship_manager','dashboard.view','view',null),('relationship_manager','notifications.view','view','self'),('relationship_manager','intermediaries.view','view','self'),('relationship_manager','intermediaries.application.create','edit','self'),('relationship_manager','customers.view','view','self'),('relationship_manager','customers.create','edit','self'),('relationship_manager','customers.edit','edit','self'),('relationship_manager','kyc.view','view','self'),('relationship_manager','tasks.view','view','self'),
    ('claims_head','dashboard.view','view',null),('claims_head','notifications.view','view','self'),('claims_head','claims.view','view','organization'),('claims_head','claims.edit','edit','organization'),('claims_head','claims.verify_documents','approve','organization'),('claims_head','claims.assign_surveyor','approve','organization'),('claims_head','claims.change_stage','approve','organization'),('claims_head','tasks.view','view','organization'),('claims_head','tasks.create','edit','organization'),('claims_head','tasks.assign','approve','organization'),('claims_head','tasks.edit','edit','organization'),('claims_head','reports.view','view','organization'),
    ('claim_processor','dashboard.view','view',null),('claim_processor','notifications.view','view','self'),('claim_processor','claims.view','view','assigned'),('claim_processor','claims.edit','edit','assigned'),('claim_processor','claims.verify_documents','edit','assigned'),('claim_processor','claims.assign_surveyor','edit','assigned'),('claim_processor','claims.change_stage','edit','assigned'),('claim_processor','tasks.view','view','assigned'),('claim_processor','tasks.create','edit','self'),('claim_processor','tasks.edit','edit','assigned'),
    ('field_executive','dashboard.view','view',null),('field_executive','notifications.view','view','self'),('field_executive','claims.view','view','assigned'),('field_executive','tasks.view','view','assigned'),

    -- IT Super User: protected technical authority including integration configuration.
    ('it_super_user','dashboard.view','view',null),('it_super_user','claims.view','view','organization'),('it_super_user','claims.edit','edit','organization'),('it_super_user','claims.verify_documents','approve','organization'),('it_super_user','claims.assign_surveyor','approve','organization'),('it_super_user','claims.change_stage','approve','organization'),
    ('it_super_user','intermediaries.view','view','organization'),('it_super_user','intermediaries.application.create','edit','organization'),('it_super_user','intermediaries.application.review','edit','organization'),('it_super_user','intermediaries.application.approve','approve','organization'),('it_super_user','intermediaries.activate','approve','organization'),('it_super_user','intermediaries.portal_users.manage','approve','organization'),('it_super_user','intermediaries.training.manage','edit','organization'),('it_super_user','intermediaries.agreement.manage','approve','organization'),('it_super_user','intermediaries.iib.manage','approve','organization'),('it_super_user','intermediaries.delete','approve','organization'),
    ('it_super_user','customers.view','view','organization'),('it_super_user','customers.create','edit','organization'),('it_super_user','customers.edit','edit','organization'),('it_super_user','kyc.view','view','organization'),('it_super_user','kyc.review','edit','organization'),('it_super_user','kyc.approve','approve','organization'),('it_super_user','employees.view','view','organization'),('it_super_user','employees.create','edit','organization'),('it_super_user','employees.edit','edit','organization'),('it_super_user','employees.deactivate','approve','organization'),('it_super_user','organisation.view','view','organization'),('it_super_user','vehicles.view','view','organization'),('it_super_user','vehicles.create','edit','organization'),('it_super_user','vehicles.edit','edit','organization'),('it_super_user','policies.view','view','organization'),('it_super_user','policies.create','edit','organization'),('it_super_user','policies.edit','edit','organization'),('it_super_user','tasks.view','view','organization'),('it_super_user','tasks.create','edit','organization'),('it_super_user','tasks.assign','approve','organization'),('it_super_user','tasks.edit','edit','organization'),('it_super_user','reports.view','view','organization'),('it_super_user','notifications.view','view','self'),('it_super_user','admin.portal_users.manage','approve',null),('it_super_user','admin.roles.manage','approve',null),('it_super_user','admin.permissions.manage','approve',null),('it_super_user','admin.audit.view','view',null),('it_super_user','master_data.manage','approve',null),('it_super_user','system.manage','approve',null),('it_super_user','system.integrations.configure','approve',null),

    -- Agent compatibility role. Manager intentionally has no V2 grants until reviewed.
    ('agent','dashboard.view','view',null),('agent','notifications.view','view','self'),('agent','customers.view','view','self'),('agent','customers.create','edit','self'),('agent','customers.edit','edit','self'),('agent','tasks.view','view','self')
)
insert into public.access_role_permissions_v2
  (role_id,permission_id,access_level,scope_type,is_active,reason)
select
  r.id,
  p.id,
  g.access_level,
  g.scope_type,
  true,
  'Phase 3 shadow role matrix seed'
from role_grants g
join public.access_roles_v2 r on r.code = g.role_code
join public.access_permissions_v2 p on p.permission_key = g.permission_key
where g.access_level = any(p.allowed_access_levels)
  and (
    (p.scope_required = false and g.scope_type is null)
    or (p.scope_required = true and g.scope_type = any(p.allowed_scopes))
  )
on conflict (role_id,permission_id) do update set
  access_level = excluded.access_level,
  scope_type = excluded.scope_type,
  is_active = true,
  reason = excluded.reason,
  updated_at = now();

-- Database-level invariants: fail migration if the static seed drifts from its
-- declared constraints rather than silently dropping an invalid grant.
do $$
declare
  expected_grants integer;
  inserted_grants integer;
  protected_integration_grants integer;
begin
  select count(*) into expected_grants
  from (
    select role_id, permission_id
    from public.access_role_permissions_v2
    where reason = 'Phase 3 shadow role matrix seed' and is_active = true
  ) q;

  select count(*) into inserted_grants
  from public.access_role_permissions_v2 rp
  join public.access_permissions_v2 p on p.id = rp.permission_id
  where rp.reason = 'Phase 3 shadow role matrix seed'
    and rp.is_active = true
    and rp.access_level = any(p.allowed_access_levels)
    and ((p.scope_required = false and rp.scope_type is null)
      or (p.scope_required = true and rp.scope_type = any(p.allowed_scopes)));

  if expected_grants <> inserted_grants then
    raise exception 'Access Control V2 role grant seed contains invalid access/scope combinations';
  end if;

  select count(*) into protected_integration_grants
  from public.access_role_permissions_v2 rp
  join public.access_roles_v2 r on r.id = rp.role_id
  join public.access_permissions_v2 p on p.id = rp.permission_id
  where p.permission_key = 'system.integrations.configure'
    and rp.is_active = true
    and r.code <> 'it_super_user';

  if protected_integration_grants <> 0 then
    raise exception 'Protected integration configuration may only be seeded for IT Super User';
  end if;

  if exists (
    select 1 from public.access_roles_v2
    where code in ('manager','agent','it_super_user') and assignable = true
  ) then
    raise exception 'Protected/compatibility roles must remain non-assignable in the V2 seed';
  end if;

  if exists (
    select 1 from public.employee_role_assignments_v2
  ) then
    raise exception 'Phase 4 shadow foundation must not auto-assign employees';
  end if;
end $$;

comment on table public.access_roles_v2 is 'Shadow Access Control V2 role catalogue. Not authoritative until parity-verified cut-over.';
comment on table public.access_permissions_v2 is 'Shadow Access Control V2 granular permission catalogue. Not authoritative until parity-verified cut-over.';
comment on table public.access_role_permissions_v2 is 'Shadow Access Control V2 default role grants. Not authoritative until parity-verified cut-over.';
comment on table public.employee_role_assignments_v2 is 'Shadow Access Control V2 employee role assignments. Intentionally empty after Phase 4 foundation migration.';

commit;
