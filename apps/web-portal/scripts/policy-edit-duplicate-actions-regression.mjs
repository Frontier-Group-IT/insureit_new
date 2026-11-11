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

// Field-level Activity Status must be derived from a successfully saved
// before/after policy snapshot, never a generic "Policy Edited" placeholder.
const activity = read("../lib/policy-activity.ts");
const changes = read("../lib/policy-activity-changes.ts");
const edit = read("../app/policies/policy-edit-actions.ts");
const activityUi = read("../components/policy-activity-status.tsx");
const card = read("../components/standard-activity-status-card.tsx");
assert.match(edit, /const beforeChanges = await capturePolicyChangeSnapshot\(admin, policyId\)/);
assert.match(edit, /const afterChanges = await capturePolicyChangeSnapshot\(admin, result\.policyId\)/);
assert.match(edit, /diffPolicyChangeSnapshots\(beforeChanges, afterChanges\)/);
assert.match(activity, /new_data: \{ changes \}/, "Future edits store changed-field details in the existing audit JSON.");
assert.match(activity, /Older edit: the changed fields were not recorded/, "Historic edits without snapshots must be identified as unknown.");
assert.match(activity, /policyChangeDescription\(candidate\.changes\)/);
assert.match(changes, /POLICY_CHANGE_FIELDS/, "Field audit summaries must use an allowlist.");
assert.doesNotMatch(changes, /"policy\.customer_id"|customer\.phone|user_agent/, "Do not add customer contact data to activity summaries.");
assert.match(activityUi, /detailed/, "Policy Activity Status shows field descriptions below the event.");
assert.match(card, /detailed && item\.meta/, "Full change descriptions are readable without truncation.");

console.log("Policy Edit single action-row regression passed.");
