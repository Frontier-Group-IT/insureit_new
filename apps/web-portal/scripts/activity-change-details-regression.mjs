import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { activityChangeTitle, describeAuditedChanges, describeNamedChanges } from "../lib/activity-change-details.ts";

const customer = describeAuditedChanges("customer",
  { phone: "9876543210", email: "old@example.com", address: "Private home", customer_type: "individual", pan: "AAAAA1234A" },
  { phone: "9123456789", email: "new@example.com", address: "New private home", customer_type: "corporate", pan: "BBBBB4321B" },
);
assert.ok(customer);
assert.ok(customer.some(row => row.includes("Mobile number: ••••••3210 → ••••••6789")));
assert.ok(customer.some(row => row.includes("Customer type: individual → corporate")));
assert.ok(customer.some(row => row.includes("Address changed (values hidden)")));
assert.ok(!customer.join(" ").includes("9876543210"));
assert.ok(!customer.join(" ").includes("Private home"));
assert.ok(!customer.join(" ").includes("AAAAA1234A"));
assert.equal(describeAuditedChanges("customer", null, { phone: "9123456789" }), null);
assert.deepEqual(describeAuditedChanges("vehicle", { make:"Tata", chassis_no:"secret" }, { make:"Mahindra", chassis_no:"other" }), ["Manufacturer: Tata → Mahindra", "Chassis number changed (values hidden)"]);
assert.deepEqual(describeNamedChanges("vehicle", ["make", "chassis_no", "password", "make"]), ["Manufacturer changed (values not recorded)", "Chassis number changed (values not recorded)"]);
assert.match(activityChangeTitle("Customer",null), /details not recorded/);
assert.match(activityChangeTitle("Customer",customer), /other fields changed/);
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
for (const path of ["../components/customer-activity-status.tsx", "../components/vehicle-activity-status.tsx", "../components/policy-activity-status.tsx"]) {
  assert.match(read(path), /changes: activity\.changes/, path + " must render audit changes");
}
assert.match(read("../components/standard-activity-status-card.tsx"), /item\.changes\?\.length/, "shared UI must render individual changes");
assert.match(read("../lib/customer-activity.ts"), /describeAuditedChanges\("customer"/, "customer audits must use recorded old/new snapshots");
assert.match(read("../lib/vehicle-activity.ts"), /describeAuditedChanges\("vehicle"/, "vehicle audits must not invent differences");
console.log("Activity change details regression passed.");
