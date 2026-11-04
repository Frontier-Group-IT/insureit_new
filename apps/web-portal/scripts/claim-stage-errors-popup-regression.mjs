import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function load(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

const shared = await load("../components/claim-manager/claim-stage-error-dialog.tsx");
const stages = await load("../components/claim-manager/operations-claim-stages.tsx");
const documents = await load("../components/final-documents/final-documents-workspace-v2.tsx");
const stage3Rows = await load("../components/final-documents/stage3-document-verification-group.tsx");
const spotRows = await load("../components/spot-survey/bulk-document-verification-group.tsx");
const surveyDone = await load("../components/spot-survey/survey-done-button.tsx");
const reuse = await load("../components/spot-survey/reuse-policy-copy-button.tsx");
const replace = await load("../components/spot-survey/replace-document-button.tsx");
const reupload = await load("../components/spot-survey/request-customer-document-reupload-button.tsx");
const claimPage = await load("../app/claims/[id]/page.tsx");

assert.match(shared, /role="alertdialog"/, "Errors must use an accessible alert dialog");
assert.match(shared, /aria-modal="true"/, "Dialogs must be modal");
assert.match(shared, /createPortal\(/, "Error popup must escape stage scroll and stacking containers");
assert.match(shared, /document\.body/, "Dialog must render above the claim view");
assert.match(shared, /onClick=\{onClose\}/, "OK must dismiss the error");
assert.match(shared, />\s*OK\s*</, "Dialog must display an OK button");
assert.match(shared, /okRef\.current\?\.focus\(\)/, "Dialog must receive keyboard focus");

assert.match(claimPage, /<OperationsClaimStages/, "Internal and External claims must use the same operations journey");
assert.match(claimPage, /externalCustomerMilestones/, "External claim stage support must remain");
assert.match(stages, /<ClaimStageErrorDialog/, "Operations stage errors must use popup");
assert.match(stages, /onInvalidCapture=\{\(event\) => \{ event\.preventDefault\(\); setErrorNotice/, "Other stage required-field validation must open popup");
assert.match(stages, /onInvalidField=\{\(message\) => setErrorNotice\(message\)\}/, "Spot Intimation required-field validation must open popup");
assert.doesNotMatch(stages, /<div className="fixed inset-0 z-\[1000\]/, "No duplicate embedded stage error dialog");

assert.match(documents, /<ClaimStageErrorDialog/, "Final Documents stage errors must use popup");
assert.doesNotMatch(documents, /\{result && !result\.ok \? <p role="alert"/, "Final Documents action errors cannot be inline");
assert.doesNotMatch(documents, /\{claimNumberError \? <p role="alert"/, "Claim-number errors cannot be inline");
assert.match(documents, /message=\{claimNumberError \|\|/, "Claim-number validation must display a popup");
assert.match(documents, /setResult\(\{ ok: false/, "Stage failures must retain exact error feedback");
for (const [file, label] of [[stage3Rows, "Stage 3 documents"], [spotRows, "Spot Survey documents"]]) {
  assert.match(file, /<ClaimStageErrorDialog/, label + " delete failures must use popup");
  assert.doesNotMatch(file, /window\.alert\(/, label + " cannot use browser alerts");
}
for (const [file, label] of [[surveyDone, "Survey completion"], [reuse, "Policy copy reuse"], [replace, "Document upload/replacement"], [reupload, "Customer reupload request"]]) {
  assert.match(file, /<ClaimStageErrorDialog/, label + " failures must use popup");
}
assert.doesNotMatch(surveyDone, /<p className="max-w-\[260px\] text-right text-\[11px\] font-semibold text-red-600"/, "Survey completion error must not be inline");
assert.doesNotMatch(reuse, /<span role="alert"/, "Policy-copy errors must not be inline");
assert.doesNotMatch(reupload, /<p role="alert"/, "Reupload request error must not be inline");
assert.match(replace, /result\?\.ok \? <p/, "Successful uploads can retain non-error confirmation");
assert.doesNotMatch(replace, /result \? <p className/, "Failed uploads cannot use inline banners");

console.log("Internal and External claim stage error-dialog regression passed.");
