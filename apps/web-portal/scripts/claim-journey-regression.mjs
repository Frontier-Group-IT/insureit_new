import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  CLAIM_INTIMATION_DOCUMENT_GROUPS,
  CLAIM_INTIMATION_DOCUMENT_TYPES,
  INTERNAL_CLAIM_STATUSES,
  INTERNAL_JOURNEY_STAGES,
  matchesClaimIntimationDocument,
  projectInternalClaim,
} from "../../../packages/claim-journey/src/index.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");

for (const status of INTERNAL_CLAIM_STATUSES) {
  const projection = projectInternalClaim(status);
  assert.equal(projection.knownStatus, true, `${status} must have an explicit projection`);
  assert.equal(projection.stageLabel, INTERNAL_JOURNEY_STAGES[projection.stageIndex]?.label);
  assert.ok(projection.progress >= 0 && projection.progress <= 100);
}

assert.equal(projectInternalClaim("Initial Documents Pending").customerActionRequired, true);
assert.equal(projectInternalClaim("Initial Documents Pending", { hasRequiredDocuments: true }).customerActionRequired, false);
assert.equal(projectInternalClaim("Initial Documents Verification Pending", { hasRejectedDocuments: true }).customerActionRequired, true);
assert.equal(projectInternalClaim("Under Repair", { hasRejectedDocuments: true }).customerActionRequired, false);
assert.equal(projectInternalClaim("Final Documents Awaited", { hasRequiredDocuments: true }).nextActionOwner, "operations");
assert.equal(projectInternalClaim("Surveyor Appointed").stageKey, "spot_status");
assert.equal(projectInternalClaim("Work Approval Status").stageKey, "work_approval");
assert.equal(projectInternalClaim("DO Status").stageKey, "delivery_order");
assert.equal(projectInternalClaim("Closed").progress, 100);
assert.equal(projectInternalClaim("Unrecognized legacy state").knownStatus, false);
assert.equal(projectInternalClaim("Unrecognized legacy state").customerActionRequired, false);

assert.equal(CLAIM_INTIMATION_DOCUMENT_GROUPS.length, 5);
assert.equal(CLAIM_INTIMATION_DOCUMENT_TYPES.length, 26);
assert.deepEqual(
  CLAIM_INTIMATION_DOCUMENT_GROUPS.map((group) => group.label),
  ["Vehicle Docs", "Driver Docs", "Permit / Tax", "KYC / Other", "Forms"],
);
assert.equal(matchesClaimIntimationDocument("Insurance copy", "Insurance Copy"), true);
assert.equal(matchesClaimIntimationDocument("Driver Aadharcard Back", "Driver Aadhaar back"), true);
assert.equal(matchesClaimIntimationDocument("Pancard", "PAN"), true);
assert.equal(matchesClaimIntimationDocument("Repair estimate", "Repair Estimate"), true);

const customerUpload = await readFile(path.join(repoRoot, "apps/mobile-app/app/customer/upload-documents.tsx"), "utf8");
assert.doesNotMatch(customerUpload, /\.from\(['"]claims['"]\)\.update\(\{\s*current_status/);
assert.doesNotMatch(customerUpload, /advanceAfterUpload/);

const selfManagedMilestone = await readFile(path.join(repoRoot, "apps/mobile-app/app/customer/self-managed-milestone.tsx"), "utf8");
assert.match(selfManagedMilestone, /save_self_managed_milestone/);
assert.doesNotMatch(selfManagedMilestone, /mode="broker-managed"/);

const internalStage = await readFile(path.join(repoRoot, "apps/mobile-app/app/customer/internal-claim-stage.tsx"), "utf8");
assert.match(internalStage, /mode="broker-managed"/);
assert.match(internalStage, /CLAIM_INTIMATION_UPLOAD_STATUSES/);
assert.doesNotMatch(internalStage, /save_self_managed_milestone/);
assert.doesNotMatch(internalStage, /\.from\(['"]claims['"]\)\.update/);

const claimDetail = await readFile(path.join(repoRoot, "apps/mobile-app/app/customer/claim-detail.tsx"), "utf8");
assert.match(claimDetail, /\/customer\/internal-claim-stage/);
assert.doesNotMatch(claimDetail, /<ClaimPrimaryAction[^>]+Upload Documents/);

const webFinalDocumentGroups = await readFile(path.join(repoRoot, "apps/web-portal/components/final-documents/final-document-groups.ts"), "utf8");
assert.match(webFinalDocumentGroups, /CLAIM_INTIMATION_DOCUMENT_GROUPS/);

const managedDocumentProtection = await readFile(path.join(repoRoot, "supabase/migrations/20260903170000_protect_verified_managed_claim_documents.sql"), "utf8");
assert.match(managedDocumentProtection, /claim\.claim_service_mode = 'self_managed'/);
assert.match(managedDocumentProtection, /document\.verification_status = 'verified'/);
assert.match(managedDocumentProtection, /claim\.claim_service_mode = 'broker_managed'/);

const serviceMode = await readFile(path.join(repoRoot, "apps/mobile-app/lib/claim-service-mode.ts"), "utf8");
assert.match(serviceMode, /claim_service_mode/);
assert.match(serviceMode, /assistance_status/);

const assistanceMigration = await readFile(path.join(repoRoot, "supabase/migrations/20260903151000_reviewed_claim_assistance_intake.sql"), "utf8");
assert.match(assistanceMigration, /claim_service_mode = 'self_managed'/);
assert.match(assistanceMigration, /policy_service_source = 'external'/);
assert.match(assistanceMigration, /for update/);
assert.match(assistanceMigration, /assistance_status = 'accepted'/);
assert.match(assistanceMigration, /claim_service_mode = 'broker_managed'/);
assert.match(assistanceMigration, /revoke execute on function public\.resolve_claim_assistance\(uuid, text, text\) from authenticated/);
assert.doesNotMatch(assistanceMigration, /update public\.claim_milestones/);

const finalizationAction = await readFile(path.join(repoRoot, "apps/web-portal/app/claims/[id]/spot-survey-actions.ts"), "utf8");
assert.match(finalizationAction, /if \(!advanced\) throw new Error/);
assert.match(finalizationAction, /claim_service_mode !== "broker_managed"/);
assert.doesNotMatch(finalizationAction, /await advanceAfterInitialDocumentsVerified\(claim, "", profile\?\.id \?\? null\);\s*revalidatePath/);

const finalizationMigration = await readFile(path.join(repoRoot, "supabase/migrations/20260903160000_fix_initial_document_finalization.sql"), "utf8");
for (const status of ["Initial Documents Pending", "Initial Documents Verification Pending", "Initial Documents Submitted", "Documents Pending", "Documents Submitted"]) {
  assert.match(finalizationMigration, new RegExp(`'${status}'`));
}
assert.match(finalizationMigration, /for update/);
assert.match(finalizationMigration, /claim_service_mode = 'broker_managed'/);
assert.match(finalizationMigration, /if not found then\s+raise exception 'The claim status could not be updated\.'/);

console.log(`Claim journey regression passed for ${INTERNAL_CLAIM_STATUSES.length} internal statuses.`);
