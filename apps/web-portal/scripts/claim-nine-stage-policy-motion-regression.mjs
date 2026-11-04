import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const claims = read("../components/claim-manager/operations-claim-stages.tsx");
const claimMotion = read("../components/claim-manager/operations-claim-stages-motion.css");
const stage1 = read("../components/spot-survey/bulk-document-verification-group.tsx");
const stage3 = read("../components/final-documents/stage3-document-verification-group.tsx");
const documentMotion = read("../components/spot-survey/claim-document-motion.module.css");
const policy = read("../components/policy-unified-form.tsx");
const policyMotion = read("../components/policy-form-motion.module.css");

const stages = [
  "spot_intimation", "spot_status", "claim_intimation", "work_approval", "repair_ri",
  "billing", "delivery_order", "vehicle_delivery", "payment_encashment",
];
for (const stage of stages) {
  assert.match(claims, new RegExp('key: "' + stage + '"'), "Claim journey must retain " + stage);
}
assert.match(claims, /key=\{selected\.key\} data-claim-stage-panel=\{selected\.key\}/,
  "Changing any of the nine selected stages must trigger a shared panel entrance.");
assert.match(claims, /operations-claim-motion-panel p-4/,
  "Every stage must use the same scoped panel animation.");
assert.match(claimMotion, /@keyframes operationsClaimPanelEnter/,
  "Stage transitions need a real panel entrance animation.");
assert.match(claimMotion, /animation: operationsClaimPanelEnter 280ms [^;]* backwards;/,
  "Stage entrance must release its transform after the animation.");
assert.match(claimMotion, /operations-claim-motion-panel :is\(button, \[role="button"\]\):focus-visible/,
  "Stage controls must retain keyboard focus indicators.");
assert.match(claimMotion, /@media \(hover:hover\) and \(pointer:fine\)/,
  "Hover-specific effects must be limited to compatible pointers.");
assert.match(claimMotion, /@media \(prefers-reduced-motion:reduce\)/,
  "Reduced-motion users must not receive entrance animations.");
assert.match(stage1, /motionStyles\.card/, "Stage 1 document cards must use shared motion styling.");
assert.match(stage3, /motionStyles\.card/, "Stage 3 document cards must use shared motion styling.");
assert.match(stage3, /motionStyles\.verified/, "Stage 3 verified styling must match Stage 1.");
assert.match(documentMotion, /animation: documentEnter \.32s ease-out backwards;/,
  "Document entrance animations must not permanently override hover lift.");
assert.doesNotMatch(documentMotion, /animation: documentEnter [^;]* both;/,
  "Document card transform must not remain after entrance.");
assert.match(policy, /motionStyles\.policySection/, "Add and Edit Policy must both use the shared Section component.");
assert.match(policy, /motionStyles\.policyPage/, "Both Policy modes must share the motion scope.");
assert.match(policyMotion, /\.policySection\s*\{[^}]*animation: policyEnter [^;]* backwards;/,
  "Policy sections must release their entrance transform.");
assert.match(policyMotion, /\.policySummary\s*\{[^}]*animation: policyEnter [^;]* backwards;/,
  "Policy summary must release its entrance transform.");
assert.match(policyMotion, /\.policySection:hover\s*\{\s*transform:translateY\(-2px\)/,
  "Policy section hover lift must remain active.");
assert.match(policyMotion, /@media \(prefers-reduced-motion:reduce\)/,
  "Policy animations must preserve reduced-motion behavior.");
console.log("Operations Stage 1–9 and Add/Edit Policy hover/motion regression passed.");
