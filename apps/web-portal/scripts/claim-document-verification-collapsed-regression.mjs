import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync("components/spot-survey/spot-survey-workspace-v2.tsx", "utf8");
const page = readFileSync("app/claims/[id]/page.tsx", "utf8");

assert.match(page, /<SpotSurveyWorkspace /, "Keep the existing claim stage-one workspace");
const start = component.indexOf('<section data-claim-document-verification="true"');
const end = component.indexOf("</section>", start);
assert.ok(start >= 0 && end > start, "Document Verification must render as a permanently visible section");
const panel = component.slice(start, end);
assert.doesNotMatch(panel, /<details\b|<summary\b/, "The main Document Verification section must not collapse");
assert.match(panel, /Document Verification/, "Keep the Document Verification heading visible");
assert.match(panel, /Documents Verified/, "Keep the verified documents label");
assert.match(panel, /\{verifiedCount\} \/ \{items\.length\}/, "Keep the verification counter");
assert.match(panel, /<BulkDocumentVerificationGroup /, "Preserve document verification actions");
assert.match(panel, /<ReusePolicyCopyButton /, "Preserve linked policy copy reuse");
assert.match(panel, /<FinalizeInitialDocumentVerificationButton /, "Preserve finalization workflow");
const group = readFileSync("components/spot-survey/bulk-document-verification-group.tsx", "utf8");
assert.ok(group.includes("item.documents.length > 0 && item.documents.every((document) => isDocumentVerified(document, verifications)"), "Fully verified Stage 1 categories start expanded");
assert.ok(group.includes("setIsExpanded(!hasNoFiles && pendingFileCount === 0);"), "Stage 1 categories react to pending count changes");
assert.ok(group.includes(") : pendingFileCount > 0 ? ("), "No zero-pending verification summary pills for Stage 1");
assert.ok(group.includes("const showDocumentRows = !hasNoFiles && isExpanded;"), "Single-file and multi-file document rows stay hidden until expanded");
assert.ok(group.includes("<ClaimDocumentCollapsedStatus") && group.includes("verifiedCount={verifiedFileCount}") && group.includes("pendingCount={pendingFileCount}"), "Collapsed RC Copy shows verification counts");
console.log("Operations Claim Document Verification always-visible and all document categories collapsed-default regression passed");
