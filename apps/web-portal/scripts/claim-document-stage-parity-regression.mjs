import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const stage1Group = await readFile(new URL("../components/spot-survey/bulk-document-verification-group.tsx", import.meta.url), "utf8");
const stage3Group = await readFile(new URL("../components/final-documents/stage3-document-verification-group.tsx", import.meta.url), "utf8");
const collapsedStatus = await readFile(new URL("../components/claim-manager/claim-document-collapsed-status.tsx", import.meta.url), "utf8");
const stage3Workspace = await readFile(new URL("../components/final-documents/final-documents-workspace-v2.tsx", import.meta.url), "utf8");
const stage3Loader = await readFile(new URL("../components/final-documents/final-document-verification-data-actions.ts", import.meta.url), "utf8");
const claimPage = await readFile(new URL("../app/claims/[id]/page.tsx", import.meta.url), "utf8");
const claimWorkflow = await readFile(new URL("../lib/claim-workflow.ts", import.meta.url), "utf8");

for (const source of [stage1Group, stage3Group]) {
  assert.match(source, /type="checkbox"/, "Document cards must expose checkbox selection for pending files.");
  assert.match(source, /documentIds=\{selectedDocumentIds\}/, "Verify must receive the selected files as one group.");
  assert.match(source, /variant="header"/, "Verify must stay in the compact document-card header.");
  assert.match(source, /actionLabel="Upload" iconOnly/, "Populated document cards must keep the icon-only Upload New action.");
  assert.match(source, /<RequestReuploadButton claimId=\{claim\.id\} documentId=\{document\.id\}/, "Each file must keep its row-specific Reupload action.");
  assert.match(source, /<ReplaceDocumentButton claimId=\{claim\.id\} customerId=\{claim\.customer_id\} documentId=\{document\.id\}[\s\S]*?actionLabel="Replace"/, "Each file must keep exact-row Replace behavior.");
  assert.match(source, /item\.documents\.length > 1/, "Multiple files must use the compact collapsed category state.");
  assert.match(source, /ClaimDocumentCollapsedStatus/, "Collapsed multi-file cards must use the shared compact reference summary.");
  assert.match(source, /verifiedFileCount/, "Collapsed multi-file cards must calculate the verified-file count.");
  assert.match(source, /pendingFileCount/, "Collapsed multi-file cards must calculate the pending/unverified-file count.");
  assert.doesNotMatch(source, /FILES ARE UPLOADED/, "Collapsed multi-file cards must not restore the old large uploaded-file text.");
}

assert.match(collapsedStatus, /CheckCircle2/, "Compact collapsed summary must use the green check icon from the reference.");
assert.match(collapsedStatus, /Clock/, "Compact collapsed summary must use the orange clock icon from the reference.");
assert.match(collapsedStatus, /text-\[#16A34A\]/, "Verified count icon must retain the reference green treatment.");
assert.match(collapsedStatus, /text-\[#F97316\]/, "Pending count icon must retain the reference orange treatment.");
assert.match(collapsedStatus, /rounded-xl bg-\[#F0FAF4\]/, "Verified count must use the compact soft-green reference pill.");
assert.match(collapsedStatus, /rounded-xl bg-\[#FFF6EA\]/, "Pending count must use the compact soft-orange reference pill.");
assert.match(collapsedStatus, /inline-flex h-8 items-center/, "Both reference pills must remain compact rather than becoming large summary cards.");
assert.doesNotMatch(collapsedStatus, /h-4 w-px bg-\[#D9E3F0\]/, "Separated compact pills should replace the old standalone divider layout.");
assert.match(collapsedStatus, /data-claim-document-collapsed-status="true"/, "Shared summary must retain an explicit regression marker.");
assert.doesNotMatch(collapsedStatus, />\s*Verified\s*</, "Collapsed summary must not render the word Verified beside the count.");
assert.doesNotMatch(collapsedStatus, />\s*Pending\s*</, "Collapsed summary must not render the word Pending beside the count.");

assert.match(stage3Workspace, /Stage3DocumentVerificationGroup/, "Stage 3 must render through the parity document-card engine.");
assert.match(stage3Workspace, /loadFinalDocumentVerificationData\(claimId\)/, "Stage 3 must load live document and verification state for the shared controls.");
assert.match(stage3Workspace, /documentsForType\(verificationData\.documents, row\.type\)/, "Stage 3 cards must group all matching files, not only the latest file.");
assert.match(stage3Workspace, /matchesClaimIntimationDocument/, "Stage 3 grouping must use the canonical claim-intimation document matcher.");
assert.match(stage3Workspace, /\[claimId, rows\]/, "Stage 3 verification data must refresh after document mutations reflected by the server render.");

assert.match(stage3Loader, /hasEffectiveCapability\(profile, "manage_claims", "edit"\)/, "Stage 3 parity loader must require claim-management edit capability.");
assert.match(stage3Loader, /canAccessCustomer\(profile\.id, profile\.role, claim\.customer_id, "manage_claims"\)/, "Stage 3 parity loader must enforce customer-scope authorization.");
assert.match(stage3Loader, /claim\.claim_service_mode !== "broker_managed"/, "Stage 3 parity must remain within the broker-managed Operations boundary.");
assert.match(stage3Loader, /from\("external_policies"\)/, "External Claim Stage 3 must resolve external-policy validity dates.");
assert.match(stage3Loader, /from\("policies"\)/, "Internal Claim Stage 3 must resolve internal-policy validity dates.");
assert.match(stage3Loader, /from\("claim_document_verifications"\)/, "Stage 3 must load the same verification history used by Stage 1 behavior.");

assert.match(claimPage, /spotContent=\{<SpotSurveyWorkspace/, "Operations claim Stage 1 must keep the shared SpotSurveyWorkspace for broker-managed claims.");
assert.match(claimPage, /claimIntimationContent=\{<FinalDocumentsWorkspaceV2/, "Operations claim Stage 3 must use the shared final-document workspace for broker-managed claims.");
assert.match(claimPage, /claim\.policy_service_source === "external"[\s\S]*?claim\.claim_service_mode === "self_managed"/, "Only self-managed external claims may leave the shared broker-managed Operations journey.");

const verifiedStatusFunction = claimWorkflow.match(/export function verifiedStatusFor\(status: ClaimStatus\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(verifiedStatusFunction, "The document verification status guard must remain available.");
assert.match(verifiedStatusFunction, /Initial Documents Verification Pending/, "Initial-document verification must retain its secure finalization path.");
assert.doesNotMatch(verifiedStatusFunction, /Final Documents Verification Pending/, "Stage 3 verification must not call the initial-document advancement RPC.");
assert.doesNotMatch(verifiedStatusFunction, /Final Documents Submitted/, "Stage 3 verification must remain on the explicit Claim Intimation Save Details workflow.");
assert.match(claimWorkflow, /advance_initial_documents_verified RPC/, "The Stage 3 RPC boundary must be documented beside the status guard.");

console.log("Claim document Stage 1/Stage 3 Internal/External parity, compact pill status summary and workflow-boundary regression passed.");
