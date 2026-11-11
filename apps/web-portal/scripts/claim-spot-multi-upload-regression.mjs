import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspace = await readFile(new URL("../components/spot-survey/spot-survey-workspace-v2.tsx", import.meta.url), "utf8");
const bulkVerificationGroup = await readFile(new URL("../components/spot-survey/bulk-document-verification-group.tsx", import.meta.url), "utf8");
const uploader = await readFile(new URL("../components/spot-survey/spot-media-upload-button.tsx", import.meta.url), "utf8");
const replacementUploader = await readFile(new URL("../components/spot-survey/replace-document-button.tsx", import.meta.url), "utf8");
const actions = await readFile(new URL("../app/claims/[id]/spot-survey-actions.ts", import.meta.url), "utf8");
const uploadActions = await readFile(new URL("../app/claims/[id]/claim-document-upload-actions.ts", import.meta.url), "utf8");
const workflowAccess = await readFile(new URL("../lib/claim-workflow-access.ts", import.meta.url), "utf8");
const rcPrefill = await readFile(new URL("../app/claims/[id]/claim-rc-prefill-actions.ts", import.meta.url), "utf8");
const verificationCompat = await readFile(new URL("../app/claims/[id]/claim-document-verification-compat-actions.ts", import.meta.url), "utf8");
assert.match(verificationCompat, /requireClaimWorkflowAccess\(claimId, "You do not have permission to verify claim documents\."\)/, "Audio and generic document verification must retain claim-scoped authorization.");
assert.match(verificationCompat, /claim\.claim_service_mode !== "broker_managed"/, "Broker-managed verification remains allowed.");
assert.match(verificationCompat, /claimSource\?\.policy_service_source !== "external" \|\| isPartner/, "Self-managed document verification must be restricted to authorized non-Partner external Operations.");
assert.match(verificationCompat, /return await verifySpotSurveyDocument\(formData\)/, "Compatibility action must keep canonical verification and history writes.");


// RC prefill must match authorized Operations verification eligibility for external self-managed claims.
assert.match(rcPrefill, /requireClaimWorkflowAccess\(claimId, "Not permitted to verify RC for this claim\."\)/, "RC prefill must retain the claim-scoped authorization gate.");
assert.match(rcPrefill, /!isPartner && claim\.claim_service_mode === "self_managed" && linked\?\.policy_service_source === "external"/, "Only non-Partner Operations users may prefill RC details on self-managed external claims.");
assert.match(rcPrefill, /claim\.claim_service_mode !== "broker_managed" && !selfManagedExternalOperations/, "Existing broker-managed behavior must remain allowed.");
assert.match(rcPrefill, /linked\.customer_id !== claim\.customer_id/, "Vehicle lookup must continue enforcing claim/customer ownership.");

const insuranceCapacity = await readFile(new URL("../lib/insurance-verification-capacity.ts", import.meta.url), "utf8");
const insuranceCapacityAction = await readFile(new URL("../app/claims/[id]/insurance-verification-actions.ts", import.meta.url), "utf8");
const insuranceModal = await readFile(new URL("../components/spot-survey/insurance-verification-modal.tsx", import.meta.url), "utf8");
const verificationAction = await readFile(new URL("../components/spot-survey/verification-action-button.tsx", import.meta.url), "utf8");
const verificationDetails = await readFile(new URL("../components/spot-survey/document-verification-details-button.tsx", import.meta.url), "utf8");
const claimWorkflow = await readFile(new URL("../lib/claim-workflow.ts", import.meta.url), "utf8");
const customerClaimDetail = await readFile(new URL("../../mobile-app/app/customer/claim-detail.tsx", import.meta.url), "utf8");
const sharedClaimJourney = await readFile(new URL("../../../packages/claim-journey/src/index.ts", import.meta.url), "utf8");

