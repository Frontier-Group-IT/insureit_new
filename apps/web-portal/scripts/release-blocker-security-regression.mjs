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

assert.deepEqual(
  classifyPolicyIntakeDeleteLinks([{ id: "rejected-1", status: "rejected" }]),
  { rejectedIds: ["rejected-1"], blockingCount: 0 },
  "A rejected-only policy intake must not block IT Super User policy deletion."
);

assert.deepEqual(
  classifyPolicyIntakeDeleteLinks([{ id: "completed-1", status: "completed" }]),
  { rejectedIds: [], blockingCount: 1 },
  "A completed policy intake must continue blocking policy deletion."
);

assert.deepEqual(
  classifyPolicyIntakeDeleteLinks([
    { id: "rejected-1", status: "rejected" },
    { id: "completed-1", status: "completed" },
  ]),
  { rejectedIds: ["rejected-1"], blockingCount: 1 },
  "A mixed rejected + completed intake set must still block policy deletion."
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
  status: "ok",
}, null, 2));
