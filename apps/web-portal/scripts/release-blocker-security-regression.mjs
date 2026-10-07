import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifyPolicyIntakeDeleteLinks } from "../lib/policy-delete-guard.ts";

function source(path) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function requireText(name, content, expected) {
  if (!content.includes(expected)) {
    throw new Error(`[release-blocker-security] ${name} is missing: ${expected}`);
  }
}

function rejectText(name, content, prohibited) {
  if (content.includes(prohibited)) {
    throw new Error(`[release-blocker-security] ${name} still contains prohibited text: ${prohibited}`);
  }
}

const accountReview = source("app/intermediaries/applications/[id]/page.tsx");
const workflowReview = source("app/intermediaries/applications/[id]/workflow/page.tsx");
const applicationLayout = source("app/intermediaries/applications/[id]/layout.tsx");
const documentOpen = source("app/intermediaries/applications/documents/[id]/open/route.ts");
const documentUpload = source("app/api/intermediary-documents/upload/route.ts");
const partnerFinalize = source("app/api/intermediary-documents/finalize/route.ts");
const customersPage = source("app/customers/page.tsx");
const claimsActions = source("app/actions.ts");
const masterRecordDelete = source("app/master-record-delete-actions.ts");
const policyIntakesPage = source("app/policy-intakes/page.tsx");
const itSuperUserDeletePanel = source("components/it-super-user-delete-panel.tsx");
const policyPairDelete = source("app/policy-pair-delete-actions.ts");
const policyPairDeleteMigration = source("../../supabase/migrations/20260908152200_delete_completed_policy_intake_pair.sql");
const auditedBoundaryMigration = source("../../supabase/migrations/20261007130000_internal_security_boundary_hardening.sql");
const functionSurfaceMigration = source("../../supabase/migrations/20261007131000_security_function_surface_hardening.sql");
const anonDefinerMigration = source("../../supabase/migrations/20261007132000_revoke_anon_security_definer_execution.sql");
const authenticatedDefinerMigration = source("../../supabase/migrations/20261007133000_authenticated_definer_authorization_hardening.sql");
const internalPrimitiveMigration = source("../../supabase/migrations/20261007134000_internal_rpc_primitive_hardening.sql");
const associatedOnboardingMigration = source("../../supabase/migrations/20261007135000_associated_onboarding_authorization_hardening.sql");
const denyAllTableMigration = source("../../supabase/migrations/20261007136000_deny_all_table_privilege_hardening.sql");
const pgTrgmMigration = source("../../supabase/migrations/20261007137000_move_pg_trgm_to_extensions.sql");

for (const [name, content] of [
  ["account review page", accountReview],
  ["workflow review page", workflowReview],
  ["application review layout", applicationLayout],
]) {
  requireText(name, content, "requireScopedPospMispManager(id)");
  rejectText(name, content, "await requirePospMispManager()");
}

requireText("document open route", documentOpen, ".select(\"id,application_id,storage_bucket,storage_path\")");
requireText("document open route", documentOpen, "requireApplicationReviewer(document.application_id)");
requireText("document upload route", documentUpload, "getScopedPospMispManager(applicationId)");
requireText("Partner activation route", partnerFinalize, "getScopedPospMispManager(applicationId)");
requireText("Partner activation route", partnerFinalize, "finalize_partner_activation_v2");

requireText("customer register", customersPage, "getAccessibleCustomerIds(profile.id, profile.role)");
requireText("customer register", customersPage, "request = request.in(\"id\", accessibleIds)");

requireText("legacy claim status wrapper", claimsActions, "await advanceClaimWorkflow(id, canonicalForm)");

requireText("workflow review page", workflowReview, "const { aadhaar_number_encrypted, dp_aadhaar_number_encrypted, ...safeProfile } = profile");
requireText("workflow review page", workflowReview, "aadhaar_exists: Boolean(aadhaarEncrypted)");
rejectText("workflow review page", workflowReview, "aadhaar_number: decryptSensitiveValue");

