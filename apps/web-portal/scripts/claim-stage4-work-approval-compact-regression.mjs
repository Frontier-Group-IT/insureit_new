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
  assert.ok(source.includes('!grid-cols-5 min-w-[900px]'), "Stage 4 must retain five aligned columns on all viewport sizes.");
}
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
assert.ok(operations.includes('vehicleDeliveryCompact ? "h-[34px] max-w-[335px] px-3"'));
assert.ok(operations.includes('rounded-[4px]'));
assert.ok(customer.includes('className="mt-1 block h-[34px] min-w-0 w-full rounded-[4px]'));
assert.ok(customer.includes('<CustomerClaimBooleanChoice compact name={field.key}'));
assert.ok(operations.includes('overflow-x-auto'), "Operations Stage 4 must scroll without wrapping on narrow screens.");
assert.ok(customer.includes('overflow-x-auto'), "Customer Stage 4 must scroll without wrapping on narrow screens.");
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


// Start Claim has its own fields: preserve their labels/inputs in one horizontal row without adding Stage 4 questions.
const operationsStart = read("../app/claims/new/add-claim-form.tsx");
const customerStart = read("../components/customer-portal/customer-start-claim-selector.tsx");
const internalCompleted = read("../components/customer-portal/customer-internal-completed-journey.tsx");
assert.ok(operationsStart.includes('columns === "two" ? "grid-cols-2 min-w-[520px]"'), "Operations Start Claim inputs must remain on one row.");
assert.ok(operationsStart.includes('grid-flow-col auto-cols-[minmax(170px,1fr)]'), "Operations Start Claim read-only fields must not wrap.");
assert.ok(operationsStart.includes('min-w-0 overflow-x-auto'), "Operations Start Claim must scroll on narrow screens.");
assert.ok(customerStart.includes('grid min-w-[640px] grid-cols-4 items-start'), "Customer Start Claim policy headings and values must remain in one row.");
assert.ok(customerStart.includes('overflow-x-auto'), "Customer Start Claim policy summary must fit narrow screens without overlap.");
assert.ok(internalCompleted.includes('grid-flow-col auto-cols-[minmax(170px,1fr)] min-w-[900px]'), "Internal Customer Work Approval completed details must stay on one row.");
