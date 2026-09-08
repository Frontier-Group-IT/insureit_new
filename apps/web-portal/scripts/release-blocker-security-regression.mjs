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
  status: "ok",
}, null, 2));
