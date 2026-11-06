import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const operations = read("../components/claim-manager/operations-claim-stages.tsx");
const motion = read("../components/claim-manager/operations-claim-stages-motion.css");
const customer = read("../components/customer-portal/customer-claim-stage-strip.tsx");
const customerMotion = read("../app/customer/(protected)/claims/[id]/stage/[stage]/customer-claim-reference.css");
const claimPage = read("../app/claims/[id]/page.tsx");

assert.match(operations, /import "\.\/operations-claim-stages-motion\.css"/, "Operations stage component must load scoped CSS.");
assert.match(claimPage, /<OperationsClaimStages/, "Operations claim page must use shared stages for both claim sources.");
assert.match(claimPage, /policySource: externalPolicy \? "external" : "sibl"/, "Keep internal/external policy source selection.");
assert.match(claimPage, /externalCustomerMilestones=\{externalCustomerMilestones\?\.map/, "External milestones must still drive visual completion.");
assert.match(operations, /disabled=\{!available\}/, "Unavailable stage buttons must remain disabled.");
assert.match(operations, /unrestrictedStageEditing \|\| journeyComplete \|\| index <= activeIndex \|\| externalStageCompleted/, "Preserve current permission-based availability.");
assert.match(operations, /onClick=\{\(\) => setSelectedKey\(stage\.key\)\}/, "Stage selection must remain interactive.");
assert.match(operations, /isCurrent \? "operations-claim-motion-active" : isCompleted \? "operations-claim-motion-completed"/, "Stage motion must reflect authoritative stage state.");
assert.match(operations, /operations-claim-motion-indicator/, "Active ring must be attached to status indicator.");
assert.match(operations, /operations-claim-motion-check/, "Completed check must be animated.");
assert.match(operations, /Nine-stage claim journey/, "Nine stages must remain accessible.");
assert.doesNotMatch(operations, /<h2[^>]*>Operations claim journey<\/h2>/, "Remove repeated white card claim journey title.");
assert.doesNotMatch(operations, /\{selected\.label\}<\/span>/, "Remove duplicate right-side stage label while retaining navigation.");

const matches = [
  ["active indicator", "customerClaimActiveRing", "operationsClaimActiveRing"],
  ["check completion", "customerClaimCheckAppear", "operationsClaimCheckAppear"],
  ["active stage glow", "customerClaimStepGlow", "operationsClaimStepGlow"],
];
for (const [name, expected, actual] of matches) {
  assert.ok(customerMotion.includes(expected), `Customer ${name} reference must exist.`);
  assert.ok(motion.includes(actual), `Operations ${name} equivalent must exist.`);
}
assert.match(motion, /3s ease-in-out infinite/, "Animated ring and glow must match Customer animation duration.");
assert.match(motion, /330ms cubic-bezier\(\.2,\.8,\.25,1\)/, "Completed check animation must match Customer easing.");
assert.match(motion, /prefers-reduced-motion:reduce/, "Respect reduced-motion accessibility setting.");
assert.match(customer, /customer-claim-motion-active/, "Customer stage visual remains unchanged.");
assert.doesNotMatch(motion, /(?:cursor:pointer|pointer-events:all)/, "Styles must not unlock protected stages.");
// Completed stage tiles must stay white; success is indicated by the green circular check.
assert.match(motion, /\.operations-claim-motion \.operations-claim-motion-completed \{\s*border-color: #dce6f3;\s*background: #fff;/, "Completed stage card background stays white");
assert.match(motion, /\.operations-claim-motion \.operations-claim-motion-completed \.operations-claim-motion-step-button \{\s*background: #fff;/, "Completed stage button background stays white");
assert.doesNotMatch(motion, /background: #dcfce7|background: #bbf7d0/, "No green completed stage card or hover fill");
assert.match(operations, /isCompleted \? "bg-\[#16A34A\] text-white/, "Keep filled green tick indicator");
console.log("Operations internal/external claim motion parity regression passed.");
