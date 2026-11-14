import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const unified = read("../components/policy-unified-form.tsx");
const footer = read("../components/policy-edit-action-footer.tsx");
const page = read("../app/policies/[id]/edit/policy-edit-standard.tsx");

assert.match(unified, /data-policy-edit-original-actions=\{isEdit \? "" : undefined\}/, "Only Edit Policy must mark its original action row.");
assert.match(footer, /\[data-policy-edit-form\] \[data-policy-edit-original-actions\] \{ display: none !important; \}/, "Original action row must be hidden on standard Edit Policy.");
assert.match(footer, /const original = findOriginalSaveButton\(\);[\s\S]*?original\.click\(\)/, "Bottom Save must still delegate to the actual form handler.");
assert.match(footer, /observer\.observe\(original/, "Loading and disabled state must remain synced from the actual form.");
assert.match(page, /<PolicyEditActionFooter \/>/, "Standard Edit Policy must keep the bottom action footer.");
assert.match(unified, /onClick=\{\(\)=>submitPolicy\(\)\}/, "The original validated save handler must remain intact through its approval-aware wrapper.");
const activity = read("../lib/policy-activity.ts");
const motorEdit = read("../app/policies/policy-edit-actions.ts");
const nonMotorEdit = read("../app/policies/non-motor-policy-actions.ts");
const lifeHealthEdit = read("../app/policies/life-health-issued-policy-edit-actions.ts");
const activityCard = read("../components/standard-activity-status-card.tsx");
for (const [name, edit] of [["Motor", motorEdit], ["Non-Motor", nonMotorEdit], ["Life/Health", lifeHealthEdit]]) {
  assert.match(edit, /capturePolicyEditSnapshot\(admin, (?:policyId|id)\)/, name + " editor captures pre-save state");
  assert.match(edit, /const activityAfter = await capturePolicyEditSnapshot/, name + " editor captures post-save state");
  assert.match(edit, /describePolicyEditChanges\(activityBefore, activityAfter\)/, name + " activity records actual changes");
}
for (const field of ["policy_no", "status", "premium_amount", "start_date", "end_date", "net_premium", "gross_premium", "policy_product", "insurance_company_id", "proposal_number", "next_installment_date", "deductible"]) {
  assert.ok(activity.includes(field), field + " is part of reviewed policy activity coverage");
}
assert.match(activity, /new_data: \{ changed_fields: changedFields \?\? null \}/, "Save only approved changed-field summaries, never full customer or form snapshots");
assert.match(activity, /DISPLAYABLE_PREMIUM_VALUES/, "Only specifically approved policy premium fields may show old/new values");
assert.match(activity, /changedFields: action === POLICY_ACTIVITY_ACTIONS.POLICY_EDITED/, "Activity reader must decode field names from immutable audit");
assert.match(activity, /"Policy updated — change details unavailable"/, "Historical edits without change data cannot pretend to know what changed");
assert.match(activity, /candidate\.changedFields\?\.map\(field =>/, "Show only individually approved recorded field changes");
assert.match(activityCard, /item\.changes\?\.length/, "Shared activity UI renders each recorded field change");
assert.match(activity, /"Policy saved — no tracked field changes"/, "A save without tracked changes must not claim a business change");
assert.match(activityCard, /item\.meta/, "Activity UI continues to display actual field details and timestamp");
console.log("Policy Edit single action-row regression passed.");
