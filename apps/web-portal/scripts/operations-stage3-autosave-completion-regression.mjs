import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const stage3 = read("../components/final-documents/final-documents-workspace-v2.tsx");
const stages = read("../components/claim-manager/operations-claim-stages.tsx");
const motion = read("../components/claim-manager/operations-claim-stages-motion.css");
const actions = read("../components/final-documents/final-documents-actions.ts");

assert.doesNotMatch(stage3, /onClick=\{saveStageDetails\}/, "Stage Details must not expose a redundant Save Details button.");
assert.match(stage3, /autoSaveQueueRef/, "Stage Details saves must be serialized.");
assert.match(stage3, /window\.setTimeout\(\(\) => \{[\s\S]*?saveFinalDealershipDetails\(stageDetailsForm\(snapshot\)\)/, "Complete details must automatically persist using existing protected server action.");
assert.match(stage3, /Object\.values\(snapshot\)\.every/, "Incomplete drafts must not trigger rejected server saves.");
assert.match(stage3, /sessionStorage\.setItem\(draftKey/, "Editable drafts must survive stage navigation in the same session.");
assert.match(stage3, /sessionStorage\.getItem\(draftKey\)/, "Saved drafts must be restored when returning to the stage.");
assert.match(stage3, /JSON\.stringify\(latestDetailsRef\.current\) === signature/, "Do not clear a newer draft after saving an older snapshot.");
assert.match(stage3, /lastSavedSignatureRef\.current = signature/, "Skip redundant saves for unchanged snapshots.");
assert.match(stage3, /role="status"/, "Automatic save must show accessible feedback.");
assert.match(stage3, /function saveAndContinue\(\)/, "Explicit stage completion must remain available.");
assert.match(actions, /requireClaimWorkflowAccess\(claimId/, "Autosave must continue through the existing claim authorization gate.");
assert.match(stages, /isCompleted \? "bg-\[#16A34A\] text-white/, "Completed step checkmarks must use a filled green circle.");
assert.match(motion, /operations-claim-motion-completed \.operations-claim-motion-step-button\s*\{\s*background: #dcfce7;/, "Completed stage tiles must have full green backgrounds.");
console.log("Operations Stage 3 autosave and completed-stage styling regression passed.");
