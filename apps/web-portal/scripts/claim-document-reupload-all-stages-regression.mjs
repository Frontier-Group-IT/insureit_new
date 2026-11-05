import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const stage1 = read("../components/spot-survey/bulk-document-verification-group.tsx");
const stage3 = read("../components/final-documents/stage3-document-verification-group.tsx");
const stage3Workspace = read("../components/final-documents/final-documents-workspace-v2.tsx");
const verificationButton = read("../components/spot-survey/verification-action-button.tsx");
const requestButton = read("../components/spot-survey/request-customer-document-reupload-button.tsx");
const server = read("../app/claims/[id]/spot-survey-actions.ts");
const operations = read("../app/claims/[id]/page.tsx");

assert.doesNotMatch(stage1, /RequestCustomerDocumentReuploadButton/, "Stage 1 rows must not display the removed customer re-upload icon.");
assert.match(stage3, /<RequestCustomerDocumentReuploadButton claimId=\{claim\.id\} documentId=\{document\.id\} fileName=\{document\.file_name\}/, "Stage 3 must retain its existing exact-document customer re-upload action.");
for (const source of [stage1, stage3]) {
  assert.match(source, /document\.verification_status !== "rejected" && \(document\.verification_status === "verified" \|\| Boolean\(verification\?\.is_valid\)\)/, "An explicitly rejected document must not remain visually verified from historical verification.");
}
assert.match(stage3, /<VerificationActionButton[^\n]*variant="icon"/, "Stage 3 pending verification must keep its dedicated icon action.");
assert.match(stage3, /!rejected && !verified \? <VerificationActionButton/, "Only pending non-rejected documents should offer verification; verified and rejected files must not show the button.");
assert.match(verificationButton, /<FileCheck2/, "Stage 3 verification icon must not reuse the circular re-upload icon.");
assert.doesNotMatch(verificationButton, /<RefreshCw/, "Circular refresh icon is reserved for customer re-upload.");
assert.match(requestButton, /createPortal\(/, "The request dialog must escape document-card stacking contexts.");
assert.match(requestButton, /document\.body/, "The request dialog must be attached to document.body.");
assert.match(requestButton, /requestSpotSurveyDocumentReupload\(formData\)/, "The re-upload dialog must submit the existing authorized server action.");
assert.match(server, /data\.claim_service_mode === "self_managed" && access\.isPartner/, "All self-managed document requests must remain restricted to authorized Operations, never Partners.");
assert.match(server, /\.eq\("id", documentId\)\.eq\("claim_id", claimId\)/, "Document re-upload must be claim-scoped.");
assert.match(server, /event_type: "claim_document_reuploaded"/, "Re-upload requests must retain Customer activity notification behavior.");
assert.match(stage3Workspace, /document\.verification_status !== "rejected" && \(document\.verification_status === "verified" \|\| Boolean\(verification\?\.is_valid\)\)/, "Stage 3 header counts must respect rejected document status.");
assert.match(operations, /<SpotSurveyWorkspace/, "Operations Stage 1 must remain shared for internal and external claims.");
assert.match(operations, /<FinalDocumentsWorkspaceV2/, "Operations Stage 3 must remain shared for internal and external claims.");
console.log("Operations Stage 1/3 internal/external re-upload and pending-only Stage 3 verification regressions passed.");
