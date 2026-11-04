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

for (const source of [stage1, stage3]) {
  assert.match(source, /<RequestCustomerDocumentReuploadButton claimId=\{claim\.id\} documentId=\{document\.id\} fileName=\{document\.file_name\}/, "Every Operations document row must offer the same exact-document customer re-upload dialog.");
  assert.match(source, /document\.verification_status !== "rejected" && \(document\.verification_status === "verified" \|\| Boolean\(verification\?\.is_valid\)\)/, "An explicitly rejected document must not remain visually verified from historical verification.");
}
assert.match(stage3, /<VerificationActionButton[^\n]*variant="icon"/, "Reverification must remain a separate Stage 3 action.");
assert.match(stage3, /!rejected \? <VerificationActionButton/, "Rejected files must require replacement instead of attempting to reverify.");
assert.match(verificationButton, /<FileCheck2/, "Stage 3 Reverify must not reuse the circular re-upload icon.");
assert.doesNotMatch(verificationButton, /<RefreshCw/, "Circular refresh icon is reserved for customer re-upload.");
assert.match(requestButton, /createPortal\(/, "The request dialog must escape document-card stacking contexts.");
assert.match(requestButton, /document\.body/, "The request dialog must be attached to document.body.");
assert.match(requestButton, /requestSpotSurveyDocumentReupload\(formData\)/, "The re-upload dialog must submit the existing authorized server action.");
assert.match(server, /data\.claim_service_mode !== "broker_managed" && \(data\.policy_service_source !== "external" \|\| access\.isPartner\)/, "External self-managed document requests must be authorized only for Operations, not Partners.");
assert.match(server, /\.eq\("id", documentId\)\.eq\("claim_id", claimId\)/, "Document re-upload must be claim-scoped.");
assert.match(server, /event_type: "claim_document_reuploaded"/, "Re-upload requests must retain Customer activity notification behavior.");
assert.match(stage3Workspace, /document\.verification_status !== "rejected" && \(document\.verification_status === "verified" \|\| Boolean\(verification\?\.is_valid\)\)/, "Stage 3 header counts must respect rejected document status.");
assert.match(operations, /<SpotSurveyWorkspace/, "Operations Stage 1 must remain shared for internal and external claims.");
assert.match(operations, /<FinalDocumentsWorkspaceV2/, "Operations Stage 3 must remain shared for internal and external claims.");
console.log("Operations Stage 1/3 internal/external document re-upload and distinct reverify regressions passed.");
