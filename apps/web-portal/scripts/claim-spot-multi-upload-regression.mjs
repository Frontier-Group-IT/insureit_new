import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspace = await readFile(new URL("../components/spot-survey/spot-survey-workspace-v2.tsx", import.meta.url), "utf8");
const uploader = await readFile(new URL("../components/spot-survey/spot-media-upload-button.tsx", import.meta.url), "utf8");
const replacementUploader = await readFile(new URL("../components/spot-survey/replace-document-button.tsx", import.meta.url), "utf8");
const actions = await readFile(new URL("../app/claims/[id]/spot-survey-actions.ts", import.meta.url), "utf8");
const uploadActions = await readFile(new URL("../app/claims/[id]/claim-document-upload-actions.ts", import.meta.url), "utf8");
const insuranceCapacity = await readFile(new URL("../lib/insurance-verification-capacity.ts", import.meta.url), "utf8");
const insuranceCapacityAction = await readFile(new URL("../app/claims/[id]/insurance-verification-actions.ts", import.meta.url), "utf8");
const insuranceModal = await readFile(new URL("../components/spot-survey/insurance-verification-modal.tsx", import.meta.url), "utf8");
const verificationAction = await readFile(new URL("../components/spot-survey/verification-action-button.tsx", import.meta.url), "utf8");
const verificationDetails = await readFile(new URL("../components/spot-survey/document-verification-details-button.tsx", import.meta.url), "utf8");
const claimWorkflow = await readFile(new URL("../lib/claim-workflow.ts", import.meta.url), "utf8");
const customerClaimDetail = await readFile(new URL("../../mobile-app/app/customer/claim-detail.tsx", import.meta.url), "utf8");
const sharedClaimJourney = await readFile(new URL("../../../packages/claim-journey/src/index.ts", import.meta.url), "utf8");

assert.match(workspace, /Spot Intimation Date & Time/, "Claim header must show the combined Spot Intimation Date & Time card.");
assert.match(workspace, /const spotAt = claim\.spotIntimationAt \?\? claim\.created_at;/, "Spot intimation display must prefer the persisted stage timestamp and retain a creation-time fallback.");
assert.match(workspace, /formatIntimationDate\(spotAt\)/, "Spot intimation date must use the resolved persisted timestamp.");
assert.match(workspace, /formatIntimationTime\(spotAt\)/, "Spot intimation time must use the resolved persisted timestamp.");
assert.match(workspace, /<SpotMediaUploadButton claimId=\{claim\.id\}/, "Spot Photo card must expose the multi-upload action.");
assert.match(workspace, /documentCount: spotDocuments\.length/, "Spot Photo card must retain awareness of multiple uploaded media records.");
assert.match(workspace, /<ReplaceDocumentButton claimId=\{claim\.id\} customerId=\{claim\.customer_id\} documentId=\{document\.id\}[\s\S]*?actionLabel="Replace"/, "Each row-level Replace control must target the exact existing document id.");
assert.match(workspace, /<ReplaceDocumentButton claimId=\{claim\.id\} customerId=\{claim\.customer_id\} documentType=\{item\.documentType\}[\s\S]*?actionLabel="Upload"/, "Missing-document Upload must remain separate from row replacement and must not require an existing document id.");

