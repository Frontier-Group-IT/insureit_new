import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

const data = read("../lib/customer-web-phase2-data.ts");
const resolver = read("../lib/customer-claim-reupload.ts");
const notice = read("../components/customer-portal/customer-claim-reupload-notice.tsx");
const claimPage = read("../app/customer/(protected)/claims/[id]/page.tsx");
const stagePage = read("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
const focus = read("../components/customer-portal/customer-claim-reupload-focus.tsx");
const completed = read("../components/customer-portal/customer-internal-completed-journey.tsx");
const group = read("../components/customer-portal/customer-claim-document-groups.tsx");
const workspace = read("../components/customer-portal/customer-claim-evidence-workspace.tsx");
const compact = read("../components/customer-portal/customer-claim-compact-document.tsx");
const bulk = read("../components/customer-portal/customer-claim-multiple-upload.tsx");
const bill = read("../components/claims/external-claim-bill-upload.tsx");
const action = read("../app/customer/(protected)/claims/[id]/stage/[stage]/upload-action.ts");

// Exact same activity family as the Customer App; preserve tenant and claim scope.
assert.match(data, /\.from\("customer_activity_events"\)/);
assert.match(data, /\.eq\("customer_id", customerId\)\.eq\("claim_id", claimId\)/);
assert.match(data, /"claim_document_reuploaded", "claim_document_reupload_resolved"/);
assert.match(resolver, /event\.title\.toLowerCase\(\)\.includes\("reupload requested"\)/);
assert.match(resolver, /original\.verification_status !== "rejected"/);
assert.match(resolver, /replacement\?\.verification_status === "verified"/);
assert.match(resolver, /"awaiting_verification"/);
assert.match(resolver, /finalworkshopbill/);

// Warning must be visible on both claim overview and stage screens, even after claim completion.
assert.match(claimPage, /<CustomerClaimReuploadNotice requests=\{reuploadRequests\}/);
assert.match(stagePage, /<CustomerClaimReuploadNotice requests=\{reuploadRequests\}/g);
assert.match(notice, /Action needed: replace a claim document/);
assert.match(notice, /Replacement submitted — awaiting verification/);
assert.match(notice, /Open stage/);
assert.match(notice, /request: request\.id/);
assert.match(stagePage, /selectedRequest = reuploadRequests\.find/);
assert.match(stagePage, /request\.status === "action_required"/);
assert.match(stagePage, /<CustomerClaimReuploadFocus requestId=\{selectedRequest\?\.id \?\? null\}/);
assert.match(focus, /getElementById\("claim-reupload-target"\)/);
assert.match(focus, /scrollIntoView/);

// Group, card, and completed view only expose the exact requested document upload.
assert.match(group, /groups\.findIndex/);
assert.match(group, /setActive\(requestedGroup\)/);
assert.match(group, /reuploadTarget=/);
assert.match(compact, /id=\{reuploadTarget \? "claim-reupload-target" : undefined\}/);
assert.match(compact, /name="reupload_request" value=\{reuploadRequestId\}/);
assert.match(completed, /allowUpload=\{false\}/);
assert.match(completed, /reuploadStage === "spot_intimation"/);
assert.match(completed, /reuploadStage === "claim_intimation"/);
assert.match(workspace, /reuploadDocumentType/);
assert.match(bulk, /data\.set\("reupload_request",reuploadRequestId\)/);
assert.match(bill, /form\.set\("reupload_request", reuploadRequestId\)/);

// Do not weaken protected completed-claim or stage-two guards for unrelated uploads.
assert.match(action, /request\.id === requestId && request\.status === "action_required"/);
assert.match(action, /sameClaimDocumentType\(request\.documentType, type\)/);
assert.match(action, /!authorizedReplacement/);
assert.match(action, /Completed managed claims cannot accept new customer documents/);
assert.match(action, /Stage 1 documents are locked/);
assert.match(action, /Completed claims cannot accept new workshop bills/);
assert.doesNotMatch(stagePage, /update\(\{\s*current_status/, "Navigation must not modify claim completion.");
console.log("Customer Portal re-upload warning, exact-document navigation, and server guard contracts passed");
