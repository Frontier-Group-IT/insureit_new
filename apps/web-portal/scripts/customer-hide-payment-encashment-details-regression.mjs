import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const completed = read("../components/customer-portal/customer-internal-completed-journey.tsx");
const stagePage = read("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");

// Completed internal-claim stages keep their heading, green completion icon and status.
assert.ok(completed.includes('<section key={stage.key}'));
assert.ok(completed.includes('{stage.label}</span>'));
assert.ok(completed.includes('{status}</span>'));
assert.ok(completed.includes('<Check className="h-4 w-4"/>'));

// Only Payment Encashment loses its secondary detail card/fields.
// Other stages, including Delivery Order and Vehicle Delivery, remain intact.
assert.ok(completed.includes('{stage.key !== "payment_encashment" ? <div className="space-y-3'));
assert.ok(completed.includes('</div> : null}'));
assert.ok(completed.includes('stage.label+" Details"'));
assert.ok(completed.includes("CUSTOMER_EXTERNAL_STAGE_FIELDS[stage.key]"));
assert.ok(completed.includes('stage.key === "spot_intimation"'));
assert.ok(completed.includes('stage.key === "claim_intimation"'));
assert.ok(stagePage.includes("<CustomerInternalCompletedJourney"));

// Confirm the change is display-only: do not modify milestone status or claim data.
assert.ok(!completed.includes(".update("));
assert.ok(!completed.includes(".delete("));

console.log("Customer completed Payment Encashment detail visibility regression passed");
