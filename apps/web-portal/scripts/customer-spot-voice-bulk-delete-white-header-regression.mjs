import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const read = p => readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");

const evidence=read("../components/customer-portal/customer-claim-evidence-workspace.tsx");
const voice=read("../components/customer-portal/customer-claim-voice-recorder.tsx");
const saved=read("../components/customer-portal/customer-claim-saved-voice-notes.tsx");
const bulk=read("../components/customer-portal/customer-claim-multiple-upload.tsx");
const button=read("../components/customer-portal/customer-spot-attachment-delete.tsx");
const action=read("../app/customer/(protected)/claims/[id]/stage/[stage]/delete-document-action.ts");
const header=read("../components/customer-portal/customer-claim-stage-strip.tsx");
const spot=read("../app/customer/(protected)/spot-intimation/page.tsx");
const stage=read("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
const completed=read("../components/customer-portal/customer-internal-completed-journey.tsx");

assert.doesNotMatch(evidence,/label:"Incident Voice Note",type:"Incident Voice Note"/, "Voice note must not appear in Claim Documents.");
assert.match(evidence,/<CustomerClaimMultipleUpload documents=\{multipleDocuments\}/, "Only bulk-uploaded Other Documents appear in the dashed upload area.");
assert.match(evidence,/normalize\(doc\.document_type\) === "otherdocument"/, "Categorized attachments stay out of bulk file list.");
assert.match(bulk,/<CustomerSpotAttachmentDelete accountId=\{accountId\}/, "Bulk rows retain guarded deletion controls.");
assert.match(bulk,/file\.document_type\.toLowerCase\(\)\.replace/, "Only supported document categories can expose delete.");
assert.match(voice,/<CustomerClaimSavedVoiceNotes documents=\{documents\}/, "Uploaded recordings belong to voice-note section.");
assert.match(saved, /<audio controls preload="none"/, "Saved voice recordings retain playable audio.");
assert.match(saved, /<CustomerSpotAttachmentDelete accountId=\{accountId\}/, "Saved voice notes have a conditional delete control.");
assert.doesNotMatch(voice,/<Play className=/, "Remove redundant blue play icon from recording preview.");
assert.match(spot, /<CustomerClaimVoiceRecorder claimId=\{claim.id\} accountId=\{account.id\} documents=\{documents\}/);
assert.match(stage, /<CustomerClaimVoiceRecorder claimId=\{claim.id\} accountId=\{account.id\} documents=\{documents\}/);
assert.match(completed, /<CustomerClaimVoiceRecorder documents=\{spotDocuments\} claimId=\{claimId\} accountId=\{accountId\} allowUpload=\{false\}/, "Completed stages show voice notes without editing.");
assert.match(header, /rounded-lg bg-white text-\[#17365D\] shadow-/, "All six Claim Journey summary tiles use opaque white.");

assert.match(button,/ClaimDocumentDeleteConfirmation/, "Require explicit delete confirmation.");
assert.match(button,/CustomerErrorDialog/, "Display failure without removing the row.");
assert.match(button,/router\.refresh\(\)/, "Refresh document list after successful delete.");
assert.match(action,/resolveCustomerWebScope\(accountId\)/, "Authenticate Customer account.");
assert.match(action,/loadCustomerClaimDetail\(account.id, claimId\)/, "Check claim ownership.");
assert.match(action,/completedStageCount \?\? 0\) >= 2/, "Respect Stage 2 document lock.");
assert.match(action, /\["Settled", "Closed", "Claim Complete"\]/, "Block final claims.");
assert.match(action,/\["otherdocument", "incidentvoicenote", "audio", "voicenote", "incidentaudio"\]/, "Allow deletion only in requested categories.");
assert.match(action,/file\.verification_status !== "pending"/, "Do not delete reviewed records.");
assert.match(action,/\.eq\("document_type", file\.document_type\)\.eq\("verification_status", "pending"\)/, "Protect against verification races.");
assert.match(action,/\.eq\("id", file\.id\)\.eq\("claim_id", claim\.id\)\.eq\("customer_id", account\.id\)/, "Delete exact customer claim document only.");
assert.match(action,/\.remove\(\[file\.storage_path\]\)/, "Clean up deleted file from storage.");
assert.doesNotMatch(action,/createSupabaseAdminClient\(\).*from\("claims"\)\.update/, "No unrelated claim modifications.");

console.log("Customer Spot voice-note placement, bulk delete guards, and white header icons passed.");
