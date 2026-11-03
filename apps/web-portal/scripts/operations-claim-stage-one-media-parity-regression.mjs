import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const stage = read("../components/claim-manager/operations-claim-stages.tsx");
const controls = read("../components/claim-manager/operations-claim-stage-one-attachments.tsx");
const operations = read("../app/claims/[id]/claim-document-upload-actions.ts");
const customerMultiple = read("../components/customer-portal/customer-claim-multiple-upload.tsx");
const customerVoice = read("../components/customer-portal/customer-claim-voice-recorder.tsx");
const page = read("../app/claims/[id]/page.tsx");
const readOnly = read("../components/claims/assistance-intake-panel.tsx");

assert.match(stage, /selected\.key === "spot_intimation"/, "Features belong to Stage 1.");
assert.match(stage, /<OperationsClaimStageOneAttachments claimId=\{claimId\}/, "Editable stage one must render the controls.");
assert.match(stage, /!partnerReadOnlyJourney && !partnerManagedJourney && !partnerInternalStageOne/, "Partner read-only/managed screens must not gain Operations upload controls.");
assert.match(page, /if \(claim\.claim_service_mode === "self_managed"\)/, "External self-managed claims must retain their isolated read-only route.");
assert.match(page, /<AssistanceIntakePanel/, "Customer-managed external claims must remain on their read-only viewer.");
assert.doesNotMatch(readOnly, /OperationsClaimStageOneAttachments/, "Read-only external viewer must never contain uploading actions.");

for (const label of ["Upload multiple documents", "Incident Voice Note", "Record Voice", "Choose audio", "Upload voice note"]) {
  assert.ok(controls.includes(label), `Missing customer-parity control: ${label}`);
}
assert.match(customerMultiple, /Upload multiple documents/, "Customer multi-upload reference must remain available.");
assert.match(customerVoice, /Record Voice/, "Customer voice recorder reference must remain available.");
assert.match(controls, /files\.length > \(voice \? 1 : 10\)/, "Uploads must be limited to ten documents, or one voice note.");
assert.match(controls, /prepareSpotSurveyMediaUpload/, "Videos must continue through the existing signed, validated spot-media endpoint.");
assert.match(controls, /prepareClaimDocumentUpload/, "Documents and audio must use the existing authorization-aware signed upload endpoint.");
assert.match(controls, /finalizeClaimDocumentUpload/, "Successful documents must be registered to the claim.");
assert.match(controls, /finalizeSpotSurveyMediaUpload/, "Successful videos must be registered to the claim.");
assert.match(controls, /cancelClaimDocumentUploads/, "Incomplete storage uploads must be recoverable.");
assert.match(controls, /navigator\.mediaDevices\.getUserMedia/, "Voice recording requires explicit microphone permission.");
assert.match(controls, /stream\.getTracks\(\)\.forEach/, "Microphone resources must be released.");
assert.match(operations, /requireClaimWorkflowAccess\(claimId/, "Claim upload actions must preserve workflow authorization.");
assert.match(operations, /data\.claim_service_mode !== "broker_managed"/, "Customer-managed external uploads must remain blocked server side.");
assert.match(operations, /expectedAudio = documentType === "Incident Voice Note"/, "Only the intended document category can upload audio.");
assert.match(operations, /allowedAudioTypes = \["audio\/mp4", "audio\/x-m4a", "audio\/m4a", "audio\/webm", "audio\/ogg"\]/, "Audio must be format-validated.");
assert.match(operations, /file\.size > maxDocumentSizeBytes/, "Voice uploads must obey the five megabyte server limit.");
assert.match(controls, /router\.refresh\(\)/, "Successful uploads must refresh claim evidence.");
console.log("Operations Stage 1 internal/external upload and voice parity regression passed.");
