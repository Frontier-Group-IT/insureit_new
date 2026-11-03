import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
const server = read("../app/policies/policy-document-actions.ts");
const client = read("../components/policy-save-confirmation.tsx");
const edits = read("../components/policy-edit-copy-footer-actions.tsx");
const next = read("../next.config.mjs");

assert.match(server, /export async function preparePolicyCopyUpload/, "Server must issue signed upload permission for an existing policy.");
assert.match(server, /export async function finalizePolicyCopyUpload/, "Server must register only uploaded files.");
assert.match(server, /requirePolicyEditor\(policyId\)/, "Every phase must check authorized policy edit access.");
assert.match(server, /\.from\("policies"\)\.select\("id"\)\.eq\("id", policyId\)/, "Must reject uploads for policies not in database.");
assert.match(server, /createSignedUploadUrl\(path, \{ upsert: false \}\)/, "Storage token must not permit replacing existing files.");
assert.match(server, /storageFile\.size !== file\.size/, "Server must check authoritative file size.");
assert.match(server, /storageFile\.contentType !== file\.type/, "Server must check authoritative MIME type.");
assert.match(server, /suffix\.includes\("\/"\)/, "Do not permit arbitrary nested upload paths.");
assert.match(server, /MAX_POLICY_COPY_BYTES = 15 \* 1024 \* 1024/, "Preserve 15MB upload limit.");
assert.match(server, /ALLOWED_POLICY_COPY_TYPES/, "Preserve file-type allowlist.");
assert.match(server, /existing\.data\) return \{ ok: true, documentId: existing\.data\.id \}/, "Finalization must be idempotent.");
assert.match(server, /\.eq\("storage_path", path\)/, "Duplicate finalization must use storage path.");
assert.match(server, /file_name: file\.name/, "Preserve policy copy display name.");
assert.match(server, /uploaded_by: profile\.id/, "Documents must retain authorized uploader.");
assert.doesNotMatch(server, /\.upload\(storagePath, file,/, "Do not transmit binary files through a server action.");

assert.match(client, /createSupabaseBrowserClient/, "Browser must own the signed upload request.");
assert.match(client, /uploadToSignedUrl\(prepared\.path, prepared\.token, fileToUpload/, "Binary file must upload directly to Supabase.");
assert.match(client, /preparePolicyCopyUpload\(policyId, \{/, "Only metadata may be sent to server prepare.");
assert.match(client, /finalizePolicyCopyUpload\(policyId, session\.path/, "Registration must follow the signed upload.");
assert.match(client, /signedUploadSession\.current/, "Retain in-flight upload state for safe retries.");
assert.match(client, /pendingPostSaveUpload/, "Keep existing post-save recovery state.");
assert.match(client, /persistPendingUpload\(file\)/, "Keep browser persistence for post-save retry.");
assert.match(client, /Retry Upload/, "Keep visible recovery action.");
assert.doesNotMatch(client, /new FormData\(\)/, "Never send policy copy file through Vercel Server Actions.");
assert.doesNotMatch(client, /uploadPolicyCopy\(/, "Legacy server binary uploader must not be used.");
assert.match(edits, /savePolicyCopyForEdit/, "Existing Edit Policy attachment path is unchanged.");
assert.match(next, /bodySizeLimit: "25mb"/, "Other Server Action behavior remains unchanged.");
console.log("Policy copy direct-to-storage upload, signed authorization and no-duplicate retry regression passed.");
