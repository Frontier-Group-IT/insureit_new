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
assert.ok(form.includes('aria-label="Policy number" className={inputClass} value={form.policyNumber} onChange={event=>set("policyNumber",event.target.value.toUpperCase())}'), "Issued policy number should be directly editable");
assert.ok(!form.includes("policyNumberUnlocked") && !form.includes("setPolicyNumberUnlocked"), "Policy number must not require a separate Change/Lock control");
assert.ok(!form.includes('readOnly={!policyNumberUnlocked}'), "Policy number must not be read-only by default");
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
assert.ok(form.includes('useState<"activity"|"remarks">("activity")'), "Activity Status remains selected by default");
assert.ok(form.includes('useState(false)') && form.includes('const [infoExpanded,setInfoExpanded]'), "Selected activity starts collapsed");
assert.ok(form.includes('onClick={()=>setInfoExpanded(current=>!current)}'), "Whole section header must expand or collapse");
assert.ok(form.includes('setInfoExpanded(current=>infoTab==="activity"?!current:true);setInfoTab("activity")'), "Activity Status toggle supports selecting and collapsing");
assert.ok(form.includes('setInfoExpanded(current=>infoTab==="remarks"?!current:true);setInfoTab("remarks")'), "Remarks toggle supports selecting and collapsing");
assert.ok(form.includes('infoExpanded?<div id="issued-policy-info-panel"'), "Collapsed status must hide the content panel");
assert.ok(form.includes('bg-[#17365D] text-white') && form.includes('rounded-xl border px-4'), "Selected status button must have navy background and rounded button styling");
assert.ok(form.includes('hover:bg-[#EEF4FC]') && form.includes('aria-expanded={infoExpanded}'), "Hover styling and full section expansion state must remain accessible");
assert.ok(form.includes('<StandardActivityStatusCard items={activityItems} emptyText="Activity not recorded" embedded/>'), "Embedded Activity Status must not render a duplicated accordion heading");
assert.ok(!form.includes('emptyText="Activity not recorded" open'), "Activity Status must not be forced open");
const issuedSection = form.slice(form.indexOf('<Section number="04" title="Issued policy details">'), form.indexOf('</Section>',form.indexOf('<Section number="04" title="Issued policy details">')));
const issuedLabels = [...issuedSection.matchAll(/(?:<Field|<Select) label="([^"]+)"|<label className=\{labelClass\}>Remarks<\/label>/g)].map(match=>match[1]||"Remarks");
assert.deepEqual(issuedLabels.slice(-5), ["Final premium","Sum assured / insured","Case premium amount","Payment mode","Remarks"], "Case premium follows sum insured in row two, with payment mode and remarks on row three");
assert.ok(!issuedSection.includes('md:grid-cols-3 xl:col-span-4 xl:grid-cols-3'), "Remove the former nested three-column premium/payment row");
assert.ok(form.includes('label="Case premium amount"') && form.includes('label="Payment mode"') && form.includes('>Remarks</label>'), "The row retains Premium Amount, Payment Mode and Remarks labels");
assert.ok(form.includes('>Add Remark</button>') && !form.includes('>Open</span></button>'), "Remarks field uses a single Add Remark button without redundant Open text");
assert.ok(form.includes('setRemarksModalOpen(false);\n        setInfoTab("remarks");\n        setInfoExpanded(true);'), "Saving an added remark must display the expanded Remarks history immediately");
assert.ok(!form.includes('Saved remarks · Read only') && form.includes('{savedRemarks.trim()||"No remarks added yet."}'), "Remove redundant saved remarks caption but retain saved history");
assert.ok(!form.includes('set("remarks",e.target.value)'), "Previously saved remarks must not be editable");
assert.ok(form.includes('appendIssuedLifeHealthRemark(data)') && form.includes('role="dialog" aria-modal="true" aria-label="Add policy remark"'), "New remarks use the authorized add-only popup");
assert.ok(action.includes('export async function appendIssuedLifeHealthRemark'), "Remark append must be authorized on the server");
assert.ok(action.includes('await requirePolicyEditor(policyId)') && action.includes('validatePolicyCase(policyId,caseId)'), "Remark append checks policy permissions and case linkage");
const policyUpdates = action.slice(action.indexOf('export async function updateIssuedLifeHealthPolicy('), action.indexOf('/**\n * Append a new Life/Health'));
assert.ok(!policyUpdates.includes('    remarks: remarks || null,\n    updated_at: new Date().toISOString(),'), "Normal policy save cannot overwrite historical remarks");
console.log("Life/Health issued edit parity regression passed.");