requireText("IT Super User master deletion", masterRecordDelete, "profile.role !== \"it_super_user\"");
requireText("policy deletion guard", masterRecordDelete, "classifyPolicyIntakeDeleteLinks(linkedIntakes ?? [])");
requireText("policy deletion guard", masterRecordDelete, "dependency.table === \"policy_intake_requests\"");
requireText("rejected intake unlink", masterRecordDelete, ".update({ final_policy_id: null })");
requireText("rejected intake unlink", masterRecordDelete, ".eq(\"status\", \"rejected\")");
requireText("rejected intake rollback", masterRecordDelete, "restoreRejectedPolicyIntakeLinks");
requireText("claim dependency remains protected", masterRecordDelete, "{ table: \"claims\", column: \"policy_id\", label: \"claim\" }");
requireText("reconciliation dependency remains protected", masterRecordDelete, "{ table: \"reconciliation_lines\", column: \"policy_id\", label: \"reconciliation record\" }");
requireText("invoice dependency remains protected", masterRecordDelete, "{ table: \"accounts_invoice_lines\", column: \"policy_id\", label: \"invoice line\" }");
requireText("partner payable dependency remains protected", masterRecordDelete, "{ table: \"partner_payables\", column: \"policy_id\", label: \"partner payable\" }");

requireText("Policy Intake delete page role guard", policyIntakesPage, 'profile.role === "it_super_user"');
requireText("Policy Intake delete page panel", policyIntakesPage, 'entity="policy_intake"');
requireText("Policy Intake delete page title", policyIntakesPage, 'title="Delete policy intake record"');
requireText("Policy Intake delete entity label", itSuperUserDeletePanel, 'policy_intake: "policy intake"');
requireText("Policy Intake delete config", masterRecordDelete, 'table: "policy_intake_requests"');
requireText("Policy Intake final policy guard", masterRecordDelete, 'if (entity === "policy_intake" && linkedFinalPolicyId)');
requireText("Policy Intake official document guard", masterRecordDelete, '{ table: "policy_documents", column: "source_intake_id", label: "official policy document" }');
requireText("Policy Intake document cleanup", masterRecordDelete, '.from("policy_intake_documents")');
requireText("Policy Intake concurrent final-policy guard", masterRecordDelete, '.is("final_policy_id", null)');
requireText("Policy Intake audit marker", masterRecordDelete, 'cascaded_policy_intake_records: true');

requireText("completed Policy + Intake cleanup role guard", policyPairDelete, 'profile.role !== "it_super_user"');
requireText("completed Policy + Intake lookup", policyPairDelete, '.eq("status", "completed")');
requireText("completed Policy + Intake storage collection", policyPairDelete, '.from("policy_intake_documents")');
requireText("completed Policy document storage collection", policyPairDelete, '.from("policy_documents")');
requireText("completed Policy + Intake atomic RPC", policyPairDelete, 'admin.rpc("delete_policy_with_completed_intake_pair"');
requireText("completed Policy + Intake storage cleanup audit", policyPairDelete, 'delete_policy_with_completed_intake_storage_cleanup_incomplete');
requireText("completed Policy + Intake external renewal error", policyPairDelete, 'external renewal opportunity');
requireText("completed Policy + Intake UI action", itSuperUserDeletePanel, 'Delete Policy + Intake');
requireText("completed Policy + Intake stronger confirmation", itSuperUserDeletePanel, 'DELETE BOTH');
requireText("completed Policy + Intake cleanup only offered after intake blocker", itSuperUserDeletePanel, 'entity === "policy" && /policy intake/i.test(result.error)');

