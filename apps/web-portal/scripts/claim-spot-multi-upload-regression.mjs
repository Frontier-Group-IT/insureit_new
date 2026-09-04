import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspace = await readFile(new URL("../components/spot-survey/spot-survey-workspace-v2.tsx", import.meta.url), "utf8");
const uploader = await readFile(new URL("../components/spot-survey/spot-media-upload-button.tsx", import.meta.url), "utf8");
const actions = await readFile(new URL("../app/claims/[id]/spot-survey-actions.ts", import.meta.url), "utf8");

assert.match(workspace, /Spot Intimation Date/, "Claim header must show Spot Intimation Date.");
assert.match(workspace, /Spot Intimation Time/, "Claim header must show Spot Intimation Time.");
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

console.log("Claim spot multi-upload and intimation regression passed.");
