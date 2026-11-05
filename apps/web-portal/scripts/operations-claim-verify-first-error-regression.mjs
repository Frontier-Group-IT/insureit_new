
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const guard = read("../lib/claim-pending-document-guard.ts");
const actions = read("../app/claims/stage-actions.ts");
const operations = read("../components/claim-manager/operations-claim-stages.tsx");
const stage3 = read("../components/final-documents/final-documents-workspace-v2.tsx");

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
