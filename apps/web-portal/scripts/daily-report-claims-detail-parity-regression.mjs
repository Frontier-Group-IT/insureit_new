import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const source=read("../lib/reports/daily-self-activity.ts");
const panel=read("../components/reports/daily-self-activity-panel.tsx");
const rows=read("../components/reports/daily-activity-history-rows.tsx");
const deletion=read("../app/master-record-delete-actions.ts");
assert.match(rows,/const canOpen=\(row:SelfActivity\)=>row\.status==="Deleted"\|\|Boolean\(row\.href\)/,"Deleted history rows are clickable even when permanent deletion removed their href");
assert.match(rows,/if\(row\.status==="Deleted"\)/,"Deleted rows are handled before ordinary navigation");
assert.match(rows,/else setDeletedRecord\(row\)/,"Deleted customers and other non-claim records open a custom popup");
assert.match(rows,/role="dialog" aria-modal="true" aria-labelledby="daily-deleted-record-title"/,"Deleted-record popup uses accessible custom dialog");
assert.match(rows,/>Record not exist<\/h3>/,"Missing-record dialog shows requested title");
assert.match(rows,/>OK<\/button>/,"Missing-record dialog includes OK button");
assert.match(rows,/if\(isClaimActivity\)setDeletedClaim\(row\)/,"Existing deleted-claim historical details remain available");

assert.match(deletion,/if \(entity === "policy"\) \{[\s\S]*?\.from\("policies"\)[\s\S]*?\.select\("policy_no,policy_code,customer_id,vehicle_id,insurance_company_id"\)/,
  "Fetch source policy identity before permanent deletion");
assert.match(deletion,/\.from\("customers"\)\.select\("company_name,contact_name,legal_trade_name"\)/,
  "Capture customer name before permanent policy deletion");
assert.match(deletion,/\.from\("vehicles"\)\.select\("vehicle_no"\)/,
  "Capture vehicle registration before permanent policy deletion");
assert.match(deletion,/\.from\("insurance_companies"\)\.select\("name"\)/,
  "Capture insurance company name before permanent policy deletion");
assert.match(deletion,/\.\.\.deletedPolicyIdentity, rejected_policy_intake_links_cleared:/,
  "Store snapshot in the existing deletion audit, not a new master table");
assert.match(deletion,/if \(customer.error \|\| vehicle.error \|\| insurer.error\)/,
  "Abort policy deletion if audit-identity lookup fails");
assert.match(source,/if\(row.table==="policies" && row.status==="Deleted"\)/,
  "Only enrich deleted policies in scoped visible activity rows");
for (const field of ["policy_no","customer_name","vehicle_no","insurance_company_name"]) {
  assert.ok(source.includes("old."+field), "Read existing deletion snapshot field "+field);
}
assert.match(source,/Not retained \(deleted policy\)/,
  "Historic missing policy numbers must not be misrepresented by UUIDs");

assert.match(source,/select\("id,claim_no,insurer_claim_no,customers\(company_name,contact_name\),vehicles\(vehicle_no\)"\)/,"Lookup references only visible claims");
assert.match(source,/Array\.isArray\(claim\.customers\)\?claim\.customers\[0\]:claim\.customers/,"Handle object and array customer relations");
assert.match(source,/Array\.isArray\(claim\.vehicles\)\?claim\.vehicles\[0\]:claim\.vehicles/,"Handle object and array vehicle relations");
assert.match(source,/row\.claimCustomerName=customer\?\.contact_name/,"Render customer");
assert.match(source,/row\.claimVehicleNo=vehicle\?\.vehicle_no/,"Render vehicle");
assert.match(source,/verification\.is_valid/,"Only successful verification can label a status change");
assert.match(source,/delta>=0 && delta<=60_000/,"Never match distant verification");
assert.match(source,/recentVerified\.length===1/,"Do not guess if multiple verifications occurred");
assert.match(source,/event\.to_status==="Initial Documents Submitted"/,"Only relabel matching status transition");
assert.match(source,/matchingDocument\?\x60\$\{matchingDocument\} Verified\x60/,"Use documented verified type instead of generic status");
assert.doesNotMatch(panel,/>Claim No\.<\/th>/,"Remove Claim No. header in Claims details");
assert.doesNotMatch(rows,/<td[^>]*>\{customerField\(row\.claimInsurerNo\)\}<\/td>/,"Remove Claim No. data cell");
assert.match(panel,/text-\[#102846\]/,"Enabled pagination has readable dark text");
assert.match(panel,/text-\[#7b8ba2\]/,"Disabled pagination remains readable and distinct from enabled links");
assert.match(panel,/data\.page > 1 \? \(/,"Previous remains disabled on page one");
assert.match(panel,/data\.hasNext \? \(/,"Next remains disabled on final page");
assert.match(panel,/type="button" disabled title="Already on the first page"/,"First-page Previous uses native disabled semantics");
assert.match(panel,/type="button" disabled title="No more matching records"/,"Last-page Next uses native disabled semantics");
assert.match(rows,/claimControlNo/,"Keep control number");
assert.match(rows,/claimCustomerName/,"Keep customer column");
assert.match(rows,/claimVehicleNo/,"Keep vehicle column");
assert.doesNotMatch(source,/\.insert\(|\.update\(|\.upsert\(|\.delete\(/,"Read-only report source");
console.log("Daily Report Claims customer, vehicle, document verification and pagination regression passed.");
