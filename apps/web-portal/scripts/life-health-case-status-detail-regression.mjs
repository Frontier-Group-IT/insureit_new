import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const detail = read("../components/life-health-case-detail.tsx");
const page = read("../app/policies/life-health-cases/[id]/page.tsx");
const rejectAction = read("../app/policies/life-health-case-reject-actions.ts");
const editAction = read("../app/policies/life-health-case-edit-actions.ts");

assert.doesNotMatch(detail, /if\(caseData\.status==="rejected"\)return/, "Rejected cases must not be reduced to a separate message-only page.");
assert.doesNotMatch(detail, /if\(isIssued\)return/, "Issued cases must retain the same detail layout.");
assert.match(detail, /isRejected=caseData\.status==="rejected",isClosed=isIssued\|\|isRejected/, "Only closed status should produce read-only case view.");
assert.match(detail, /headerTone=isRejected[\s\S]*?isIssued[\s\S]*?caseStatusLabel=/, "Rejected, issued and pending header colors must be distinct.");
assert.match(detail, /<fieldset disabled=\{isClosed\}/, "Closed cases must disable editing of every form field.");
assert.match(detail, /\{!isClosed\?<Section number="05" title="Mark Policy Issued"/, "Closed cases must not expose the issue form.");
assert.match(detail, /\{!isClosed\?<section className="flex flex-wrap items-center justify-end/, "Closed cases must not expose Save, Reject or Issue actions.");
assert.match(detail, /\{isClosed\?<div className="w-full col-span-full">/, "Closed cases must show saved documents without upload/delete actions.");
assert.match(detail, /href=\{`\/policies\/life-health-case-documents\/\$\{encodeURIComponent\(doc.id\)\}\/view`\}/, "Closed cases must preserve authorized links to view existing documents.");
assert.match(detail, /disabled=\{isClosed\|\|saving\|\|converting\|\|remarkPending\}/, "Closed cases cannot add new remarks.");
assert.doesNotMatch(detail, /Case Rejected — View Only|This case cannot be edited or issued\.|Rejection reason:/, "Rejected cases must not display the removed notice.");
assert.doesNotMatch(detail, /Back to cases/, "Remove the footer Back to cases button.");
assert.match(detail, /\{isIssued\?<div role="status"/, "Issued-case policy link remains accessible.");
assert.match(detail, /View issued policy/, "Preserve issued policy navigation.");
assert.match(detail, /<fieldset disabled=\{isClosed\}/, "Rejected cases remain read-only even without the notice.");
assert.match(detail, /<Section number="01" title="Policy source & ownership"/);
assert.match(detail, /<Section number="02" title="Customer \/ proposer"/);
assert.match(detail, /<Section number="03" title="Policy product & case details"/);
assert.match(detail, /<Section number="04" title="Premium & payment"/);
assert.match(detail, /Activity Status and Remarks/, "Read-only cases retain activity and remarks history.");
assert.match(detail, /caseStatusLabel=isRejected\?"Rejected":isIssued\?"Issued":"Pending"/, "Closed and pending cases must display the appropriate status label.");
assert.match(page, /final_policy_id,converted_at,created_at,created_by,converted_by,details/, "Case page reads stored rejection metadata.");
assert.match(page, /typeof rejection\.reason === "string"/, "Rejection reason must come from saved metadata, not a fabricated label.");
assert.match(rejectAction, /rejection: \{ reason, rejected_at: now, rejected_by: profile\.id \}/, "Existing rejection provenance remains authoritative.");
assert.match(editAction, /row\.final_policy_id \|\| row\.status === "rejected"/, "Backend still denies edits to closed cases.");
// Screenshot parity: rejected cases retain the same structured Operations case page,
// not the separate issued-policy editor redesign or a message-only rejection screen.
const referenceSections = [
  ['01', 'Policy source & ownership', 'md:grid-cols-2 xl:grid-cols-4'],
  ['02', 'Customer / proposer', 'md:grid-cols-2 xl:grid-cols-4'],
  ['03', 'Policy product & case details', 'md:grid-cols-2 xl:grid-cols-3'],
  ['04', 'Premium & payment', 'md:grid-cols-2 xl:grid-cols-3'],
];
let previousSection = -1;
for (const [number, title, columns] of referenceSections) {
  const section = `<Section number="${number}" title="${title}" contentClassName="${columns}"`;
  const position = detail.indexOf(section);
  assert.ok(position > previousSection, `Reference section ${number} (${title}) must retain its original order and desktop columns`);
  previousSection = position;
}
assert.match(detail, /headerTone=isRejected\?"bg-\[linear-gradient\(110deg,#991B1B_0%,#C43D42_100%\)\]"/, "Rejected case retains the screenshot's red header");
assert.match(detail, /caseStatusLabel=isRejected\?"Rejected"/, "Rejected badge is shown in the header");
assert.match(detail, /<section aria-label="Documents"/, "Documents remain below the case form");
assert.match(detail, /role="group" aria-label="Activity Status and Remarks"/, "Activity and Remarks remain below documents");
assert.match(detail, /const\[infoExpanded,setInfoExpanded\]=useState\(false\)/, "Activity/Remarks stay collapsed by default");
assert.ok(detail.indexOf('aria-label="Documents"') < detail.indexOf('aria-label="Activity Status and Remarks"'), "Document section precedes Activity/Remarks");
assert.doesNotMatch(detail, /isRejected\?\s*<LifeHealthIssuedPolicyEditForm/, "Rejected cases must never be replaced with the issued policy editor");
console.log("Life/Health case status colors and read-only full-detail regression passed.");