requireText("completed Policy + Intake migration security definer", policyPairDeleteMigration, "security definer");
requireText("completed Policy + Intake actor role guard", policyPairDeleteMigration, "role::text = 'it_super_user'");
requireText("completed Policy + Intake policy row lock", policyPairDeleteMigration, "from public.policies\n  where id = p_policy_id\n  for update");
requireText("completed Policy + Intake intake row lock", policyPairDeleteMigration, "from public.policy_intake_requests\n  where id = p_intake_id\n  for update");
requireText("completed Policy + Intake completed-state guard", policyPairDeleteMigration, "<> 'completed'");
requireText("completed Policy + Intake claim blocker", policyPairDeleteMigration, "from public.claims where policy_id = p_policy_id");
requireText("completed Policy + Intake reconciliation blocker", policyPairDeleteMigration, "from public.reconciliation_lines where policy_id = p_policy_id");
requireText("completed Policy + Intake invoice blocker", policyPairDeleteMigration, "from public.accounts_invoice_lines where policy_id = p_policy_id");
requireText("completed Policy + Intake payable blocker", policyPairDeleteMigration, "from public.partner_payables where policy_id = p_policy_id");
requireText("completed Policy + Intake replacement audit blocker", policyPairDeleteMigration, "from public.policy_replacement_audit");
requireText("completed Policy + Intake other active intake blocker", policyPairDeleteMigration, "another non-rejected policy intake");
requireText("completed Policy + Intake external renewal blocker", policyPairDeleteMigration, "from public.external_renewal_policy_intake_links");
requireText("completed Policy + Intake external renewal message", policyPairDeleteMigration, "linked to an external renewal opportunity");
requireText("completed Policy + Intake rejected links preserved", policyPairDeleteMigration, "set final_policy_id = null");
requireText("completed Policy + Intake intake deletion", policyPairDeleteMigration, "delete from public.policy_intake_requests");
requireText("completed Policy + Intake policy deletion", policyPairDeleteMigration, "delete from public.policies");
requireText("completed Policy + Intake audit trail", policyPairDeleteMigration, "delete_policy_with_completed_intake");
requireText("completed Policy + Intake RPC browser revoke", policyPairDeleteMigration, "revoke all on function public.delete_policy_with_completed_intake_pair(uuid, uuid, uuid) from authenticated");
requireText("completed Policy + Intake RPC service-role grant", policyPairDeleteMigration, "grant execute on function public.delete_policy_with_completed_intake_pair(uuid, uuid, uuid) to service_role");

