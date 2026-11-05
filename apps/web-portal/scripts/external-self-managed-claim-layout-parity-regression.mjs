import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const page = read("../app/claims/[id]/page.tsx");
const viewer = read("../components/claims/assistance-intake-panel.tsx");
const header = read("../components/spot-survey/spot-survey-workspace-v2.tsx");
const operations = read("../components/claim-manager/operations-claim-stages.tsx");
const motion = read("../components/claim-manager/operations-claim-stages-motion.css");
const loader = read("../app/claims/external-claim-readonly-actions.ts");

assert.doesNotMatch(page, /if \(claim\.claim_service_mode === "self_managed" && claim\.policy_service_source !== "external"\)/, "Internal and external self-managed claims must share the writable Operations workflow.");
assert.match(page, /const isExternalOperationsClaim = claim\.policy_service_source === "external"/, "All external claims must get Operations editing mode.");
assert.match(page, /unrestrictedStageEditing=\{isExternalOperationsClaim\}/, "External self-managed claims must have the same stage editing controls as broker-managed claims.");
const stageActions = read("../app/claims/stage-actions.ts");
const spotActions = read("../app/claims/internal-spot-intimation-actions.ts");
assert.match(stageActions, /claim\.claim_service_mode === "self_managed" && access\.isPartner/, "Self-managed stage writes must reject intermediary identities.");
assert.match(spotActions, /data\.claim_service_mode === "self_managed" && isPartner/, "Self-managed Spot Intimation must reject intermediary identities.");
assert.match(page, /<SpotClaimHeader headerActions=\{claimPdfActions\} claim=\{\{ \.\.\.effectiveClaimWithSpotIntimation, policySource:/, "All Operations claims must use the shared heading and linked policy context with optional PDF header actions.");
assert.doesNotMatch(page, /<AssistanceIntakePanel/, "Self-managed Operations claims must no longer be routed to the read-only assistance panel.");
assert.match(header, /heading = "Operations claim journey"/, "Standard Operations header title must remain unchanged.");
assert.match(header, />\{heading\}<\/h1>/, "Shared header must support the requested Claim Journey title.");
assert.match(viewer, /operations-claim-stages-motion\.css/, "Read-only viewer must import shared Operations animations.");
assert.match(viewer, /operations-claim-motion-nav grid grid-cols-9/, "Read-only viewer must match the compact nine-stage layout.");
assert.match(operations, /operations-claim-motion-nav grid grid-cols-9/, "Visual parity must use the Operations stage classes.");
assert.match(viewer, /operations-claim-motion-active/, "The current stage must receive the same blue glow.");
assert.match(viewer, /operations-claim-motion-completed/, "Completed stages must receive the same green style.");
assert.match(viewer, /operations-claim-motion-check/, "Completed stages must animate their checkmark.");
assert.match(viewer, /disabled=\{!available\}/, "Locked and future stages must remain inaccessible.");
assert.match(viewer, /loadExternalClaimReadonlyJourney\(props\.claimId\)/, "Read-only evidence must come from the existing scoped loader.");
assert.match(viewer, /Customer-entered values are shown exactly as read-only evidence/, "Customer details must remain evidence, not editable fields.");
assert.match(viewer, /<DocumentEvidence documents=\{selectedDocuments\}/, "Document links must remain available.");
assert.match(viewer, /View only/, "Read-only status must remain explicitly visible.");
assert.match(viewer, /xl:grid-cols-4/, "Details should align with the four-column Operations reference.");
assert.match(motion, /prefers-reduced-motion:reduce/, "Shared animation must support reduced-motion accessibility.");
for (const token of ['<form', 'type="submit"', 'resolveAssistanceIntake', 'completeClaimJourneyStage', 'saveInternalSpotIntimationDetails']) {
  assert.ok(!viewer.includes(token), `Self-managed viewer must remain read-only: ${token}`);
}
for (const token of ['.insert(', '.update(', '.delete(', '.upsert(', '.rpc(']) {
  assert.ok(!loader.includes(token), `External read-only loader must not perform mutations: ${token}`);
}
const migration = read("../../../supabase/migrations/20261105170000_self_managed_claim_operations_stage_parity.sql");
const rollback = read("../../../supabase/rollbacks/20261105170000_self_managed_claim_operations_stage_parity_rollback.sql");
assert.match(migration, /persist_managed_claim_stage_transition_from_details/, "Stage transition trigger must support self-managed claims.");
assert.match(migration, /persist_initial_document_submission_from_stage_details/, "Initial document trigger must support self-managed claims.");
assert.match(migration, /advance_initial_documents_verified/, "Initial document verification must accept self-managed claims.");
assert.match(migration, /complete_spot_survey/, "Spot-survey completion must accept self-managed claims.");
assert.match(migration, /claim_service_mode in \(''broker_managed'', ''self_managed''\)/, "Trigger lookup must accept both management modes.");
assert.match(migration, /not v_operations_actor/, "Self-managed claim changes must remain Operations-authorized.");
assert.match(migration, /not \(new\.details \? ''completed_at''\)/, "Saving self-managed historical stage details cannot silently advance a claim.");
assert.match(rollback, /claim_service_mode = ''broker_managed''/, "Rollback must restore the original managed-only lookup.");
assert.match(stageActions, /claim\.claim_service_mode === "self_managed" && access\.isPartner/, "Partner users must not modify self-managed Operations stages.");
assert.match(spotActions, /data\.claim_service_mode === "self_managed" && isPartner/, "Partner users must not edit self-managed Spot Intimation.");
const verificationActions = read("../app/claims/[id]/spot-survey-actions.ts");
assert.match(verificationActions, /data\.claim_service_mode === "self_managed" && access\.isPartner/, "Self-managed verification remains Operations-only.");
assert.match(page, /<OperationsClaimStages/, "All self-managed Operations claims must use the shared nine-stage component.");

console.log("External self-managed claim layout parity and read-only protections passed.");
