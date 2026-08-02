-- INSUREIT PR-02 / PR-04 staging preflight
-- READ ONLY: this file contains SELECT statements only.
-- Run against the target Supabase project before applying
-- 20260802172500_finalize_partner_activation_atomically.sql.

-- 1. Applications with no usable employee/profile assignment.
-- These should remain available only to approved organization-wide roles
-- until an assignment is corrected.
select
  a.id as application_id,
  a.source,
  a.requested_type,
  a.final_type,
  a.status,
  a.registration_status,
  a.partner_status,
  p.associate_profile_id,
  p.associate_employee_id,
  p.associate_name,
  p.workflow_stage,
  a.created_at,
  a.updated_at
from public.intermediary_onboarding_applications a
join public.posp_misp_onboarding_profiles p on p.application_id = a.id
where p.associate_profile_id is null
  and p.associate_employee_id is null
order by a.created_at desc;

-- 2. Assignment links that disagree with the profile-to-employee relationship.
select
  a.id as application_id,
  p.associate_profile_id,
  p.associate_employee_id as stored_employee_id,
  assigned_profile.employee_id as profile_employee_id,
  p.associate_name,
  a.status,
  a.registration_status,
  p.workflow_stage
from public.intermediary_onboarding_applications a
join public.posp_misp_onboarding_profiles p on p.application_id = a.id
left join public.profiles assigned_profile on assigned_profile.id = p.associate_profile_id
where p.associate_profile_id is not null
  and (
    assigned_profile.id is null
    or p.associate_employee_id is null
    or assigned_profile.employee_id is distinct from p.associate_employee_id
  )
order by a.updated_at desc;

-- 3. Applications assigned to inactive or missing profiles/employees.
select
  a.id as application_id,
  p.associate_profile_id,
  assigned_profile.is_active as profile_is_active,
  p.associate_employee_id,
  assigned_employee.employment_status,
  p.associate_name,
  a.status,
  a.registration_status
from public.intermediary_onboarding_applications a
join public.posp_misp_onboarding_profiles p on p.application_id = a.id
left join public.profiles assigned_profile on assigned_profile.id = p.associate_profile_id
left join public.employees assigned_employee on assigned_employee.id = p.associate_employee_id
where (p.associate_profile_id is not null and coalesce(assigned_profile.is_active, false) = false)
   or (p.associate_employee_id is not null and coalesce(assigned_employee.employment_status, '') <> 'active')
order by a.updated_at desc;

-- 4. Parent Partner applications and the onboarding mode detected from
-- explicit source markers. Child POSP/MISP applications are intentionally
-- excluded from Partner activation.
select
  a.id as application_id,
  coalesce(nullif(a.draft_data->>'account_context', ''), nullif(p.raw_data->>'account_context', ''), 'partner') as account_context,
  case
    when a.draft_data->>'onboarding_mode' = 'legacy_existing_partner'
      or p.raw_data->>'onboarding_mode' = 'legacy_existing_partner'
      or a.draft_data->>'record_source' in ('legacy_manual', 'legacy_manual_pending_activation')
      or p.raw_data->>'record_source' in ('legacy_manual', 'legacy_manual_pending_activation')
      or a.source = 'legacy_manual'
      or p.record_source in ('legacy_manual', 'legacy_manual_pending_activation')
    then 'existing'
    else 'new'
  end as onboarding_mode,
  p.partner_id,
  a.partner_record_id as application_partner_record_id,
  p.partner_record_id as profile_partner_record_id,
  a.partner_status as application_partner_status,
  p.partner_status as profile_partner_status,
  p.workflow_stage,
  a.status,
  a.registration_status
from public.intermediary_onboarding_applications a
join public.posp_misp_onboarding_profiles p on p.application_id = a.id
where coalesce(nullif(a.draft_data->>'account_context', ''), nullif(p.raw_data->>'account_context', ''), 'partner') = 'partner'
order by a.updated_at desc;

-- 5. Partial or contradictory Partner activation states.
select
  a.id as application_id,
  p.partner_id,
  a.partner_status as application_partner_status,
  p.partner_status as profile_partner_status,
  a.status as application_status,
  a.registration_status,
  p.workflow_stage,
  a.partner_record_id as application_partner_record_id,
  p.partner_record_id as profile_partner_record_id
