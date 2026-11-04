import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const stages = read("components/claim-manager/operations-claim-stages.tsx");
const claimIntimation = read("components/final-documents/final-documents-workspace-v2.tsx");
const heading = read("components/spot-survey/spot-survey-workspace-v2.tsx");

for (const [stage, next] of [
  ["claim_intimation", "work_approval"],
  ["work_approval", "repair_ri"],
  ["repair_ri", "billing"],
]) {
  assert.match(stages, new RegExp('\\{ key: "' + stage + '"'));
  assert.match(stages, new RegExp('\\{ key: "' + next + '"'));
}
assert.match(stages, /nextStageKey: result\.advanced \? nextStageKeyFor\(milestoneKey\) : null/);
assert.match(stages, /setSelectedKey\(state\.nextStageKey\)/);
assert.match(stages, /router\.replace\(\`\$\{partnerManagedJourney/);
assert.match(stages, /selected\.key === "payment_encashment" \? "lg:grid-cols-\[repeat\(5,minmax\(0,1fr\)\)\] lg:items-start"/);
assert.match(stages, /name: "depreciation_slip_submitted"/);
assert.match(stages, /name: "satisfaction_voucher_submitted"/);
assert.match(stages, /name: "documents_submit_date"/);
assert.match(stages, /name: "payment_received_date"/);
assert.match(stages, /name: "payment_received_amount"/);
assert.match(claimIntimation, /closeClaimNumberPrompt\(advanceToWorkApproval = advanceAfterClaimNumber\)/);
assert.match(claimIntimation, /if \(advanceToWorkApproval\) \{[\s\S]*?router\.replace\(\`\/claims\/\$\{claimId\}\?stage=work_approval\`\);[\s\S]*?return;/);
assert.match(claimIntimation, /onClick=\{\(\) => closeClaimNumberPrompt\(\)\}/);
assert.match(claimIntimation, /closeClaimNumberPrompt\(advanceAfterClaimNumber\)/);
assert.doesNotMatch(claimIntimation, /router\.replace\(\`\/claims\/\$\{claimId\}\?stage=work_approval\`\);\s*router\.refresh\(\)/);
assert.match(heading, /operations-journey-cube-top/);
assert.match(heading, /operations-journey-cube-left/);
assert.match(heading, /operations-journey-cube-right/);
assert.match(heading, /\{heading\}/);

console.log("Operations Claim Journey save navigation, Stage 9 layout and 3D heading regression passed.");
