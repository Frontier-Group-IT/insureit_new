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
console.log("Life/Health issued edit parity regression passed.");
