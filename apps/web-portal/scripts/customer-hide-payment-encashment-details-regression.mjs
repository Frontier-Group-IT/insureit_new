import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const completed = read("../components/customer-portal/customer-internal-completed-journey.tsx");
const stagePage = read("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
const stageFields = read("../lib/customer-claim-stage-fields.ts");

// Completed internal stages keep their title and green check, without a
// redundant "Completed" subtitle or a second "... Details" heading.
assert.ok(completed.includes('<section key={stage.key}'));
assert.ok(completed.includes('{stage.label}</span>'));
assert.ok(completed.includes('<Check className="h-4 w-4"/>'));
assert.ok(!completed.includes('const status = "Completed"'));
assert.ok(!completed.includes('{status}</span>'));
assert.ok(!completed.includes('stage.label+" Details"'));
assert.ok(!completed.includes('Accident & Spot Intimation Details'));

// All completed stages, including Payment Encashment, use the same saved
// milestone fields and fallback for missing recorded details.
assert.ok(!completed.includes('stage.key !== "payment_encashment"'));
assert.ok(completed.includes('const details = milestone?.details ?? {}'));
assert.ok(completed.includes('CUSTOMER_EXTERNAL_STAGE_FIELDS[stage.key]'));
assert.ok(completed.includes('details[field.key]'));
assert.ok(completed.includes('{[...fields,...extra].map('));
assert.ok(completed.includes('No details recorded for this stage yet.'));
assert.ok(stageFields.includes('payment_encashment: ['));
for (const key of ["depreciation_submitted", "satisfaction_submitted", "documents_submit_date", "payment_received_date", "payment_received_amount"]) {
  assert.ok(stageFields.includes('key: "' + key + '"'), 'Payment Encashment field missing: ' + key);
}

// Existing stage-specific document/evidence areas and route remain intact.
assert.ok(completed.includes('stage.key === "spot_intimation"'));
assert.ok(completed.includes('stage.key === "claim_intimation"'));
assert.ok(stagePage.includes("<CustomerInternalCompletedJourney"));

// Display-only change: no claim/milestone mutations or authorization changes.
assert.ok(!completed.includes(".update("));
assert.ok(!completed.includes(".delete("));

console.log("Customer completed journey compact labels and Payment Encashment regression passed");
