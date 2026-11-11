
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const guard = read("../lib/claim-pending-document-guard.ts");
const actions = read("../app/claims/stage-actions.ts");
const operations = read("../components/claim-manager/operations-claim-stages.tsx");
const stage3 = read("../components/final-documents/final-documents-workspace-v2.tsx");

const spotActions = read("../app/claims/internal-spot-intimation-actions.ts");
const spotPendingPattern = /^Verify first — (\d+) uploaded documents? pending verification: (.+)\.$/;
assert.equal(spotPendingPattern.exec("Verify first — 1 uploaded document pending verification: RC Copy.")?.[2], "RC Copy", "Single pending document must retain actual name.");
assert.equal(spotPendingPattern.exec("Verify first — 3 uploaded documents pending verification: RC Copy, Insurance Copy, Driver Licence.")?.[1], "3", "Pending count must be parsed.");
assert.equal(spotPendingPattern.exec("Verify first — 3 uploaded documents pending verification: RC Copy, Insurance Copy, Driver Licence.")?.[2], "RC Copy, Insurance Copy, Driver Licence", "Pending names must be preserved.");
assert.ok(spotActions.includes(String.raw`const pending = /^Verify first — (\d+) uploaded documents? pending verification: (.+)\.$/.exec(reason);`), "Spot Intimation server matcher must use the correct count and named-document format.");
assert.ok(spotActions.includes('Verification Pending — '), "Pending document errors must have a specific title.");
assert.ok(spotActions.includes('Required Details Missing — Please enter '), "Missing field names must be returned.");
assert.ok(spotActions.includes('Invalid Date or Time — '), "Date validation errors must stay distinct.");
assert.ok(spotActions.includes('Action Not Allowed — This claim cannot advance'), "Invalid stage transitions must be distinguished.");
assert.ok(spotActions.includes('Unable to Save — Please retry or contact support.'), "Unknown Save Details errors must be generic.");
assert.ok(spotActions.includes('Unable to Advance — Please retry or contact support.'), "Unknown advancement errors must be generic.");
assert.ok(spotActions.includes('saveInternalSpotIntimationDetailsWithFeedback'), "Save Details must have server-safe feedback.");
assert.ok(operations.includes('await saveInternalSpotIntimationDetailsWithFeedback(claimId, formData)'), "Spot Save Details must consume the safe result.");
assert.ok(operations.includes('if (!saved.ok) return { ok: false, message: saved.message }'), "Failed Save Details must not navigate.");
assert.ok(operations.includes('reason.slice(0, 500)'), "Named validation errors must not be lost to short generic popup truncation.");
assert.ok(guard.includes(String.raw`.replace(/[\r\n]/g, " ")`), "Document names must replace actual line breaks.");
assert.doesNotMatch(spotActions, /pending verification\\\\\./, "Do not restore double-escaped regex punctuation.");


assert.match(guard, /requireVerifiedClaimDocuments/, "Keep the authoritative document verification guard.");
assert.match(guard, /verification_status !== "verified" && doc.verification_status !== "rejected"/, "Rejected uploads remain excluded.");
const expected = String.raw`const pending = /^Verify first — (\d+) uploaded documents? pending verification(?:: (.+))?\.$/.exec(reason);`;
assert.ok(actions.includes(expected), "Correct pending-document regex must match actual guard messages.");
const pendingMatcher = /^Verify first — (\d+) uploaded documents? pending verification(?:: (.+))?\.$/;
assert.equal(pendingMatcher.exec("Verify first — 1 uploaded document pending verification.")?.[1], "1");
assert.equal(pendingMatcher.exec("Verify first — 3 uploaded documents pending verification.")?.[1], "3");
assert.equal(pendingMatcher.exec("Verify first — 3 uploaded documents pending verification: Accident Photo, RC Copy, Insurance Copy.")?.[2], "Accident Photo, RC Copy, Insurance Copy");
assert.equal(pendingMatcher.exec("Complete all mandatory stage fields before saving details."), null);
assert.ok(actions.includes("Verify these documents before saving:"), "Display actionable pending document names in feedback.");
assert.ok(actions.includes('before saving this stage.'), "Feedback should tell Operations what to do before saving.");
assert.match(operations, /completeClaimJourneyStageWithFeedback\(claimId, formData\)/, "Stages 2 and 4–9 must use safe feedback rather than direct throwing action.");
assert.match(operations, /if \(!result\.ok\) return \{ ok: false, message: result\.message/, "Known server validation must be displayed in the existing popup.");
assert.match(operations, /const pending = \//, "Client fallback should also recognize pending verification.");
assert.match(stage3, /completeClaimJourneyStageWithFeedback\(claimId, formData\)/, "Stage 3 must use the same safe feedback path.");
assert.match(stage3, /<ClaimStageErrorDialog/, "Retain a single accessible error popup.");
assert.doesNotMatch(actions, /Your entered details are preserved\.\x60/, "Verification message should stay one short sentence.");
console.log("Operations claim pending-document validation feedback regression passed.");
