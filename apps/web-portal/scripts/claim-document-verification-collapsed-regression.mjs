import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync("components/spot-survey/spot-survey-workspace-v2.tsx", "utf8");
const page = readFileSync("app/claims/[id]/page.tsx", "utf8");
assert.match(page, /<SpotSurveyWorkspace /, "Keep the existing claim stage-one workspace");
assert.match(component, /<details data-claim-document-verification="true" className=/, "Document Verification must be expandable");
assert.ok(!component.slice(component.indexOf('<details data-claim-document-verification="true"'), component.indexOf(">", component.indexOf('<details data-claim-document-verification="true"'))).includes(" open"), "Document Verification must start collapsed");
const summary = component.slice(component.indexOf("<summary "), component.indexOf("</summary>")); assert.ok(summary.includes("Document Verification") && summary.includes("Documents Verified") && summary.includes("{verifiedCount} / {items.length}"), "Summary keeps heading and verification count visible");
const start = component.indexOf('<details data-claim-document-verification="true"');
const end = component.indexOf("</details>", start);
const panel = component.slice(start, end);
assert.ok(panel.indexOf("<summary") < panel.indexOf("BulkDocumentVerificationGroup"), "Document list must start inside expandable area");
assert.match(panel, /<BulkDocumentVerificationGroup /, "Preserve document verification actions");
assert.match(panel, /<ReusePolicyCopyButton /, "Preserve linked policy copy reuse");
assert.match(panel, /<FinalizeInitialDocumentVerificationButton /, "Preserve finalization workflow");
console.log("Operations Claim Document Verification collapsed-default regression passed");
