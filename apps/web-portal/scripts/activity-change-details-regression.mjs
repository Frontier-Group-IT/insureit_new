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

assert.match(policyActivity, /insured_declared_value: "Sum insured \\/ IDV"/, "IDV must be an explicitly tracked policy field");
const approvedValues = policyActivity.slice(policyActivity.indexOf("const DISPLAYABLE_PREMIUM_VALUES"), policyActivity.indexOf("const DERIVED_PREMIUM_AUDIT_LABEL"));
assert.match(approvedValues, /"policy\\.insured_declared_value"/, "IDV old/new amounts must be explicitly allowlisted for audit storage");
assert.match(policyActivity, /"Sum insured \\/ IDV"\\]\\.includes\\(parsed\\[1\\]\\)/, "Audit reader must accept safely formatted historical IDV before/after values");
assert.match(policyActivity, /DISPLAYABLE_PREMIUM_VALUES\\.has\\(entry\\.key\\)/, "Approved IDV values must be formatted during change capture");
assert.match(policyActivity, /formatAuditedPremiumValue\\(entry\\.key,before\\[entry\\.key\\]\\)/, "Record previous IDV using numeric formatter");
assert.match(policyActivity, /formatAuditedPremiumValue\\(entry\\.key,after\\[entry\\.key\\]\\)/, "Record new IDV using numeric formatter");
assert.match(policyActivity, /Number\\.isFinite\\(amount\\) && amount >= 0 && amount <= 1000000000/, "IDV amounts must be bounded finite numbers");
assert.match(policyActivity, /const hidden=item\\.match\\(/, "Older IDV entries with hidden values remain readable without invented amounts");


assert.match(policyActivity, /entry\.key==="premium\.cpa_amount"/, "CPA source field must be detected independently from derived premium totals");
assert.match(policyActivity, /"premium\.cpa_amount"/, "Actual CPA amount remains on the approved before-after audit value allowlist");
assert.match(policyActivity, /\x60\$\{entry\.label\}: \$\{formatAuditedPremiumValue\(entry\.key,before\[entry\.key\]\)\} → \$\{formatAuditedPremiumValue\(entry\.key,after\[entry\.key\]\)\}\x60/, "CPA amount records its true previous and new values on future edits");
assert.match(policyActivity, /cpaChanges = changed\.filter\(field => activityLabel\(field\) === "CPA amount"\)/, "Only an explicitly audited CPA edit may receive the CPA headline");
assert.match(policyActivity, /return otherChanges \? \x60CPA amount changed \+ \$\{otherChanges\} more\x60 : "CPA amount changed"/, "CPA edits receive an explicit CPA amount changed headline");
assert.match(policyActivity, /if \(changed\.length === 1 && changed\[0\] === DERIVED_PREMIUM_AUDIT_LABEL\) return "Premium totals recalculated"/, "Legacy derived-only audit records must retain truthful historical headings");

assert.match(policyActivity, /describePolicyEditChanges/, "Policy edits must store actual changed source fields");
assert.match(policyEdit, /describePolicyEditChanges\(activityBefore, activityAfter\)/, "Policy edit action must use safe old/new details");
assert.match(policyActivity, /premiumSourceChanged/, "Derived pay-in review resets must not replace manual CPA edits");

for (const field of ["projected_od_percent: \"Pay-in OD rate\"", "projected_tp_percent: \"Pay-in TP rate\"", "od_payout_percent: \"Partner payout OD rate\"", "tp_payout_percent: \"Partner payout TP rate\""]) {
  assert.ok(policyActivity.includes(field), field + " must be tracked as an editable commercial source, without values");
}
assert.match(policyActivity, /sourceEntries\.length === 0 && entries\.some\(entry => DERIVED_PREMIUM_FIELDS\.has\(entry\.key\)\)/, "Derived-only snapshots must not be misreported as missing audit data");
assert.match(policyActivity, /LEGACY_DERIVED_PREMIUM_LABELS\.has\(item\)/, "Old derived-only audit rows must be identified without inventing source changes");
assert.match(policyActivity, /Premium totals recalculated/, "Derived-only audit events need an accurate summary");
assert.match(policyActivity, /Only calculated totals were recorded; the edited source and historical values are unavailable/, "Legacy derived-only audit must explain unavailable source values");
assert.doesNotMatch(policyActivity, /old_data: .*before|new_data: .*after/, "Raw policy snapshots must not be stored in audit logs");
const lifeIssuedEdit = read("../app/policies/life-health-issued-policy-edit-actions.ts");
for (const actionSource of [policyEdit, lifeIssuedEdit]) {
  assert.match(actionSource, /const activityChanges = describePolicyEditChanges\(activityBefore, activityAfter\)/, "Save should compute actual tracked changes");
  assert.match(actionSource, /activityChanges === null \|\| activityChanges\.length > 0/, "Confirmed no-op save must not create misleading policy edit event");
}

assert.match(policyActivity, /cpaAmountChanged && entry.key==="premium.cpa_opted"/, "CPA-only editing must not create a second automatic CPA toggle event");
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
