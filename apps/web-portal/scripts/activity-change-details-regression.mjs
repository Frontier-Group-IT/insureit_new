import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { activityChangeTitle, describeAuditedChanges, describeNamedChanges } from "../lib/activity-change-details.ts";

const customer = describeAuditedChanges("customer",
  { phone: "9876543210", email: "old@example.com", address: "Private home", customer_type: "individual", pan: "AAAAA1234A" },
  { phone: "9123456789", email: "new@example.com", address: "New private home", customer_type: "corporate", pan: "BBBBB4321B" },
);
assert.ok(customer);
assert.ok(customer.some(row => row.includes("Mobile number: ••••••3210 → ••••••6789")));
assert.ok(customer.some(row => row.includes("Customer type: individual → corporate")));
assert.ok(customer.some(row => row.includes("Address changed (values hidden)")));
assert.ok(!customer.join(" ").includes("9876543210"));
assert.ok(!customer.join(" ").includes("Private home"));
assert.ok(!customer.join(" ").includes("AAAAA1234A"));
assert.equal(describeAuditedChanges("customer", null, { phone: "9123456789" }), null);
assert.deepEqual(describeAuditedChanges("vehicle", { make:"Tata", chassis_no:"secret" }, { make:"Mahindra", chassis_no:"other" }), ["Manufacturer: Tata → Mahindra", "Chassis number changed (values hidden)"]);
assert.deepEqual(describeNamedChanges("vehicle", ["make", "chassis_no", "password", "make"]), ["Manufacturer changed (values not recorded)", "Chassis number changed (values not recorded)"]);
assert.match(activityChangeTitle("Customer",null), /details not recorded/);
assert.match(activityChangeTitle("Customer",customer), /other fields changed/);
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
for (const path of ["../components/customer-activity-status.tsx", "../components/vehicle-activity-status.tsx", "../components/policy-activity-status.tsx"]) {
  assert.match(read(path), /changes: activity\.changes/, path + " must render audit changes");
}
assert.match(read("../components/standard-activity-status-card.tsx"), /item\.changes\?\.length/, "shared UI must render individual changes");
assert.match(read("../lib/customer-activity.ts"), /describeAuditedChanges\("customer"/, "customer audits must use recorded old/new snapshots");
assert.match(read("../lib/vehicle-activity.ts"), /describeAuditedChanges\("vehicle"/, "vehicle audits must not invent differences");

const policyActivity = read("../lib/policy-activity.ts");
const policyEdit = read("../app/policies/policy-edit-actions.ts");
const caseEdit = read("../app/policies/life-health-case-edit-actions.ts");
const casePage = read("../app/policies/life-health-cases/[id]/page.tsx");
const caseDetail = read("../components/life-health-case-detail.tsx");
const claimActivity = read("../components/claim-activity-status.tsx");
const claimPage = read("../app/claims/[id]/page.tsx");

assert.match(policyActivity, /cpa_amount: "CPA amount"/, "CPA amount must be tracked independently");
assert.match(policyActivity, /describePolicyEditChanges/, "Policy edits must store actual changed source fields");
assert.match(policyEdit, /describePolicyEditChanges\(activityBefore, activityAfter\)/, "Policy edit action must use safe old/new details");
assert.match(policyActivity, /premiumSourceChanged/, "Derived pay-in review resets must not replace manual CPA edits");
for(const column of ["premium.net_premium","premium.gst_amount","premium.gross_premium","policy.premium_amount","payin.total_projected_payin"]){
  assert.ok(policyActivity.includes('"'+column+'"'), column+" must be treated as a calculated value");
}
assert.match(policyActivity, /formatAuditedPremiumValue/, "Approved premium amounts must be formatted");
assert.match(policyActivity, /field.includes\(" → "\)/, "Formatted before/after entries must not be overwritten by legacy display text");
assert.match(caseEdit, /life_health_case_edited/, "Case changes must create their own audit event");
assert.match(caseEdit, /const changes: string\[\]/, "Case editor must compare user-editable values");
assert.match(casePage, /caseEditAudits/, "Case Register must read edit events after record authorization");
assert.match(caseDetail, /activity.changes\?\.length/, "Case Activity Status must render changed values");
assert.match(claimActivity, /claim_status_history/, "Claim Activity Status must read recorded claim transitions");
assert.match(claimActivity, /claim_stage_details/, "Claim Activity Status must compare saved stage details");
assert.match(claimActivity, /const LABELS/, "Claim audit must use a strict visible-field allowlist");
assert.doesNotMatch(claimActivity, /notes.*return|\.changes:.*notes/, "Claim status notes must not leak personal details");
assert.match(claimPage, /<ClaimActivityStatus claimId=\{claim.id\}/, "Claim Activity Status should appear only after authorized claim lookup");

console.log("Activity change details regression passed.");
