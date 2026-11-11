import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");

const page = read("../app/policies/[id]/edit/page.tsx");
const form = read("../components/life-health-issued-policy-edit-form.tsx");
const action = read("../app/policies/life-health-issued-policy-edit-actions.ts");
const customer = read("../app/policies/life-health-issued-customer-edit-actions.ts");
const schedule = read("../lib/life-health-issued-schedule.ts");
const issuance = read("../components/life-health-case-detail.tsx");
const required = ["Proposal date","Address","Policy number","PPT end date","Next installment date"];
for (const label of required) {
  assert.ok(form.includes(label), "Policy Edit is missing Case Open & Issue field: " + label);
}
assert.match(page,/proposalDate:lifeHealthCase\.sourcing_date/);
assert.match(page, /meta: \[activity\.meta, activity\.actorName/, "Life/Health policy Activity Status must receive saved field changes, not only creator metadata.");
assert.match(page,/customerAddress:customer\.address/);
assert.match(page,/issuedSchedule\.ppt_end_date/);
assert.match(page,/issuedSchedule\.next_installment_date/);
// The Edit Policy screen must be compact without hiding date fields or weakening save rules.
for (const hidden of [
  "Policy end date calculation",
  "PPT end date calculation",
  "Term minus 1 day",
  "Same calendar day",
  "Manual override; calculated value:",
  "Changing an issued policy number requires confirmation and a unique number.",
]) assert.ok(!form.includes(hidden), "Unnecessary Edit Policy UI still visible: " + hidden);
assert.match(form, /const endDateMode: DateCalculationMode = "minusOne"/);
assert.match(form, /const pptEndDateMode: DateCalculationMode = "minusOne"/);
assert.match(form, /label="Policy end \/ maturity date" type="date"/);
assert.match(form, /label="PPT end date" type="date"/);
assert.match(form, /label="Next installment date" type="date"/);
assert.match(form, /window\.confirm\("Change the issued policy number/);
assert.match(form,/addYearsByMode\(next\.startDate,next\.pd,endDateMode\)/);
assert.match(form,/addYearsByMode\(next\.startDate,next\.ppt,pptEndDateMode\)/);
assert.match(form,/nextInstallmentFrom\(next\.startDate,next\.paymentFrequency\)/);
assert.match(form,/policyNumberUnlocked/);
assert.match(form,/confirmPolicyNumberChange/);
assert.match(form,/dateApprovalRequired/);
assert.match(action,/sourcing_date: proposalDate/,"Proposal date must not be overwritten by issuance date");
assert.match(action,/issuance_date: sourcingDate/,"Issuance date must remain distinct");
assert.match(action,/policy_no_normalized/,"Unique normalized policy number must be persisted");
assert.match(action,/\.neq\("id",policyId\)/,"Duplicate checks exclude only the current policy");
assert.match(action,/policyNumberConfirmed/);
assert.match(action,/ppt_end_date:/);
assert.match(action,/next_installment_date:/);
assert.match(customer,/address: customerAddress/);
assert.match(customer,/address_street: customerAddress/);
assert.match(schedule,/DateCalculationMode/);
assert.match(issuance,/function addYearsByMode/);
// The fourth section is now Issued Policy; premium and payment stay editable there.
assert.ok(!form.includes('title="Premium & payment"'), "Standalone Premium & payment section must be removed");
assert.ok(form.includes('<Section number="04" title="Issued policy details">'), "Issued policy must be section four");
assert.ok(form.includes('xl:grid-cols-4') && form.includes('label="Sum assured / insured"') && form.includes('label="Case premium amount"') && form.includes('label="Payment mode"'), "All amounts and payment mode remain together in the issued policy section");
assert.ok(form.includes('role="tablist"') && form.includes('useState<"activity"|"remarks">("activity")'), "Activity Status is the selected default tab");
assert.ok(form.includes('Saved remarks · Read only') && !form.includes('set("remarks",e.target.value)'), "Previously saved remarks must not be editable");
assert.ok(form.includes('appendIssuedLifeHealthRemark(data)') && form.includes('role="dialog" aria-modal="true" aria-label="Add policy remark"'), "New remarks use the authorized add-only popup");
assert.ok(action.includes('export async function appendIssuedLifeHealthRemark'), "Remark append must be authorized on the server");
assert.ok(action.includes('await requirePolicyEditor(policyId)') && action.includes('validatePolicyCase(policyId,caseId)'), "Remark append checks policy permissions and case linkage");
const policyUpdates = action.slice(action.indexOf('export async function updateIssuedLifeHealthPolicy('), action.indexOf('/**\n * Append a new Life/Health'));
assert.ok(!policyUpdates.includes('    remarks: remarks || null,\n    updated_at: new Date().toISOString(),'), "Normal policy save cannot overwrite historical remarks");

// Real field-level activity data for Life and Health, including schedule edits.
assert.match(action, /const beforeChanges = await capturePolicyChangeSnapshot\(admin, policyId, true\)/);
assert.match(action, /const afterChanges = await capturePolicyChangeSnapshot\(admin, policyId, true\)/);
assert.match(action, /diffPolicyChangeSnapshots\(beforeChanges, afterChanges\)/);
assert.match(form, /<StandardActivityStatusCard items=\{activityItems\} emptyText="Activity not recorded" open detailed\/>/);
const changeReader = read("../lib/policy-activity-changes.ts");
for (const field of ["life.payment_frequency", "life.payment_mode", "life.premium_amount", "schedule.ppt_end_date", "schedule.next_installment_date"]) {
  assert.ok(changeReader.includes(field), "Track Life/Health field: " + field);
}
console.log("Life/Health issued edit parity regression passed.");
