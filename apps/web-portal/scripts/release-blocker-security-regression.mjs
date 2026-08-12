import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

console.log(JSON.stringify({
  recordScopedIntermediaryPages: 3,
  recordScopedIntermediaryRoutes: 3,
  hierarchyScopedRegisters: 1,
  atomicActivation: true,
  guardedClaimTransition: true,
  fullAadhaarClientSerializationBlocked: true,
  status: "ok",
}, null, 2));
