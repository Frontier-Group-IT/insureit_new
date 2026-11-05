import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const widget = read("../components/claims/external-claim-bill-upload.tsx");
const customer = read("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
const upload = read("../app/customer/(protected)/claims/[id]/stage/[stage]/upload-action.ts");
const operations = read("../components/claim-manager/operations-claim-stages.tsx");
const operationsPage = read("../app/claims/[id]/page.tsx");

assert.match(customer, /selected\.key==="billing" \? <ExternalClaimBillUpload mode="customer"/, "Customer Billing must have bill upload");
assert.match(customer, /selected\.key==="billing"\?"lg:grid-cols-3"/, "Customer Billing must have a third column");
assert.match(customer, /ExternalClaimBillUpload mode="customer"[\s\S]*readonly/, "Completed/read-only customer Billing must show the uploaded document");
assert.match(operations, /selected\.key === "billing" && unrestrictedStageEditing && !partnerReadOnlyJourney && !partnerManagedJourney/, "Operations upload must be external and non-Partner");
assert.match(operations, /selected\.key === "billing" \? "lg:grid-cols-3"/, "Operations Billing must have a third column");
assert.match(operationsPage, /billDocuments=\{signedDocs\.filter/, "Operations must display persisted bill files");
assert.match(upload, /type==="Final Workshop Bill"[\s\S]*isExternalCustomerClaim\(claim\)/, "Customer upload must verify external policy");
assert.match(upload, /current!=="billing" && !billing\?\.completed/, "Customer upload must enforce stage availability");
assert.match(widget, /prepareClaimDocumentUpload[\s\S]*finalizeClaimDocumentUpload/, "Operations must use existing authorized signed upload path");
assert.match(widget, /uploadCustomerClaimDocument/, "Customer must use account-scoped upload action");
assert.match(widget, /VerifyDocumentButton claimId=\{claimId\} documentId=\{file\.id\}/, "Operations must be able to verify uploaded bills before stage save.");
assert.match(widget, /file\.verification_status !== "verified"/, "Only unverified bills should offer a verify action.");
assert.match(widget, /type="button" disabled=\{pending\}/, "File chooser must not submit billing stage");
assert.match(widget, /5 \* 1024 \* 1024/, "Maximum document size must remain 5MB");
console.log("External Claim Billing workshop bill upload regression passed.");