requireText("audited role resolution fails closed", auditedBoundaryMigration, "else (");
rejectText("audited role resolution", auditedBoundaryMigration, "'customer'::public.app_role");
requireText("audited generic delete policy authenticated-only", auditedBoundaryMigration, "alter policy %I on %I.%I to authenticated");
requireText("audited generic delete policy IT Super User only", auditedBoundaryMigration, "(select public.current_app_role()) = ''it_super_user''::public.app_role");
requireText("audited cleanup view security invoker", auditedBoundaryMigration, "alter view public.intermediary_customer_cleanup_candidates set (security_invoker = true)");
requireText("audited cutover view security invoker", auditedBoundaryMigration, "alter view public.intermediary_onboarding_cutover_audit set (security_invoker = true)");
requireText("audited cleanup view browser revoke", auditedBoundaryMigration, "revoke all on table public.intermediary_customer_cleanup_candidates from public, anon, authenticated");
requireText("audited cutover view browser revoke", auditedBoundaryMigration, "revoke all on table public.intermediary_onboarding_cutover_audit from public, anon, authenticated");
for (const signature of [
  "public.finalize_policy_intake_motor_v1(uuid, jsonb, integer)",
  "public.get_policy_business_report_v4(uuid[], date, date, uuid, uuid, text, text, text, integer, integer)",
  "public.issue_partner_identity(uuid, uuid)",
  "public.issue_legacy_partner_identity(uuid, uuid, text)",
  "public.ensure_legacy_partner_record(uuid, uuid)",
  "public.post_accounts_excel_reconciliation(uuid, jsonb, jsonb, jsonb)",
]) {
  requireText("audited privileged RPC browser revoke", auditedBoundaryMigration, `revoke all on function ${signature} from public, anon, authenticated`);
  requireText("audited privileged RPC service-role grant", auditedBoundaryMigration, `grant execute on function ${signature} to service_role`);
}
requireText("legacy POSP anonymous read removed", auditedBoundaryMigration, 'drop policy if exists "Allow anon read posp-documents" on storage.objects');
requireText("legacy POSP anonymous upload removed", auditedBoundaryMigration, 'drop policy if exists "Allow anon upload posp-documents" on storage.objects');
requireText("legacy POSP upload size bounded", auditedBoundaryMigration, "file_size_limit = 10485760");
requireText("legacy POSP MIME types bounded", auditedBoundaryMigration, "allowed_mime_types = array['application/pdf','image/jpeg','image/png']::text[]");
requireText("trigger SECURITY DEFINER browser execution revoked", functionSurfaceMigration, "pg_get_function_result(p.oid) in ('trigger', 'event_trigger')");
requireText("trigger function PUBLIC/anon/authenticated revoke", functionSurfaceMigration, "'revoke execute on function %s from public, anon, authenticated'");
requireText("advisor search_path hardening", functionSurfaceMigration, "'alter function %s set search_path to public'");
requireText("all SECURITY DEFINER anon execution revoked", anonDefinerMigration, "where n.nspname = 'public'\n      and p.prosecdef");
requireText("SECURITY DEFINER PUBLIC/anon revoke", anonDefinerMigration, "'revoke execute on function %s from public, anon'");
requireText("SECURITY DEFINER service role preserved", anonDefinerMigration, "'grant execute on function %s to service_role'");
requireText("future function PUBLIC default revoked", anonDefinerMigration, "alter default privileges for role postgres revoke execute on functions from public");
requireText("future function anon default revoked", anonDefinerMigration, "alter default privileges for role postgres in schema public revoke execute on functions from anon");
requireText("group actor bound to authenticated user", authenticatedDefinerMigration, "actor_profile_id is distinct from auth.uid()");
requireText("group service-role compatibility preserved", authenticatedDefinerMigration, "is_service_role boolean");
requireText("downline root bound to session", authenticatedDefinerMigration, "root_user_id = auth.uid()");
requireText("customer viewer bound to session", authenticatedDefinerMigration, "viewer_id = auth.uid()");
requireText("profile viewer substitution blocked", authenticatedDefinerMigration, "if not is_service_role and viewer_id is distinct from auth.uid()");
requireText("intermediary queue capability guard", authenticatedDefinerMigration, "where public.can_manage_posp_misp_onboarding()");
for (const signature of [
  "public.insert_customer_activity_event(",
  "public.sync_existing_intermediary_migration(uuid, uuid, jsonb, text)",
  "public.repair_legacy_partner_record_link(uuid, uuid)",
  "public.resolve_intermediary_partner_record_id(uuid)",
  "public.sync_external_customer_stage_to_operations(uuid, uuid)",
]) {
  requireText("internal maintenance RPC authenticated revoke", authenticatedDefinerMigration, signature);
}
requireText("internal maintenance RPC browser revoke", authenticatedDefinerMigration, "from public, anon, authenticated");
for (const signature of [
  "public.generate_customer_signup_code()",
  "public.next_partner_application_reference()",
  "public.next_partner_code()",
  "public.next_partner_identity()",
  "public.next_posp_identity()",
  "public.next_registration_code(text)",
  "public.sync_partner_details_to_linked_accounts(uuid)",
  "public.sync_partner_identity_to_intermediary_register(uuid)",
]) {
  requireText("internal primitive browser revoke", internalPrimitiveMigration, signature);
}
requireText("internal primitive authenticated revoke", internalPrimitiveMigration, "from public, anon, authenticated");
requireText("associated onboarding profile bound to session", associatedOnboardingMigration, "p_profile_id = auth.uid()");
requireText("associated onboarding service-role path preserved", associatedOnboardingMigration, "= 'service_role'");
requireText("corporate contact application row lock", associatedOnboardingMigration, "from public.customer_onboarding_applications\n  where id = p_application_id\n  for update");
requireText("corporate contact owner or parent-manager guard", associatedOnboardingMigration, "v_application.profile_id = auth.uid()");
requireText("corporate contact parent manager guard", associatedOnboardingMigration, "public.can_manage_group_associated_onboarding(");
requireText("corporate contact editable-state guard", associatedOnboardingMigration, "status not in ('not_started', 'in_progress', 'changes_requested')");
requireText("deny-all RLS table discovery", denyAllTableMigration, "having count(p.oid) = 0");
requireText("deny-all browser privilege revoke", denyAllTableMigration, "'revoke all privileges on table %I.%I from anon, authenticated'");
requireText("pg_trgm moved out of public", pgTrgmMigration, "alter extension pg_trgm set schema extensions");

