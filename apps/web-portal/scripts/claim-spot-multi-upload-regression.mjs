import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspace = await readFile(new URL("../components/spot-survey/spot-survey-workspace-v2.tsx", import.meta.url), "utf8");
const bulkVerificationGroup = await readFile(new URL("../components/spot-survey/bulk-document-verification-group.tsx", import.meta.url), "utf8");
const uploader = await readFile(new URL("../components/spot-survey/spot-media-upload-button.tsx", import.meta.url), "utf8");
const replacementUploader = await readFile(new URL("../components/spot-survey/replace-document-button.tsx", import.meta.url), "utf8");
const actions = await readFile(new URL("../app/claims/[id]/spot-survey-actions.ts", import.meta.url), "utf8");
const uploadActions = await readFile(new URL("../app/claims/[id]/claim-document-upload-actions.ts", import.meta.url), "utf8");
const workflowAccess = await readFile(new URL("../lib/claim-workflow-access.ts", import.meta.url), "utf8");
const insuranceCapacity = await readFile(new URL("../lib/insurance-verification-capacity.ts", import.meta.url), "utf8");
const insuranceCapacityAction = await readFile(new URL("../app/claims/[id]/insurance-verification-actions.ts", import.meta.url), "utf8");
const insuranceModal = await readFile(new URL("../components/spot-survey/insurance-verification-modal.tsx", import.meta.url), "utf8");
const verificationAction = await readFile(new URL("../components/spot-survey/verification-action-button.tsx", import.meta.url), "utf8");
const verificationDetails = await readFile(new URL("../components/spot-survey/document-verification-details-button.tsx", import.meta.url), "utf8");
const claimWorkflow = await readFile(new URL("../lib/claim-workflow.ts", import.meta.url), "utf8");
const customerClaimDetail = await readFile(new URL("../../mobile-app/app/customer/claim-detail.tsx", import.meta.url), "utf8");
const sharedClaimJourney = await readFile(new URL("../../../packages/claim-journey/src/index.ts", import.meta.url), "utf8");

assert.match(workspace, /Spot Intimation Date & Time/, "Claim header must show the combined Spot Intimation Date & Time card.");
assert.match(workspace, /const spotAt = claim\.spotIntimationAt \?\? claim\.created_at;/, "Spot intimation display must prefer the persisted stage timestamp.");
assert.match(workspace, /BulkDocumentVerificationGroup/, "Spot document categories must render through grouped verification.");
assert.match(workspace, /item\.documents\.length > 0 && item\.documents\.every/, "A category is verified only when every current file is verified.");
assert.match(bulkVerificationGroup, /type="checkbox"/, "Pending files must expose selection.");
assert.match(bulkVerificationGroup, /documentIds=\{selectedDocumentIds\}/, "Verify must receive only selected file ids.");
assert.match(bulkVerificationGroup, /disabled=\{selectedDocumentIds\.length === 0\}/, "Verify remains disabled without a selection.");
assert.match(bulkVerificationGroup, /document\.verification_status !== "rejected"/, "Rejected files cannot be selected before replacement.");
assert.match(bulkVerificationGroup, /documentId=\{document\.id\}[\s\S]*?actionLabel="Replace"/, "Replace must target the exact row.");
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
assert.match(actions, /claim_service_mode !== "broker_managed"/, "Verification retains the broker-managed boundary.");

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

console.log("Claim spot upload, scoped Partner authorization, bulk verification, direct storage, exact replacement and insurance validity regression passed.");
