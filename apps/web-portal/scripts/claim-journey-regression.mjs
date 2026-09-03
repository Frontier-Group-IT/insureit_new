import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  INTERNAL_CLAIM_STATUSES,
  INTERNAL_JOURNEY_STAGES,
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

const customerUpload = await readFile(path.join(repoRoot, "apps/mobile-app/app/customer/upload-documents.tsx"), "utf8");
assert.doesNotMatch(customerUpload, /\.from\(['"]claims['"]\)\.update\(\{\s*current_status/);
assert.doesNotMatch(customerUpload, /advanceAfterUpload/);

const selfManagedMilestone = await readFile(path.join(repoRoot, "apps/mobile-app/app/customer/self-managed-milestone.tsx"), "utf8");
assert.match(selfManagedMilestone, /save_self_managed_milestone/);

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

console.log(`Claim journey regression passed for ${INTERNAL_CLAIM_STATUSES.length} internal statuses.`);
