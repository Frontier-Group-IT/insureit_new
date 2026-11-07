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
assert.match(stages, /selected\.key === "spot_status" \? "grid-cols-4 gap-2 items-start"/, "Spot Status must always keep four columns without wrapping.");
assert.match(stages, /selected\.key === "spot_status" \|\| selected\.key === "billing"/, "Stage 2 inputs must use full available grid width.");
assert.match(stages, /selected\.key === "spot_status" \? "text-\[8px\]" : "text-\[9px\]"/, "Only Spot Status labels should be smaller.");
assert.match(stages, /selected\.key === "spot_status" \|\| selected\.key === "delivery_order" \|\| selected\.key === "payment_encashment" \? "mt-3 flex items-center justify-end gap-2"/, "Stage 2 Save row should have no extra divider.");
assert.match(stages, /className="mt-1 h-\[34px\] w-full/, "Stage 2 text controls must keep 34px height.");
assert.match(stages, /billingCompact \? "h-\[34px\] max-w-full/, "Stage 2 date input must preserve 34px height.");
assert.ok(stages.includes('selected.key === "payment_encashment" ? "min-w-[1120px] grid-cols-[minmax(235px,1.1fr)_minmax(255px,1.2fr)_minmax(190px,1fr)_minmax(190px,1fr)_minmax(185px,0.9fr)] gap-2 items-start"'), "Stage 9 has five aligned single-row columns.");
assert.ok(stages.includes('selected.key === "work_approval" ? "lg:grid-cols-3 xl:grid-cols-5 lg:items-start"'), "Stage 4 aligns five fields at wide desktop widths.");
assert.ok(stages.includes('selected.key === "payment_encashment" || selected.key === "delivery_order" || selected.key === "work_approval" ? "" : "max-w-[254px]"'), "Stage 4 and Stage 9 Yes/No controls use their grid cell widths.");
assert.ok(stages.includes('const useAppDatePicker = field.type === "date"'), "Native date behavior is preserved.");
assert.match(stages, /sm:grid-cols-2/, "Keep responsive narrow-screen wrapping.");
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


// Compact inputs preserve the dedicated submit footer and Vehicle Delivery date variant.
assert.match(stages, /grid min-w-0 items-start gap-2 \$\{selected.key === "payment_encashment" \|\| selected.key === "spot_status" \? "" : "sm:grid-cols-2"\}/);
assert.match(stages, /<AppStyleDateInput name=\{field.name\} value=\{value\} required=\{required\} compact billingCompact=\{selected.key === "billing"\} vehicleDeliveryCompact=\{selected.key === "vehicle_delivery"\} \/>/);
assert.ok(stages.includes('vehicleDeliveryCompact ? "h-[34px] max-w-[335px] px-3"'));
assert.ok(stages.includes('h-[34px] text-[12px]'));
assert.match(stages, /mt-4 flex min-h-10 flex-wrap items-center justify-end gap-2 border-t border-\[#D9E3F0\] pt-3/);
assert.ok(stages.includes('selected.key === "repair_ri" ? "" : selected.key === "vehicle_delivery" ? "max-w-[335px]" : "max-w-[260px]"'));

// Spot Status: all four labels sit above their 34px controls in one grid row, without horizontal scrolling.
assert.match(stages, /selected.key === "spot_status" \? "grid-cols-4 gap-2 items-start"/);
assert.match(stages, /selected.key === "spot_status" \? "whitespace-normal" : "whitespace-nowrap max-sm:whitespace-normal"/);
assert.match(stages, /selected.key === "spot_status" \? "block min-h-8 lg:min-h-4 leading-4 break-words"/);
assert.match(stages, /selected.key === "payment_encashment" \|\| selected.key === "spot_status" \? "mt-1 block w-full min-w-0"/);
assert.match(stages, /className="mt-1 h-\[34px\] w-full min-w-0 rounded-\[4px\] border/);
assert.doesNotMatch(stages, /selected.key === "spot_status" \? "w-full overflow-x-auto"/, "Spot Status must not introduce scrolling.");