assert.deepEqual(
  classifyPolicyIntakeDeleteLinks([{ id: "rejected-1", status: "rejected" }]),
  { rejectedIds: ["rejected-1"], blockingCount: 0 },
  "A rejected-only policy intake must not block IT Super User policy deletion."
);

assert.deepEqual(
  classifyPolicyIntakeDeleteLinks([{ id: "completed-1", status: "completed" }]),
  { rejectedIds: [], blockingCount: 1 },
  "A completed policy intake must continue blocking ordinary policy deletion."
);

assert.deepEqual(
  classifyPolicyIntakeDeleteLinks([
    { id: "rejected-1", status: "rejected" },
    { id: "completed-1", status: "completed" },
  ]),
  { rejectedIds: ["rejected-1"], blockingCount: 1 },
  "A mixed rejected + completed intake set must still block ordinary policy deletion."
);

assert.deepEqual(
  classifyPolicyIntakeDeleteLinks([
    { id: "processing-1", status: "processing" },
    { id: "review-1", status: "in_review" },
    { id: "attention-1", status: "needs_attention" },
    { id: "unknown-1", status: null },
  ]),
  { rejectedIds: [], blockingCount: 4 },
  "Active, review, attention and unknown intake states must remain blockers."
);

console.log(JSON.stringify({
  recordScopedIntermediaryPages: 3,
  recordScopedIntermediaryRoutes: 3,
  hierarchyScopedRegisters: 1,
  atomicActivation: true,
  guardedClaimTransition: true,
  fullAadhaarClientSerializationBlocked: true,
  itSuperUserPolicyDeleteRejectedIntakeException: true,
  rejectedPolicyIntakeRollbackGuard: true,
  itSuperUserPolicyIntakeDeletePanel: true,
  policyIntakeFinalPolicyDeleteGuard: true,
  policyIntakeStorageCleanupGuard: true,
  itSuperUserCompletedPolicyIntakeAtomicCleanup: true,
  completedPolicyIntakeProtectedDependencies: true,
  completedPolicyIntakeExternalRenewalGuard: true,
  completedPolicyIntakeStorageCleanupAudit: true,
  auditedDatabaseSecurityBoundaries: true,
  privilegedRpcBrowserExecutionRevoked: true,
  legacyPospAnonymousStorageClosed: true,
  triggerFunctionRpcExposureClosed: true,
  mutableFunctionSearchPathsPinned: true,
  anonymousSecurityDefinerExecutionClosed: true,
  authenticatedActorViewerIdsSessionBound: true,
  internalMaintenanceRpcsServerOnly: true,
  internalRpcPrimitivesServerOnly: true,
  associatedOnboardingAuthorizationBound: true,
  denyAllRlsTablesExplicitlyServerOnly: true,
  publicExtensionWarningClosed: true,
  status: "ok",
}, null, 2));