assert.match(uploader, /type="file"[\s\S]*multiple/, "Spot media selector must allow multiple files.");
assert.match(uploader, /video\/mp4/, "Spot media selector must accept MP4 video.");
assert.match(uploader, /video\/quicktime/, "Spot media selector must accept MOV video.");
assert.match(uploader, /video\/x-matroska/, "Spot media selector must accept MKV video.");
assert.match(uploader, /video\/x-msvideo/, "Spot media selector must accept AVI video.");
assert.match(uploader, /claim-document-upload-actions/, "Spot media uploads must use the dedicated authorized upload actions.");
assert.match(uploader, /onSubmit=\{\(event\)/, "Spot media upload must use explicit submit handling instead of an inline React form action callback.");
assert.match(uploader, /prepareSpotSurveyMediaUpload/, "Spot media upload must request signed upload instructions without sending file bodies through a Server Action.");
assert.match(uploader, /uploadToSignedUrl/, "Spot media file bytes must upload directly to storage using a signed upload token.");
assert.match(uploader, /finalizeSpotSurveyMediaUpload/, "Spot media metadata must be finalized only after direct storage upload succeeds.");
assert.match(uploader, /cancelClaimDocumentUploads/, "Spot media direct upload failures must request cleanup of incomplete objects.");
assert.match(uploader, /Upload failed\. Please try again\./, "Spot media upload must surface a safe client-side failure instead of crashing the claim page.");
assert.doesNotMatch(uploader, /formData\.append\("files"/, "Spot media file bodies must not be routed through the Next.js Server Action request body.");

assert.match(replacementUploader, /claim-document-upload-actions/, "Single document uploads must use the dedicated authorized upload actions.");
assert.match(replacementUploader, /prepareClaimDocumentUpload/, "Single document upload must request a signed upload instruction from the authorized server action.");
assert.match(replacementUploader, /uploadToSignedUrl/, "Single document file bytes must upload directly to storage.");
assert.match(replacementUploader, /finalizeClaimDocumentUpload/, "Single document metadata must be finalized after direct storage upload.");
assert.match(replacementUploader, /cancelClaimDocumentUploads/, "Single document direct upload failures must request cleanup.");
assert.match(replacementUploader, /Upload failed\. Please try again\./, "Single document uploads must surface a safe client-side failure instead of crashing the claim page.");
assert.doesNotMatch(replacementUploader, /new FormData/, "Single document file bytes must not be submitted through a Server Action FormData body.");
assert.match(replacementUploader, /documentId\?: string/, "Replace control must accept an exact existing document id.");
assert.match(replacementUploader, /prepareClaimDocumentUpload\([\s\S]*?documentId\)/, "Signed upload preparation must receive the exact document id for replacement.");
assert.match(replacementUploader, /finalizeClaimDocumentUpload\([\s\S]*?documentId\)/, "Signed upload finalization must receive the exact document id for replacement.");
assert.match(replacementUploader, /isReplaceAction && !documentId/, "Replace must fail closed when the row-specific document id is missing.");
assert.match(replacementUploader, /existing file will be replaced and must be verified again/, "Replace dialog must tell Operations that the replacement requires re-verification.");

assert.match(uploadActions, /20 \* 1024 \* 1024/, "Server preparation must enforce the per-file photo size limit.");
assert.match(uploadActions, /50 \* 1024 \* 1024/, "Server preparation must preserve the 50 MB video size limit.");
assert.match(uploadActions, /createSignedUploadUrl/, "Authorized server preparation must issue signed direct-upload tokens instead of proxying file bytes through Vercel.");
assert.match(uploadActions, /prepareSpotSurveyMediaUpload/, "Dedicated signed upload preparation must exist for spot media.");
assert.match(uploadActions, /finalizeSpotSurveyMediaUpload/, "Dedicated spot media metadata finalization must exist.");
assert.match(uploadActions, /prepareClaimDocumentUpload/, "Dedicated signed upload preparation must exist for single claim documents.");
assert.match(uploadActions, /finalizeClaimDocumentUpload/, "Dedicated single document metadata finalization must exist.");
assert.match(uploadActions, /cancelClaimDocumentUploads/, "Incomplete signed uploads must have an authorized cleanup action.");
assert.match(uploadActions, /expectedVideo !== actualVideo/, "Single-document upload validation must reject videos submitted to non-video document slots and vice versa.");
assert.match(uploadActions, /Video files are not allowed for this document type\./, "Non-video document slots must explicitly reject video content.");
assert.match(uploadActions, /documentType = isVideoMetadata\(file\) \? "Accident Video" : "Accident Photo"/, "Uploaded spot media must preserve photo/video categories including extension-based video detection.");
assert.match(uploadActions, /\.insert\(rows\)/, "Spot media metadata must still be inserted as one batch after upload.");
assert.match(uploadActions, /cleanupPaths\(uploads\.map\(\(upload\) => upload\.path\)\)/, "Failed spot metadata persistence must clean up uploaded storage objects.");
assert.match(uploadActions, /cleanupPaths\(\[upload\.path\]\)/, "Failed single-document metadata persistence must clean up the uploaded storage object.");
assert.ok(uploadActions.includes("`${claim.customer_id}/${claim.id}/spot/${batchId}-${index}-${fileName}`"), "Spot photo/video uploads must use the canonical customer/claim storage prefix.");
assert.ok(uploadActions.includes("`${claim.customer_id}/${claim.id}/${Date.now()}-${randomUUID()}-${fileName}`"), "Single document uploads must use the canonical customer/claim storage prefix.");
assert.doesNotMatch(uploadActions, /customerId/, "Upload authorization and persistence must not trust a browser-supplied customer id.");
assert.match(uploadActions, /customer_id: claim\.customer_id/, "Upload metadata must use the customer id loaded from the authorized claim.");
assert.doesNotMatch(uploadActions, /\.upload\(storagePath, file/, "Server actions must not proxy claim file bytes through the Vercel function body.");

const loadExistingDocumentFunction = uploadActions.match(/async function loadExistingClaimDocument\([\s\S]*?\n\}/)?.[0];
assert.ok(loadExistingDocumentFunction, "Row replacement must load the existing claim document before preparing or finalizing replacement.");
assert.match(loadExistingDocumentFunction, /\.eq\("id", documentId\)/, "Existing-document lookup must target the exact selected row.");
assert.match(loadExistingDocumentFunction, /\.eq\("claim_id", claim\.id\)/, "Existing-document lookup must remain scoped to the authorized claim.");
assert.match(loadExistingDocumentFunction, /\.eq\("customer_id", claim\.customer_id\)/, "Existing-document lookup must remain scoped to the authorized customer.");

const replacementBranch = uploadActions.match(/const existingDocument = await loadExistingClaimDocument\(claim, documentId\);[\s\S]*?return \{ ok: true, message: "Document replaced\. Re-verification required\." \};/)?.[0];
assert.ok(replacementBranch, "Finalization must contain a distinct row-specific replacement branch.");
assert.match(replacementBranch, /\.update\(replacementPayload\)/, "Replace must update the existing claim_documents row rather than insert a new one.");
assert.doesNotMatch(replacementBranch, /claim_documents"\)\.insert\(/, "Row-specific replacement must never create an additional claim_documents row.");
assert.match(replacementBranch, /verification_status: "pending"/, "Replacement must reset the selected document to Pending.");
assert.match(replacementBranch, /rejection_reason: null/, "Replacement must clear any previous rejection state.");
assert.match(replacementBranch, /verified_by: null/, "Replacement must clear the previous verifier.");
assert.match(replacementBranch, /verified_at: null/, "Replacement must clear the previous verification timestamp.");
assert.match(replacementBranch, /claim_document_verifications"\)\.insert\(/, "Replacement must append auditable verification invalidation evidence.");
assert.match(replacementBranch, /is_valid: false/, "Replacement invalidation must prevent an old verification from remaining current.");
assert.match(replacementBranch, /replacement_requires_reverification: true/, "Replacement evidence must explicitly require re-verification.");
assert.match(replacementBranch, /admin\.storage\.from\(oldBucket\)\.remove\(\[existingDocument\.storage_path\]\)/, "Successful replacement must remove the superseded storage object.");
assert.match(replacementBranch, /rollbackError/, "Replacement must attempt metadata rollback if verification invalidation cannot be persisted.");

const missingDocumentUploadBranch = uploadActions.match(/if \(!documentId\) \{[\s\S]*?return \{ ok: true, message: "Document uploaded successfully\." \};[\s\S]*?\}/)?.[0];
assert.ok(missingDocumentUploadBranch, "Missing-document Upload must retain its own insert branch.");
assert.match(missingDocumentUploadBranch, /claim_documents"\)\.insert\(/, "Missing-document Upload must continue creating a new document row.");

const loadUploadClaimFunction = uploadActions.match(/async function loadClaimForUpload\([\s\S]*?\n\}/)?.[0];
assert.ok(loadUploadClaimFunction, "Claim uploads must keep a dedicated authorized claim loader.");
assert.match(loadUploadClaimFunction, /createSupabaseAdminClient\(\)/, "Claim upload lookup must not depend on a narrower authenticated SELECT policy.");
assert.match(loadUploadClaimFunction, /canAccessCustomer\(profile\.id, profile\.role, data\.customer_id, "manage_claims"\)/, "Privileged upload lookup must be followed by the explicit manage_claims customer-scope check.");
assert.match(loadUploadClaimFunction, /claim_service_mode !== "broker_managed"/, "Privileged upload lookup must preserve the broker-managed Operations boundary.");

const loadClaimFunction = actions.match(/async function loadClaim\([\s\S]*?\n\}/)?.[0];
assert.ok(loadClaimFunction, "Claim verification must keep a dedicated claim loader.");
assert.match(loadClaimFunction, /createSupabaseAdminClient\(\)/, "Claim verification lookup must not depend on a narrower authenticated SELECT policy after the application permission check.");
assert.match(loadClaimFunction, /canAccessCustomer\(profile\.id, profile\.role, data\.customer_id, "manage_claims"\)/, "Privileged claim lookup must be followed by the explicit manage_claims customer-scope check.");
assert.match(loadClaimFunction, /claim_service_mode !== "broker_managed"/, "Privileged lookup must preserve the broker-managed Operations boundary.");
assert.doesNotMatch(loadClaimFunction, /createServerSupabaseClient\(\)/, "Claim existence lookup must not regress to the RLS-filtered authenticated client.");
assert.doesNotMatch(actions, /loadClaim\(claimId\);/, "Claim actions must pass the already-authorized profile into the scoped claim loader.");
assert.match(actions, /supabase\.rpc\("advance_initial_documents_verified"/, "Initial-document advancement must continue through the existing secure RPC.");

assert.match(insuranceCapacity, /vehicleClassCode === "PCP" \|\| vehicleClassCode === "TWP"/, "PCP and TWP insurance verification must resolve capacity from engine CC.");
assert.match(insuranceCapacity, /vehicleClassCode === "GCV"/, "GCV insurance verification must retain GVW capacity.");
assert.match(insuranceCapacity, /vehicleClassCode === "PCV"/, "PCV insurance verification must use seating capacity.");
assert.match(insuranceCapacity, /vehicleClassCode === "CPM"/, "CPM insurance verification must use equipment capacity.");
assert.match(insuranceCapacity, /fuelType\.includes\("electric"\)/, "Electric vehicle verification must preserve the kW capacity label.");
assert.match(insuranceCapacityAction, /canAccessCustomer/, "Class-aware capacity lookup must retain customer access scoping.");
assert.match(insuranceCapacityAction, /vehicle_class_code,vehicle_class_description,vehicle_type,fuel_type,engine_capacity_cc,seating_capacity,gvw_kg,vehicle_category/, "Capacity lookup must use canonical vehicle-class fields.");
assert.match(verificationAction, /InsuranceVerificationModalButton/, "Insurance Copy verification must route through the class-aware modal.");
assert.match(insuranceModal, /vehicle_capacity_value/, "New insurance verifications must persist explicit class-aware capacity metadata.");
assert.match(insuranceModal, /formData\.set\("gvw_kg", capacityValue\)/, "Class-aware verification must preserve the existing gvw_kg server contract for backward compatibility.");
assert.match(insuranceModal, /<option>Hazardous<\/option>/, "Hazardous policy selection must remain available.");
assert.match(insuranceModal, /<option>Non Hazardous<\/option>/, "Non Hazardous policy selection must remain available.");
assert.doesNotMatch(insuranceModal, /Not Mentioned/, "Removed Not Mentioned policy option must not be reintroduced.");
assert.match(verificationDetails, /vehicle_capacity_label/, "Saved insurance verification details must show the class-aware capacity label.");
assert.match(verificationDetails, /vehicle_capacity_value/, "Saved insurance verification details must show the class-aware capacity value.");
assert.match(verificationDetails, /GVW Mention in Kgs/, "Historical insurance verification rows must retain the legacy GVW display fallback.");

const verifiedStatusFunction = claimWorkflow.match(/export function verifiedStatusFor\(status: ClaimStatus\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(verifiedStatusFunction, "Initial-document verified-status helper must remain available.");
assert.doesNotMatch(verifiedStatusFunction, /"Initial Documents Pending"/, "Verifying Stage 1 documents must not skip the explicit Save & move transition.");
assert.doesNotMatch(verifiedStatusFunction, /"Documents Pending"/, "Legacy Stage 1 pending state must not auto-skip the explicit submission transition.");
assert.match(verifiedStatusFunction, /"Initial Documents Submitted"/, "Submitted initial documents must remain eligible for verification finalization.");

assert.match(sharedClaimJourney, /"Initial Documents Submitted": operationsRule\(1, 1,/, "Submitted initial documents must project to Stage 2 with Stage 1 completed.");
assert.match(customerClaimDetail, /projectInternalClaim\(claim\?\.current_status/, "Customer claim tracker must derive its journey from the authoritative persisted claim status.");
assert.match(customerClaimDetail, /index < internalProjection\.completedStageCount/, "Customer claim tracker must render completed stages from the shared projection.");
assert.match(customerClaimDetail, /index === currentStageIndex/, "Customer claim tracker must render the projected stage as current.");

console.log("Claim spot multi-upload, signed direct storage, exact row replacement, intimation, insurance capacity and authorized verification regression passed.");