from public.intermediary_onboarding_applications a
join public.posp_misp_onboarding_profiles p on p.application_id = a.id
where coalesce(a.partner_status, '') <> coalesce(p.partner_status, '')
   or (a.partner_status = 'active_partner' and a.status <> 'approved')
   or (a.partner_status = 'active_partner' and a.registration_status <> 'partner_active')
   or (a.partner_status = 'active_partner' and p.workflow_stage <> 'completed')
   or (p.partner_id is not null and p.partner_id !~ '^PENDING-' and a.partner_status <> 'active_partner')
order by a.updated_at desc;

-- 6. Active Partner applications missing the intermediary register row.
select
  a.id as application_id,
  p.partner_id,
  a.partner_status,
  a.registration_status,
  p.workflow_stage
from public.intermediary_onboarding_applications a
join public.posp_misp_onboarding_profiles p on p.application_id = a.id
left join public.intermediaries i
  on i.application_id = a.id
 and i.intermediary_type = 'partner'
where a.partner_status = 'active_partner'
  and i.id is null
order by a.updated_at desc;

-- 7. Active Partner applications missing the canonical partners row/link.
select
  a.id as application_id,
  p.partner_id,
  a.partner_record_id as application_partner_record_id,
  p.partner_record_id as profile_partner_record_id,
  a.source,
  p.record_source
from public.intermediary_onboarding_applications a
join public.posp_misp_onboarding_profiles p on p.application_id = a.id
left join public.partners partner
  on partner.id = coalesce(a.partner_record_id, p.partner_record_id)
  or partner.source_application_id = a.id
where a.partner_status = 'active_partner'
  and partner.id is null
order by a.updated_at desc;

-- 8. Partner-code disagreements across profile, intermediary register and
-- canonical Partner record.
select
  a.id as application_id,
  upper(trim(p.partner_id)) as profile_partner_id,
  upper(trim(i.intermediary_code)) as intermediary_partner_id,
  upper(trim(partner.partner_code)) as canonical_partner_id,
  a.partner_record_id as application_partner_record_id,
  p.partner_record_id as profile_partner_record_id
from public.intermediary_onboarding_applications a
join public.posp_misp_onboarding_profiles p on p.application_id = a.id
left join public.intermediaries i
  on i.application_id = a.id
 and i.intermediary_type = 'partner'
left join public.partners partner
  on partner.id = coalesce(a.partner_record_id, p.partner_record_id)
  or partner.source_application_id = a.id
where p.partner_id is not null
  and p.partner_id !~ '^PENDING-'
  and (
    i.intermediary_code is null
    or partner.partner_code is null
    or upper(trim(i.intermediary_code)) is distinct from upper(trim(p.partner_id))
    or upper(trim(partner.partner_code)) is distinct from upper(trim(p.partner_id))
  )
order by a.updated_at desc;

-- 9. Duplicate permanent Partner identities across onboarding profiles.
select
  upper(trim(partner_id)) as partner_id,
  count(*) as profile_count,
  array_agg(application_id order by application_id) as application_ids
from public.posp_misp_onboarding_profiles
where partner_id is not null
  and partner_id !~ '^PENDING-'
group by upper(trim(partner_id))
having count(*) > 1
order by profile_count desc, partner_id;

-- 10. Parent Partner applications with linked child applications. This verifies
-- that POSP/MISP remains a separate application under the same canonical Partner.
select
  parent.id as parent_application_id,
  parent_profile.partner_id,
  parent.partner_record_id,
  child.id as child_application_id,
  child.requested_type as child_type,
  child.registration_record_id,
  child.registration_status,
  child.status as child_status,
  child_profile.external_onboarding_id as child_registration_code,
  child_profile.workflow_stage as child_workflow_stage
from public.intermediary_onboarding_applications parent
join public.posp_misp_onboarding_profiles parent_profile on parent_profile.application_id = parent.id
left join public.intermediary_onboarding_applications child
  on child.partner_record_id = parent.partner_record_id
 and child.id <> parent.id
left join public.posp_misp_onboarding_profiles child_profile on child_profile.application_id = child.id
where coalesce(nullif(parent.draft_data->>'account_context', ''), nullif(parent_profile.raw_data->>'account_context', ''), 'partner') = 'partner'
order by parent.updated_at desc, child.created_at;
