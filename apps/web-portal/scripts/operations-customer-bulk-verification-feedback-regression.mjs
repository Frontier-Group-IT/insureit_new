import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const spot = read("../components/spot-survey/spot-survey-workspace-v2.tsx");
const actions = read("../app/claims/[id]/spot-survey-actions.ts");
const spotActions = read("../app/claims/internal-spot-intimation-actions.ts");
const stages = read("../components/claim-manager/operations-claim-stages.tsx");
const guard = read("../lib/claim-pending-document-guard.ts");

// Customer-uploaded Other Document files are visible and can be explicitly categorized.
// Classification does not bypass document verification or expand categories/permissions.
assert.match(spot, /const customerMultipleDocuments = documents\.filter/);
assert.match(spot, /document_type\?\.trim\(\)\.toLowerCase\(\) === "other document"/);
assert.match(spot, /<UnclassifiedAttachments claimId=\{claim\.id\} documents=\{customerMultipleDocuments\} title="Customer Multiple Documents"/);
assert.match(spot, /documents\.map\(\(document\) => \(/, "Each uploaded file must render.");
assert.match(spot, /document\.signedUrl \? <Link/, "Uploaded file preview remains authorized.");
assert.match(spot, /<input type="hidden" name="documentId" value=\{document\.id\}/, "Classification must target exact document.");
assert.match(actions, /\["Spot Intimation Attachment", "Other Document"\]\.includes\(document\.document_type\)/, "Classify both Operations and Customer bulk uploads.");
assert.match(actions, /\.eq\("id", documentId\)\.eq\("claim_id", claimId\)\.eq\("document_type", document\.document_type\)/, "Classify the exact current unclassified row.");
assert.match(actions, /const \{ profile, claim, supabase, isPartner \} = await context\(claimId\)/, "Preserve scoped claim authorization.");
assert.match(spot, /Documents Verified/, "Verification summary remains.");
assert.doesNotMatch(spot, /\{documents\.length\} uploaded file/, "Remove redundant total badge.");

// Stage 1 known validation failures must cross the server action boundary as safe feedback.
assert.match(spotActions, /export async function advanceInternalSpotIntimationWithFeedback/);
assert.match(spotActions, /await advanceInternalSpotIntimation\(claimId, formData\)/, "Preserve the original authorized workflow action.");
assert.match(spotActions, /Verify \$\{count\} uploaded document/, "Return a specific pending count.");
assert.match(stages, /const advanced = await advanceInternalSpotIntimationWithFeedback\(claimId, formData\)/);
assert.match(stages, /if \(!advanced\.ok\) return \{ ok: false, message: advanced\.message/, "Expected failures must reach the existing popup.");
assert.match(stages, /<ClaimStageErrorDialog message=\{errorNotice \? summarizeClaimActionError\(errorNotice\)/, "Retain the accessible popup.");
assert.match(guard, /requireVerifiedClaimDocuments/, "Preserve verification gate.");
assert.match(guard, /doc\.verification_status !== "verified" && doc\.verification_status !== "rejected"/, "Keep existing pending count logic.");

console.log("Operations Customer bulk visibility and verification error feedback regression passed.");
