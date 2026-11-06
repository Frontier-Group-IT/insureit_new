import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const stages = read("../components/claim-manager/operations-claim-stages.tsx");
const claimPage = read("../app/claims/[id]/page.tsx");
const customerStages = read("../components/customer-portal/customer-claim-stage-strip.tsx");
const addClaim = read("../app/claims/new/add-claim-form.tsx");

assert.match(stages, /const journeyComplete = \["Claim Complete", "Settled", "Closed"\]\.includes\(currentStatus\)/, "Terminal claim status still controls completed view.");
assert.match(stages, /const hideCompletedOperationsStagePanel = !partnerReadOnlyJourney && !partnerManagedJourney && \(/, "Only Operations should hide the completed stage input panel.");
assert.match(stages, /journeyComplete \|\| \(hasExternalVisualProgress && stages\.every\(\(stage\) => externalVisualCompletedKeys\.has\(stage\.key\)\)\)/, "Completed external milestones also hide the input panel.");
assert.match(stages, /<ol aria-label="Nine-stage claim journey"/, "Preserve nine-stage navigation.");
assert.match(stages, /\{!hideCompletedOperationsStagePanel \? <div key=\{selected\.key\} data-claim-stage-panel/, "Only incomplete Operations claims render stage forms.");
assert.match(stages, /<form action=\{formAction\}/, "Stage Save forms remain for incomplete claims.");
assert.match(claimPage, /const claimPdfActions = allNineCompletedForPdf \?/, "Completed PDF actions remain intact.");
assert.match(claimPage, /<SpotClaimHeader headerActions=\{claimPdfActions\}/, "PDF and Back controls remain in header.");
assert.match(customerStages, /customer-claim-stage-nav/, "Customer journey remains unchanged.");
assert.doesNotMatch(addClaim, /OperationsClaimStages/, "Add Claim does not gain any stage-input/journey UI.");
console.log("Operations completed claim input panel hidden without disrupting active journeys.");
