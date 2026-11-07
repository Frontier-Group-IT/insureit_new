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
  assert.ok(source.includes('lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 lg:items-start'));
}
for (const key of ['approval_received_date', 'cashless', 'surveyor_name', 'surveyor_phone', 'surveyor_email']) {
  assert.ok(operations.includes('name: "' + key + '"'), 'Operations missing ' + key);
  assert.ok(stageFields.includes('key: "' + key + '"'), 'Customer missing ' + key);
}
assert.ok(operations.includes('work_approval: ["approval_received_date", "cashless"]'));
assert.ok(stageFields.includes('label: "Surveyor Name", type: "text", optional: true'));
assert.ok(stageFields.includes('label: "Surveyor Phone", type: "tel", optional: true'));
assert.ok(stageFields.includes('label: "Surveyor Email", type: "email", optional: true'));

// Unified reference dimensions apply to Stage 4 while retaining its five-column arrangement.
assert.ok(operations.includes('h-[40px]'));
assert.ok(operations.includes('max-w-[260px]'));
assert.ok(operations.includes('max-w-[320px]'));
assert.ok(operations.includes('selected.key === "payment_encashment" ? "gap-2" : "max-w-[254px] gap-[10px]"'), "Stage 4 retains its original max-width and gap while Stage 9 is compact.");
assert.ok(customer.includes('field.type==="date"?(selected.key==="repair_ri"?"":"max-w-[260px]")'), "Stage 4 retains date max-width while Repair/RI fills its column.");
assert.ok(customer.includes('h-9 w-full'), "Customer stage controls use 36px height.");
assert.ok(customer.includes('<CustomerClaimBooleanChoice compact name={field.key}'), "All Customer stages use compact Yes/No controls.");
assert.ok(choice.includes('h-9 rounded-md'), "Customer Yes/No controls use compact 36px height.");
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
