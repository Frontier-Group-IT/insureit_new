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
assert.match(stages, /nextStageKey: nextStageKeyFor\(milestoneKey\)/);
assert.match(stages, /completedFinalStage: milestoneKey === "payment_encashment" && result\.advanced/, "Redirect eligibility must require server-confirmed Stage 9 advancement.");
assert.match(stages, /if \(!result\.ok\) return \{ ok: false/, "Failed stage saves must not redirect.");
assert.match(stages, /if \(state\.completedFinalStage\) \{[\s\S]*?router\.replace\("\/claims"\);[\s\S]*?return;/, "Successful final-stage completion must return to Operations Claim Register.");
assert.match(stages, /if \(state\.completedFinalStage\)[\s\S]*?if \(state\.nextStageKey\)/, "Final redirect must take priority over ordinary stage navigation.");

assert.match(stages, /setSelectedKey\(state\.nextStageKey\)/);
assert.match(stages, /if \(!spotState\.ok\) return;/, "Failed Spot Intimation saves must not navigate.");
assert.match(stages, /const nextKey = nextStageKeyFor\("spot_intimation"\)/, "Stage 1 Save Details should target Spot Status.");
assert.match(stages, /const canOpenNext = unrestrictedStageEditing \|\| journeyComplete \|\| activeIndex >= 1/, "Only already accessible next stages may open.");
assert.match(stages, /if \(nextKey && canOpenNext\) \{[\s\S]*?setSelectedKey\(nextKey\);[\s\S]*?router\.replace\(\x60\/claims\/\$\{claimId\}\?stage=\$\{nextKey\}\x60\);/, "Successful Stage 1 save must navigate to next stage.");
assert.match(stages, /await saveInternalSpotIntimationDetails\(claimId, formData\)/, "Preserve saving without automatic workflow advancement.");

assert.match(stages, /router\.replace\(\`\$\{partnerManagedJourney/);
assert.match(stages, /selected\.key === "work_approval" \|\| selected\.key === "payment_encashment" \? "lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 lg:items-start"/, "Stages 4 and 9 should reflow responsively while aligning labels and controls.");
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



assert.match(heading, /\{heading\}/);
assert.match(heading, /<Image src=\{claimHeaderIcons\.claim\} alt="" width=\{34\}/);
assert.match(heading, /rounded-xl border border-white bg-white/);

console.log("Operations Claim Journey save navigation, Stage 9 layout and 3D heading regression passed.");