// Operations claim journey: display customer/Operations claim attachments without hiding bulk file rows.
assert.match(workspace, /<Image src=\{claimHeaderIcons\.claim\} alt="" width=\{34\}/, "Header must use the existing claim illustration.");
assert.match(workspace, /rounded-xl border border-white bg-white/, "The Claim Journey heading icon must have an opaque white background.");
assert.match(workspace, /rounded-lg bg-white shadow-\[0_2px_6px_rgba\(0,12,42,\.14\)\]/, "Claim summary icon tiles must be white.");
assert.doesNotMatch(workspace, /documents\.length\} uploaded file/, "Remove redundant uploaded-file total from the Document Verification header.");
assert.match(workspace, /title="Customer Multiple Documents"/, "Customer bulk uploads must have a visible Operations section.");
assert.match(workspace, /document_type\?\.trim\(\)\.toLowerCase\(\) === "other document"/, "Use the exact customer bulk-upload category.");
assert.match(bulkVerificationGroup, /useState\(true\)/, "Multiple uploaded document rows must be expanded initially.");
assert.match(bulkVerificationGroup, /\{item\.documents\.length\} files/, "Multi-file groups must show their file count.");


const verificationModal = await readFile(new URL("../components/spot-survey/document-verification-modal-v3.tsx", import.meta.url), "utf8");

