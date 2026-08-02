-- INSUREIT Partner activation runtime diagnostic
-- READ ONLY: every statement in this file is a SELECT.
-- Current reported application: 8d04c610-4bec-4ce8-9aa4-f5e2388d626b
-- Replace the UUID in the target CTE when diagnosing another Partner.

-- 1. Required activation functions. A null value means the migration/function
-- is not present in the target Supabase database.
select
  to_regprocedure('public.finalize_partner_activation_v2(uuid,uuid)') as finalize_partner_activation_v2,
  to_regprocedure('public.issue_partner_identity(uuid,uuid)') as issue_partner_identity,
  to_regprocedure('public.issue_legacy_partner_identity(uuid,uuid,text)') as issue_legacy_partner_identity,
  to_regprocedure('public.sync_partner_intermediary(uuid)') as sync_partner_intermediary,
  to_regprocedure('public.ensure_legacy_partner_record(uuid,uuid)') as ensure_legacy_partner_record;

-- 2. Service-role execute permission for the atomic activation RPC.
select
  case
    when to_regprocedure('public.finalize_partner_activation_v2(uuid,uuid)') is null then false
    else has_function_privilege(
      'service_role',
      to_regprocedure('public.finalize_partner_activation_v2(uuid,uuid)'),
      'EXECUTE'
    )
  end as service_role_can_execute_activation;

-- 3. Current application/profile state used by the activation guard.
with target(application_id) as (
  values ('8d04c610-4bec-4ce8-9aa4-f5e2388d626b'::uuid)
)
select
  a.id as application_id,
  a.source as application_source,
  a.status as application_status,
  a.registration_status,
  a.partner_status as application_partner_status,
  a.final_type,
  a.partner_record_id as application_partner_record_id,
  coalesce(nullif(a.draft_data->>'account_context', ''), nullif(p.raw_data->>'account_context', ''), 'partner') as account_context,
  a.draft_data->>'onboarding_mode' as draft_onboarding_mode,
  a.draft_data->>'record_source' as draft_record_source,
  a.draft_data->>'legacy_partner_code' as draft_legacy_partner_code,
  p.record_source as profile_record_source,
  p.workflow_stage,
  p.partner_status as profile_partner_status,
  p.partner_id,
  p.partner_record_id as profile_partner_record_id,
  p.gst_number,
  a.updated_at
from target t
left join public.intermediary_onboarding_applications a on a.id = t.application_id
left join public.posp_misp_onboarding_profiles p on p.application_id = a.id;

-- 4. Required documents for this Partner. GST is required only when gst_number
-- is present. The current web activation route requires Aadhaar front/back,
-- PAN copy and cancelled cheque.
with target(application_id) as (
  values ('8d04c610-4bec-4ce8-9aa4-f5e2388d626b'::uuid)
), required(document_type) as (
  values ('aadhaar_front'), ('aadhaar_back'), ('pan_copy'), ('cancelled_cheque')
), profile as (
  select p.gst_number
  from target t
  join public.posp_misp_onboarding_profiles p on p.application_id = t.application_id
), expected as (
  select document_type from required
  union all
  select 'gst_copy' from profile where nullif(trim(gst_number), '') is not null
)
select
  e.document_type,
  exists (
    select 1
    from target t
    join public.intermediary_onboarding_documents d on d.application_id = t.application_id
    where d.document_type = e.document_type
  ) as present
from expected e
order by e.document_type;

-- 5. Check constraints that can reject final application/profile/register
-- values. Review the definitions instead of guessing enum values.
select
  c.conrelid::regclass as table_name,
  c.conname as constraint_name,
  pg_get_constraintdef(c.oid) as constraint_definition
from pg_constraint c
where c.contype = 'c'
  and c.conrelid in (
    'public.intermediary_onboarding_applications'::regclass,
    'public.posp_misp_onboarding_profiles'::regclass,
    'public.intermediaries'::regclass,
    'public.partners'::regclass
  )
  and (
    c.conname ilike '%status%'
    or c.conname ilike '%type%'
    or c.conname ilike '%source%'
  )
order by table_name::text, constraint_name;

-- 6. Existing Partner identities/links for the target. Duplicate or mismatched
-- codes will cause the atomic operation to roll back.
with target(application_id) as (
  values ('8d04c610-4bec-4ce8-9aa4-f5e2388d626b'::uuid)
), state as (
  select
    a.id,
    coalesce(a.partner_record_id, p.partner_record_id) as partner_record_id,
    nullif(upper(trim(p.partner_id)), '') as profile_partner_id
  from target t
  join public.intermediary_onboarding_applications a on a.id = t.application_id
  join public.posp_misp_onboarding_profiles p on p.application_id = a.id
)
select
  s.id as application_id,
  s.profile_partner_id,
  s.partner_record_id,
  partner.id as canonical_partner_id,
  partner.partner_code as canonical_partner_code,
  partner.source_application_id,
  intermediary.id as intermediary_id,
  intermediary.intermediary_code,
  intermediary.intermediary_type,
  intermediary.account_status
from state s
left join public.partners partner
  on partner.id = s.partner_record_id
  or partner.source_application_id = s.id
  or (s.profile_partner_id is not null and upper(trim(partner.partner_code)) = s.profile_partner_id)
left join public.intermediaries intermediary
  on intermediary.application_id = s.id
 and intermediary.intermediary_type = 'partner';
