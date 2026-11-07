import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const operations = read("../components/claim-manager/operations-claim-stages.tsx");
const customer = read("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
const actions = read("../app/customer/(protected)/claims/[id]/stage/[stage]/actions.ts");
const choice = read("../components/customer-portal/customer-claim-boolean-choice.tsx");
const submit = read("../components/customer-portal/customer-claim-stage-submit.tsx");
const stageFields = read("../lib/customer-claim-stage-fields.ts");

// Both views have five equally-sized columns and a descriptive Stage 4 heading.
for (const source of [operations, customer]) {
  assert.ok(source.includes('Stage 4 — Work Approval'));
  assert.ok(source.includes('Record insurance approval and surveyor details'));
  assert.ok(source.includes('4 of 9'));
}
assert.ok(operations.includes('lg:grid-cols-3 xl:grid-cols-5 lg:items-start'), 'Operations Stage 4 should fit five fields at xl width');
assert.ok(customer.includes('lg:grid-cols-3 xl:grid-cols-5 lg:items-start'), 'Customer Stage 4 should also align five fields at wide desktop widths');
for (const key of ['approval_received_date', 'cashless', 'surveyor_name', 'surveyor_phone', 'surveyor_email']) {
  assert.ok(operations.includes('name: "' + key + '"'), 'Operations missing ' + key);
  assert.ok(stageFields.includes('key: "' + key + '"'), 'Customer missing ' + key);
}
assert.ok(operations.includes('work_approval: ["approval_received_date", "cashless"]'));
assert.ok(stageFields.includes('label: "Surveyor Name", type: "text", optional: true'));
assert.ok(stageFields.includes('label: "Surveyor Phone", type: "tel", optional: true'));
assert.ok(stageFields.includes('label: "Surveyor Email", type: "email", optional: true'));

// Both portals use 34px rectangular fields and five desktop columns.
assert.ok(operations.includes('h-[34px]'));
assert.ok(!operations.includes('h-[40px]'));
assert.ok(operations.includes('rounded-[4px]'));
assert.ok(operations.includes('className="mt-1 grid w-full grid-cols-2 gap-2"'));
assert.ok(customer.includes('customer-claim-ref-field min-w-0 block w-full'));
assert.ok(customer.includes('h-[34px] w-full'));
assert.ok(customer.includes('<CustomerClaimBooleanChoice compact name={field.key}'), "All Customer stage choices use compact controls.");
assert.ok(choice.includes('h-[34px] rounded-[4px]'));
assert.ok(operations.includes('onClick={(event) => event.currentTarget.showPicker?.()}'));
assert.ok(customer.includes('required={!field.optional}'));

// Actions keep Cancel and Save alongside each other and reserve Save width while pending.
assert.ok(customer.includes('selected.key==="work_approval"?"mt-5 flex min-h-10 items-center justify-end'));
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
