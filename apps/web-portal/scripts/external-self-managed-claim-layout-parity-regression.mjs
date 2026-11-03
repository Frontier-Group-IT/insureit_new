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

assert.match(page, /if \(claim\.claim_service_mode === "self_managed"\)/, "Self-managed claims must retain their separate read-only route.");
assert.match(page, /<SpotClaimHeader heading="Claim Journey" claim=\{\{ \.\.\.claimWithSpotIntimation, policySource:/, "Self-managed claims must reuse the exact Operations blue summary and linked policy context.");
assert.match(page, /<AssistanceIntakePanel/, "Customer managed evidence panel must remain available.");
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
console.log("External self-managed claim layout parity and read-only protections passed.");
