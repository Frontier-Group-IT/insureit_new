import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const operations = read("../components/claim-manager/operations-claim-stages.tsx");
const customer = read("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
const actions = read("../app/customer/(protected)/claims/[id]/stage/[stage]/actions.ts");
const choice = read("../components/customer-portal/customer-claim-boolean-choice.tsx");
const submit = read("../components/customer-portal/customer-claim-stage-submit.tsx");
const stageFields = read("../lib/customer-claim-stage-fields.ts");

// Both forms keep five columns; Operations removes only the redundant Stage 4 form header.
for (const source of [operations, customer]) {
  assert.ok(source.includes('min-w-[900px] !grid-cols-5 items-start'));
}
for (const text of ['Stage 4 — Work Approval', 'Record insurance approval and surveyor details', '4 of 9']) {
  assert.ok(!operations.includes(text), 'Operations should omit redundant Work Approval heading content: ' + text);
  assert.ok(customer.includes(text), 'Customer heading is unchanged: ' + text);
}
assert.ok(operations.includes('selected.key === "work_approval" ? "mt-3 flex min-h-10 flex-wrap items-center justify-end gap-2"'), 'Work Approval footer has no divider.');
assert.ok(operations.includes('className="mt-3 rounded-xl border border-[#D9E6F7] bg-white p-3"'), 'Work Approval and all other Operations stages use the approved white form background.');
assert.ok(operations.includes('selected.key === "work_approval" ? "Save & Continue"'), 'Keep Work Approval Save & Continue.');
for (const key of ['approval_received_date', 'cashless', 'surveyor_name', 'surveyor_phone', 'surveyor_email']) {
  assert.ok(operations.includes('name: "' + key + '"'), 'Operations missing ' + key);
  assert.ok(stageFields.includes('key: "' + key + '"'), 'Customer missing ' + key);
}
assert.ok(operations.includes('work_approval: ["approval_received_date", "cashless"]'));
assert.ok(stageFields.includes('label: "Surveyor Name", type: "text", optional: true'));
assert.ok(stageFields.includes('label: "Surveyor Phone", type: "tel", optional: true'));
assert.ok(stageFields.includes('label: "Surveyor Email", type: "email", optional: true'));

// Both portals use 34px rectangular fields while keeping the claim workflow unchanged.
assert.ok(operations.includes('flex h-[34px] cursor-pointer'));
assert.ok(operations.includes('vehicleDeliveryCompact ? "h-[34px] max-w-full px-3"'));
assert.ok(operations.includes('rounded-[4px]'));
assert.ok(customer.includes('className="mt-1 block h-[34px] min-w-0 w-full rounded-[4px]'));
assert.ok(customer.includes('<CustomerClaimBooleanChoice compact name={field.key}'));
assert.ok(choice.includes('h-[34px] rounded-[4px]'));
assert.ok(operations.includes('onClick={(event) => event.currentTarget.showPicker?.()}'));
assert.ok(customer.includes('required={!field.optional}'));

// Actions keep Cancel and Save alongside each other and reserve Save width while pending.
assert.ok(customer.includes('mt-4 flex min-h-10 flex-wrap items-center justify-end gap-2 border-t'), "Actions retain dedicated wrapping footer space.");
assert.ok(submit.includes('variant === "continue" ? "min-w-[148px]"'));
assert.ok(operations.includes('selected.key === "work_approval" ? "Save & Continue"'));
assert.ok(operations.includes('nextStageKey: nextStageKeyFor(milestoneKey)'));

// Completed Stage 4 edits must advance to Stage 5, while all other completed
// stage edit rules and server-side validation remain intact.
assert.ok(actions.includes('editingCompleted && key !== "work_approval"'));
assert.ok(actions.includes('const next=INTERNAL_JOURNEY_STAGES[index+1]'));
assert.match(actions, /if\s*\(!previous\s*\|\|\s*!\["completed",\s*"not_applicable"\]\.includes\(previous\.milestone_status\)\)/);
assert.ok(actions.includes('if (error)'));
assert.ok(submit.includes('if (result.error)'));
assert.ok(submit.includes('if (result.destination) router.push(result.destination)'));

console.log("Stage 4 compact Work Approval layout and guarded next-stage navigation regression passed.");
