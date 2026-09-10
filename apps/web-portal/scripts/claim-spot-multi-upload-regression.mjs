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

assert.match(uploader, /type="file"[\s\S]*multiple/, "Spot media selector must allow multiple files.");
assert.match(uploader, /video\/mp4/, "Spot media selector must accept MP4 video.");
assert.match(uploader, /video\/quicktime/, "Spot media selector must accept MOV video.");
assert.match(uploader, /formData\.delete\("files"\)/, "Removed selections must not be submitted.");
assert.match(uploader, /formData\.append\("files", file\)/, "Selected files must be submitted explicitly.");
assert.match(uploader, /claim-document-upload-actions/, "Spot media uploads must use the dedicated authorized upload action.");
assert.match(uploader, /onSubmit=\{\(event\)/, "Spot media upload must use explicit submit handling instead of an inline React form action callback.");
assert.match(uploader, /Upload failed\. Please try again\./, "Spot media upload must surface a safe client-side failure instead of crashing the claim page.");
assert.match(replacementUploader, /claim-document-upload-actions/, "Single document uploads must use the dedicated authorized upload action.");
assert.match(replacementUploader, /Upload failed\. Please try again\./, "Single document uploads must surface a safe client-side failure instead of crashing the claim page.");

assert.match(uploadActions, /formData\.getAll\("files"\)/, "Server upload action must process all selected spot media files.");
assert.match(uploadActions, /20 \* 1024 \* 1024/, "Server upload action must enforce the per-file photo size limit.");
assert.match(uploadActions, /50 \* 1024 \* 1024/, "Server upload action must preserve the 50 MB video size limit.");
assert.match(uploadActions, /document_type: isVideoFile\(file\) \? "Accident Video" : "Accident Photo"/, "Uploaded spot media must preserve photo/video categories including extension-based video detection.");
assert.match(uploadActions, /\.insert\(rows\)/, "Spot media metadata must be inserted as one batch.");
assert.match(uploadActions, /storageAdmin\.storage\.from\(bucketName\)\.remove\(uploadedPaths\)/, "Failed multi-upload must clean up privileged storage objects.");
assert.match(uploadActions, /storageAdmin\.storage\.from\(bucketName\)\.remove\(\[storagePath\]\)/, "Failed single-document metadata writes must clean up the uploaded storage object.");
assert.ok(uploadActions.includes("`${claim.customer_id}/${claim.id}/spot/${Date.now()}-${index}-${safeName}`"), "Spot photo/video uploads must use the canonical customer/claim storage prefix.");
assert.ok(uploadActions.includes("`${claim.customer_id}/${claim.id}/${Date.now()}-${safeName}`"), "Single document uploads must use the canonical customer/claim storage prefix.");
assert.doesNotMatch(uploadActions, /formData\.get\("customerId"\)/, "Upload authorization must not trust a browser-supplied customer id.");
assert.match(uploadActions, /customer_id: claim\.customer_id/, "Upload metadata must use the customer id loaded from the authorized claim.");
assert.match(uploadActions, /createSupabaseAdminClient\(\)/, "Authorized claim uploads must use the server-only privileged storage client after application authorization.");

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

console.log("Claim spot multi-upload, canonical storage, intimation, insurance capacity and authorized verification regression passed.");
