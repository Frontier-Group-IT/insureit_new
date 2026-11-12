import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const read = p => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");

const action = read("../app/claims/[id]/reuse-policy-copy-action.ts");
const source = read("../lib/linked-claim-policy-copy.ts");
const page = read("../app/claims/[id]/page.tsx");
const workspace = read("../components/spot-survey/spot-survey-workspace-v2.tsx");
const button = read("../components/spot-survey/reuse-policy-copy-button.tsx");
const customerAction = read("../app/customer/(protected)/claims/[id]/stage/[stage]/reuse-policy-copy-action.ts");
const customerDelete = read("../app/customer/(protected)/claims/[id]/stage/[stage]/delete-document-action.ts");
const spotPage = read("../app/customer/(protected)/spot-intimation/page.tsx");
const customerStage = read("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
const customerCard = read("../components/customer-portal/customer-claim-compact-document.tsx");
const customerEvidence = read("../components/customer-portal/customer-claim-evidence-workspace.tsx");
const customerGroups = read("../components/customer-portal/customer-claim-document-groups.tsx");

// Source must resolve only the exact linked internal or external policy and its owning customer + vehicle.
assert.match(source, /claim\.external_policy_id \|\| claim\.policy_service_source === "external"/);
assert.match(source, /from\("external_policies"\)/);
assert.match(source, /from\("customer_documents"\)/);
assert.match(source, /from\("policy_documents"\)/);
assert.match(source, /\.eq\("external_policy_id", linked\.id\)/);
assert.match(source, /\.eq\("policy_id", linked\.id\)/);
assert.match(source, /\.eq\("customer_id", claim\.customer_id\)/);
assert.match(source, /\.eq\("vehicle_id", claim\.vehicle_id\)/);
assert.match(source, /\.eq\("document_type", "policy_copy"\)/);
assert.match(source, /\.eq\("storage_bucket",source\.storage_bucket\)\.eq\("storage_path",source\.storage_path\)/);
assert.match(source, /\.eq\("claim_id",claimId\)\.eq\("customer_id",customerId\)/);

// Operations' existing claim authorization remains, and duplicate exact documents are not copied again.
assert.match(action, /requireClaimWorkflowAccess\(claimId/);
assert.match(action, /findLinkedClaimPolicyCopy\(admin, claim\)/);
assert.match(action, /findExistingLinkedClaimCopy\(admin, claim\.id, claim\.customer_id, policyDocument\)/);
assert.match(action, /if \(existing\) return/);
assert.match(action, /verification_status:"pending",verification_required:true/);
assert.match(action, /from\("claim_documents"\)\.insert/);
assert.match(page, /canReusePolicyCopy=\{Boolean\(policyDocument && !hasLinkedClaimPolicyCopy/);
assert.match(page, /findLinkedClaimPolicyCopy\(admin, claim\)/);
assert.match(workspace, /ReusePolicyCopyButton/);
assert.match(button, /router\.refresh\(\)/);

// Customer reuse enforces account/claim scope, existing stage locks and preserves pending verification.
assert.match(customerAction, /resolveCustomerWebScope\(accountId\)/);
assert.match(customerAction, /loadCustomerClaimDetail\(account\.id, claimId\)/);
assert.match(customerAction, /Claim Intimation is complete\. Spot Intimation documents are locked/);
assert.match(customerAction, /Completed managed claims cannot accept new customer documents/);
assert.match(customerAction, /findExistingLinkedClaimCopy\(admin, claim\.id, account\.id, source\)/);
assert.match(customerAction, /if \(existing\) return/);
assert.match(customerAction, /verification_status:"pending",verification_required:true/);
assert.match(customerAction, /from\("claim_documents"\)\.insert/);
assert.match(spotPage, /canReusePolicyCopy=\{canReusePolicyCopy\}/);
assert.match(customerStage, /canReusePolicyCopy=\{canReusePolicyCopy\}/);
assert.match(customerEvidence, /item\.type === "Insurance Copy" && canReusePolicyCopy/);
assert.match(customerGroups, /item\.type === "Insurance Copy" && canReusePolicyCopy/);
assert.match(customerCard, /Use Existing Policy Copy/);
assert.match(customerCard, /reuseCustomerLinkedPolicyCopy\(accountId,claimId,stage\)/);
assert.match(customerCard, /ClaimStageErrorDialog/);
assert.doesNotMatch(customerAction, /policy_service_source === "external"\) return/);
// Reused policy copies must detach from a claim without deleting the shared source file.
assert.match(customerDelete, /async function isLinkedPolicyCopy\(/, "Shared policy-copy detachment must be source-aware.");
assert.match(customerDelete, /file\.document_type\.toLowerCase\(\)\.replace/, "Only Insurance Copy can follow the linked-policy detach path.");
assert.match(customerDelete, /from\("external_policies"\)/, "External links must be verified against the owned external policy.");
assert.match(customerDelete, /from\("customer_documents"\)/, "External policy copies must match a real customer document.");
assert.match(customerDelete, /from\("policies"\)/, "Internal links must be verified against the owned internal policy.");
assert.match(customerDelete, /from\("policy_documents"\)/, "Internal policy copies must match their original document.");
assert.match(customerDelete, /\.eq\("customer_id", customerId\)/, "Linked-source lookup must be customer-scoped.");
assert.match(customerDelete, /\.eq\("vehicle_id", claim\.vehicle_id\)/, "Linked policy must match the claim's vehicle.");
assert.match(customerDelete, /\.eq\("storage_bucket", file\.storage_bucket\)/, "Linked-source lookup must match the exact bucket.");
assert.match(customerDelete, /\.eq\("storage_path", file\.storage_path\)/, "Linked-source lookup must match the exact path.");
assert.match(customerDelete, /const isPolicyReference = await isLinkedPolicyCopy\(db, claim, account\.id, file\)/, "Stage delete must detect trusted linked policy copies.");
assert.match(customerDelete, /if \(!isClaimOwnedUpload && !isPolicyReference\)/, "Unknown storage origins remain blocked.");
assert.match(customerDelete, /if \(isClaimOwnedUpload && !isPolicyReference\)/, "Policy-copy detach must not remove shared storage bytes.");
assert.match(customerDelete, /cleanupUnreferencedClaimStorage/, "Direct claim uploads retain safe orphan cleanup.");
assert.match(customerDelete, /\["claim_documents", "policy_documents", "customer_documents"\]/, "File cleanup must check for other document references first.");
assert.match(customerDelete, /\.eq\("document_type", file\.document_type\)\.eq\("verification_status", "pending"\)/, "Verification races must still prevent deletion.");
console.log("Internal/external claim policy-copy reuse and customer scope regression passed");
