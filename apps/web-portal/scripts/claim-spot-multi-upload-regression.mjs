import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspace = await readFile(new URL("../components/spot-survey/spot-survey-workspace-v2.tsx", import.meta.url), "utf8");
const uploader = await readFile(new URL("../components/spot-survey/spot-media-upload-button.tsx", import.meta.url), "utf8");
const actions = await readFile(new URL("../app/claims/[id]/spot-survey-actions.ts", import.meta.url), "utf8");
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

assert.match(actions, /formData\.getAll\("files"\)/, "Server action must process all selected spot media files.");
assert.match(actions, /20 \* 1024 \* 1024/, "Server action must enforce the per-file size limit.");
assert.match(actions, /document_type: file\.type\.startsWith\("video\/"\) \? "Accident Video" : "Accident Photo"/, "Uploaded spot media must preserve photo/video categories.");
assert.match(actions, /\.insert\(rows\)/, "Spot media metadata must be inserted as one batch.");
assert.match(actions, /storage\.from\(bucketName\)\.remove\(uploadedPaths\)/, "Failed multi-upload must clean up uploaded storage objects.");

const verifiedStatusFunction = claimWorkflow.match(/export function verifiedStatusFor\(status: ClaimStatus\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(verifiedStatusFunction, "Initial-document verified-status helper must remain available.");
assert.doesNotMatch(verifiedStatusFunction, /"Initial Documents Pending"/, "Verifying Stage 1 documents must not skip the explicit Save & move transition.");
assert.doesNotMatch(verifiedStatusFunction, /"Documents Pending"/, "Legacy Stage 1 pending state must not auto-skip the explicit submission transition.");
assert.match(verifiedStatusFunction, /"Initial Documents Submitted"/, "Submitted initial documents must remain eligible for verification finalization.");

assert.match(sharedClaimJourney, /"Initial Documents Submitted": operationsRule\(1, 1,/, "Submitted initial documents must project to Stage 2 with Stage 1 completed.");
assert.match(customerClaimDetail, /projectInternalClaim\(claim\?\.current_status/, "Customer claim tracker must derive its journey from the authoritative persisted claim status.");
assert.match(customerClaimDetail, /index < internalProjection\.completedStageCount/, "Customer claim tracker must render completed stages from the shared projection.");
assert.match(customerClaimDetail, /index === currentStageIndex/, "Customer claim tracker must render the projected stage as current.");

console.log("Claim spot multi-upload and intimation regression passed.");