// Verified statuses must open a scoped re-verification UI without acting on every file in the category.
assert.match(bulkVerificationGroup, /allVerified && hasSingleFile/, "Single-file Verified status must be clickable.");
assert.match(bulkVerificationGroup, /reverify\s+prefillDetails=/, "Verified file rows must have an exact-document reverify action.");
assert.match(bulkVerificationGroup, /documentIds=\{\[item\.documents\[0\]\.id\]\}/, "Single-file Verified action must target exactly one document.");
assert.match(bulkVerificationGroup, /allVerified && hasMultipleFiles/, "Multiple-file Verified category must require a file choice.");
assert.match(verificationAction, /reverify\?: boolean/, "Only explicit re-verification may repeat a reviewed file.");
assert.match(verificationAction, /reverify=\{reverify\}/, "Verification modal must receive the reverify flag.");
assert.match(verificationModal, /if \(reverify\) formData\.set\("reverify", "true"\)/, "Verification form must send explicit reverify intent.");
assert.match(actions, /reverify && \(isPartner \|\| documentIds\.length !== 1\)/, "Backend must restrict reverify to Operations and one document.");
assert.match(actions, /documents\[0\]\?\.verification_status !== "verified"/, "Reverify only previously verified documents.");
assert.match(actions, /const documentsToVerify = reverify \? documents :/, "Reverify must not silently skip already verified files.");
assert.match(actions, /if \(!reverify\) await advanceAfterInitialDocumentsVerified/, "Reverify must not advance claim stage.");
assert.match(actions, /Document re-verified successfully/, "Reverify must return a distinct success message.");
assert.match(actions, /claim_document_verifications"\)\.insert\(attempts\.map/, "Fresh verification review must append to audit history.");
assert.match(verificationModal, /max-h-\[calc\(100dvh-24px\)\]/, "Modal must stay inside viewport.");
assert.match(verificationModal, /sm:grid-cols-\[32px_minmax\(0,1fr\)_160px_130px\]/, "Six RC expiry fields must use compact desktop rows.");
assert.match(verificationModal, /min-h-0 flex-1 overflow-y-auto/, "Small screens must retain accessible scrolling.");

// Header displays seven separate fields in a single desktop row. Removed data still belongs to the claim record.
for (const removed of ["Claim Status", "Spot Intimation Date & Time", "Insurer", "Make & Model"]) {
  assert.doesNotMatch(workspace, new RegExp('<Info label="' + removed + '"'), removed + " must not reappear in navy summary");
}
assert.ok(workspace.includes('<Info label="Vehicle No." title={vehicleNumber}'), "Vehicle number must have a separate field");
assert.ok(workspace.includes('<Info label="Model" title={model} logo={<ManufacturerLogo name={make} />} />'), "Model must have its own field with manufacturer logo");
assert.doesNotMatch(workspace, /vehicleNumberAndModel/, "Combined vehicle number/model display must be removed");
assert.match(workspace, /lg:grid-cols-7/, "Display seven separate summary fields on one row at desktop width");
assert.equal((workspace.match(/<Info label=/g) ?? []).length, 7, "Navy summary must render precisely seven information fields");
assert.match(workspace, /BulkDocumentVerificationGroup/, "Spot document categories must render through grouped verification.");
assert.match(workspace, /item\.documents\.length > 0 && item\.documents\.every/, "A category is verified only when every current file is verified.");
assert.doesNotMatch(bulkVerificationGroup, /type="checkbox"/, "Stage 1 pending files must use the document icon rather than checkbox selection.");
assert.match(bulkVerificationGroup, /documentIds=\{selectedDocumentIds\}/, "Verify must receive only the icon-selected file ids.");
assert.match(bulkVerificationGroup, /disabled=\{false\}/, "Stage 1 Verify must remain clickable so an empty selection can show a warning.");
assert.match(bulkVerificationGroup, /aria-label=\{`\$\{selected \? "Deselect" : "Select"\} \$\{document\.file_name\} for verification`\}/, "The document icon must label both select and deselect states for the exact pending file.");
assert.match(bulkVerificationGroup, /onClick=\{onToggle\}/, "A single click on the uploaded-file shield must toggle selection.");
assert.doesNotMatch(bulkVerificationGroup, /onDoubleClick=/, "Deselect must not require a double-click.");
assert.match(bulkVerificationGroup, /if \(next\.has\(document\.id\)\) next\.delete\(document\.id\); else next\.add\(document\.id\);/, "Selection must toggle each document independently.");
assert.match(bulkVerificationGroup, /<DocumentVerificationIcon verified=\{verified\} selected=\{selected\} \/>/, "The uploaded-file shield must display the blue selection checkmark.");
assert.doesNotMatch(bulkVerificationGroup, /selectGroup\(\)|deselectGroup\(\)/, "Do not add another selection shield to category headings.");
assert.match(verificationAction, /Please select a document before verifying\./, "Empty Stage 1 verification must show the document-selection warning.");
assert.match(verificationAction, /aria-describedby="verify-selection-message"/, "Document warning must describe the reference popup accessibly.");
assert.match(verificationAction, /h-\[50px\] w-full rounded-xl/, "Document warning must keep the full-width reference OK button.");
const operationsStages = await readFile(new URL("../components/claim-manager/operations-claim-stages.tsx", import.meta.url), "utf8");
assert.match(operationsStages, /Verification Pending — /, "Verification gate errors must retain document count and names.");
const sharedClaimErrorDialog = await readFile(new URL("../components/claim-manager/claim-stage-error-dialog.tsx", import.meta.url), "utf8");
assert.match(sharedClaimErrorDialog, /title = "Check details"/, "Claim action errors must retain the Check details reference title.");
assert.match(sharedClaimErrorDialog, /role="alertdialog"/, "Claim errors must render in an accessible popup.");
assert.match(sharedClaimErrorDialog, /onClick=\{onClose\}/, "Dismissing an error must only close the popup.");
assert.match(operationsStages, /summarizeClaimActionError\(errorNotice\)/, "Production server errors must use a short safe message.");
assert.match(operationsStages, /onClose=\{\(\) => setErrorNotice\(null\)\}/, "Operations stage must dismiss errors without discarding edits.");
assert.match(operationsStages, /onInput=\{preserveDraft\} onChange=\{preserveDraft\}/, "Claim edits must be preserved as unsaved drafts.");
assert.match(operationsStages, /if \(state\.ok \|\| !state\.message\) return;/, "Failed stage actions must retain form state.");

assert.match(bulkVerificationGroup, /document\.verification_status !== "rejected"/, "Rejected files cannot be selected before replacement.");
assert.match(bulkVerificationGroup, /deleteVerifiedSpotSurveyDocument\(claim\.id, document\.id\)/, "Delete must target the exact claim and document.");
assert.match(bulkVerificationGroup, /aria-label="Delete document"/, "Delete action must have an accessible label.");
assert.doesNotMatch(bulkVerificationGroup, /<RequestReuploadButton/, "Orange reupload action must be absent from document rows.");
assert.match(bulkVerificationGroup, /actionLabel="Upload" iconOnly/, "Populated categories retain Upload New.");

assert.match(uploader, /type="file"[\s\S]*multiple/, "Spot media selector must allow multiple files.");
for (const mime of [/video\/mp4/, /video\/quicktime/, /video\/x-matroska/, /video\/x-msvideo/]) assert.match(uploader, mime);
assert.match(uploader, /prepareSpotSurveyMediaUpload/, "Spot media must use signed upload preparation.");
assert.match(uploader, /uploadToSignedUrl/, "Spot media bytes must upload directly to storage.");
assert.match(uploader, /finalizeSpotSurveyMediaUpload/, "Spot metadata finalizes after upload.");
assert.match(uploader, /cancelClaimDocumentUploads/, "Incomplete uploads have cleanup.");
assert.doesNotMatch(uploader, /formData\.append\("files"/, "File bodies must not traverse Server Actions.");

assert.match(replacementUploader, /prepareClaimDocumentUpload/, "Single document upload must use signed preparation.");
assert.match(replacementUploader, /uploadToSignedUrl/, "Single document bytes upload directly to storage.");
assert.match(replacementUploader, /finalizeClaimDocumentUpload/, "Single document metadata finalizes after upload.");
assert.match(replacementUploader, /documentId\?: string/, "Replace accepts the exact document id.");
assert.match(replacementUploader, /isReplaceAction && !documentId/, "Replace fails closed without an id.");
assert.match(replacementUploader, /existing file will be replaced and must be verified again/, "Replace warns that re-verification is required.");

assert.match(uploadActions, /20 \* 1024 \* 1024/, "Photo size limit must remain 20 MB.");
assert.match(uploadActions, /50 \* 1024 \* 1024/, "Video size limit must remain 50 MB.");
assert.match(uploadActions, /createSignedUploadUrl/, "Server preparation must issue signed direct-upload tokens.");
assert.match(uploadActions, /expectedVideo !== actualVideo/, "Upload validation must prevent media-type slot mismatch.");
assert.match(uploadActions, /\.insert\(rows\)/, "Spot metadata is persisted as a batch.");
assert.match(uploadActions, /cleanupPaths\(uploads\.map\(\(upload\) => upload\.path\)\)/, "Failed spot persistence cleans uploaded objects.");
assert.ok(uploadActions.includes("`${claim.customer_id}/${claim.id}/spot/${batchId}-${index}-${fileName}`"), "Spot uploads must use the customer/claim prefix.");
assert.ok(uploadActions.includes("`${claim.customer_id}/${claim.id}/${Date.now()}-${randomUUID()}-${fileName}`"), "Document uploads must use the customer/claim prefix.");
assert.doesNotMatch(uploadActions, /customerId/, "Upload persistence must not trust a browser-supplied customer id.");
assert.match(uploadActions, /customer_id: claim\.customer_id/, "Upload metadata uses the authorized claim customer.");
assert.doesNotMatch(uploadActions, /\.upload\(storagePath, file/, "Server actions must not proxy file bytes.");

const existingLookup = uploadActions.match(/async function loadExistingClaimDocument\([\s\S]*?\n\}/)?.[0];
assert.ok(existingLookup, "Replacement must reload the exact existing document.");
assert.match(existingLookup, /\.eq\("id", documentId\)/);
assert.match(existingLookup, /\.eq\("claim_id", claim\.id\)/);
assert.match(existingLookup, /\.eq\("customer_id", claim\.customer_id\)/);

const replacementBranch = uploadActions.match(/const existingDocument = await loadExistingClaimDocument\(claim, documentId\);[\s\S]*?return \{ ok: true, message: "Document replaced\. Re-verification required\." \};/)?.[0];
assert.ok(replacementBranch, "Finalization must retain a distinct row replacement branch.");
assert.match(replacementBranch, /\.update\(replacementPayload\)/, "Replacement updates rather than inserts the existing row.");
assert.doesNotMatch(replacementBranch, /claim_documents"\)\.insert\(/, "Row replacement must not create a second document row.");
for (const guard of [/verification_status: "pending"/, /rejection_reason: null/, /verified_by: null/, /verified_at: null/, /is_valid: false/, /replacement_requires_reverification: true/, /rollbackError/]) assert.match(replacementBranch, guard);
assert.match(replacementBranch, /storage\.from\([\s\S]*?\)\.remove\(\[existingDocument\.storage_path\]\)/, "Successful replacement removes the superseded storage object.");

const missingUploadBranch = uploadActions.match(/if \(!documentId\) \{[\s\S]*?return \{ ok: true, message: "Document uploaded successfully\." \};[\s\S]*?\}/)?.[0];
assert.ok(missingUploadBranch, "Upload without an existing row retains insert semantics.");
assert.match(missingUploadBranch, /claim_documents"\)\.insert\(/);

// Shared claim-specific access is now the authorization boundary for both Operations and Partner.
assert.match(uploadActions, /requireClaimWorkflowAccess\(claimId/, "Claim uploads must delegate to the shared claim-specific access guard.");
assert.match(actions, /requireClaimWorkflowAccess\(claimId/, "Claim verification must delegate to the shared claim-specific access guard.");
assert.match(workflowAccess, /hasEffectiveCapability\(profile, "manage_claims", "edit"\)/, "Employee flow must retain effective manage_claims authorization.");
assert.match(workflowAccess, /canAccessCustomer\(profile\.id, profile\.role, claim\.customer_id, "manage_claims"\)/, "Employee flow must retain customer scope.");
assert.match(workflowAccess, /profile\.role === "intermediary"/, "Partner flow must be explicit.");
assert.match(workflowAccess, /rpc\("partner_app_claim_detail", \{ p_claim_id: claimId \}\)/, "Partner flow must prove exact-claim scope through the Partner RPC.");
assert.match(actions, /data\.claim_service_mode === "self_managed" && access\.isPartner/, "Self-managed document mutations remain restricted to authorized Operations users.");

assert.match(actions, /supabase\.rpc\("advance_initial_documents_verified"/, "Initial-document advancement must use the secure RPC.");
assert.match(actions, /function parseDocumentIds\(value: string\)/, "Bulk verification parses a bounded id set.");
assert.match(actions, /\.eq\("claim_id", claimId\)[\s\S]*?\.in\("id", documentIds\)/, "Bulk verification reloads selected files within the claim.");
assert.match(actions, /new Set\(documents\.map\(\(document\) => verificationFamilyForDocument\(document\.document_type\)\)\)\.size !== 1|families\.size !== 1/, "Mixed document categories must be rejected.");
assert.match(actions, /documents\.some\(\(document\) => document\.verification_status === "rejected"\)/, "Unresolved reupload files remain blocked.");
assert.match(actions, /\.in\("id", idsToVerify\)/, "Selected statuses update in one claim-scoped batch.");
assert.match(actions, /matching(?:Documents)?\.length > 0 && matching(?:Documents)?\.every\(\(document\) => document\.verification_status === "verified"\)/, "Stage advancement waits for every current required file.");
assert.match(actions, /missingInsuranceIncidentDate = !incidentDate/, "Insurance verification fails closed without Accident Date.");
assert.match(actions, /(?:incidentBeforeStart|before) = incidentDate < startDate/, "Insurance verification rejects pre-inception accidents.");
assert.match(actions, /(?:incidentAfterEnd|after) = incidentDate > endDate/, "Insurance verification rejects post-expiry accidents.");
assert.match(actions, /policy_status = (?:incidentBeforeStart \|\| incidentAfterEnd|before \|\| after) \? "Invalid" : "Valid"/, "Policy status uses both period boundaries.");
assert.match(actions, /Accident date is required to verify policy validity\./);

assert.match(insuranceCapacity, /vehicleClassCode === "PCP" \|\| vehicleClassCode === "TWP"/);
assert.match(insuranceCapacity, /vehicleClassCode === "GCV"/);
assert.match(insuranceCapacity, /vehicleClassCode === "PCV"/);
assert.match(insuranceCapacity, /vehicleClassCode === "CPM"/);
assert.match(insuranceCapacity, /fuelType\.includes\("electric"\)/);
assert.match(insuranceCapacityAction, /canAccessCustomer/);
assert.match(verificationAction, /InsuranceVerificationModalButton/);
assert.match(verificationAction, /documentIds\?: string\[\]/);
assert.match(verificationAction, /targetIds\.join\(","\)/);
assert.match(insuranceModal, /vehicle_capacity_value/);
assert.match(insuranceModal, /formData\.set\("gvw_kg", capacityValue\)/);
assert.match(insuranceModal, /const insuranceStatus = getStatus\(insurance\.start, insurance\.end, incident\)/);
assert.match(insuranceModal, /Accident date falls outside the insurance policy period\. Verification is blocked\./);
assert.match(insuranceModal, /incidentDate < startDate \|\| incidentDate > endDate \? "Invalid" : "Valid"/);
assert.match(verificationDetails, /vehicle_capacity_label/);
assert.match(verificationDetails, /vehicle_capacity_value/);
assert.match(verificationDetails, /GVW Mention in Kgs/);

const verifiedStatusFunction = claimWorkflow.match(/export function verifiedStatusFor\(status: ClaimStatus\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(verifiedStatusFunction);
assert.doesNotMatch(verifiedStatusFunction, /"Initial Documents Pending"/, "Stage 1 verification must not skip explicit transition.");
assert.doesNotMatch(verifiedStatusFunction, /"Documents Pending"/);
assert.match(verifiedStatusFunction, /"Initial Documents Submitted"/);
assert.match(sharedClaimJourney, /"Initial Documents Submitted": operationsRule\(1, 1,/);
assert.match(customerClaimDetail, /projectInternalClaim\(claim\?\.current_status/);
assert.match(customerClaimDetail, /index < internalProjection\.completedStageCount/);
assert.match(customerClaimDetail, /index === currentStageIndex/);

const headerCss = await readFile(new URL("../components/spot-survey/claim-journey-header.module.css", import.meta.url), "utf8");
const motionCss = await readFile(new URL("../components/spot-survey/claim-document-motion.module.css", import.meta.url), "utf8");
const customerDocument = await readFile(new URL("../components/customer-portal/customer-claim-compact-document.tsx", import.meta.url), "utf8");
assert.match(customerDocument, /bg-\[#F21E38\] text-white/, "Customer video icon reference must retain its red background");
assert.match(bulkVerificationGroup, /category === "video"/, "Operations video icon must match Customer portal special case");
assert.match(bulkVerificationGroup, /<Video className="h-4 w-4 fill-current"/, "Operations must reuse Customer video glyph and sizing");
assert.match(bulkVerificationGroup, /bg-\[#F21E38\] text-white/, "Operations must reuse Customer video badge color");
assert.match(motionCss, /\(hover:hover\) and \(pointer:fine\)/, "Document effects must match customer hover-capable device behavior");
assert.match(motionCss, /\.card:hover \{[\s\S]*?translateY\(-2px\)/, "Document hover lift must match customer motion");
assert.match(motionCss, /\.card:hover \.videoIcon/, "Video icon needs matching microinteraction");

assert.match(workspace, /Operations claim journey/, "Operations claim header title must match requested label");
assert.match(workspace, /min-h-\[48px\]/, "Operations claim header and summary should remain compact");
assert.match(headerCss, /\.header\s*\{[^}]*border: 0;/s, "Operations claim header must have no outer border");
assert.match(bulkVerificationGroup, /motionStyles\.card/, "Document groups must use motion styling");
assert.match(motionCss, /prefers-reduced-motion: reduce/, "Document animation must respect reduced-motion preference");
console.log("Claim spot upload, scoped Partner authorization, bulk verification, direct storage, exact replacement and insurance validity regression passed.");
