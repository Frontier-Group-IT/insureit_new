import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../app/customer/(protected)/support/page.tsx", import.meta.url)), "utf8");
for (const removed of [
  "Choose the quickest way to reach us",
  "Track your latest support tickets",
  "Tell us what you need and our team",
  "summary.open", "summary.inProgress", "summary.resolved",
]) assert.ok(!source.includes(removed), `Unexpected support clutter: ${removed}`);
assert.ok(!source.includes('border border-[#D8E1EC] bg-white px-3 py-2.5 lg:w-[430px]'), "Search must have no redundant border");
for (const kept of [
  "How can we", "My Support Requests", "Raise a Support Ticket",
  "Call Support", "WhatsApp", "Search requests", "CustomerServiceRequestForm",
  "loadCustomerServiceActivity", "loadCustomerSupportClaims", "EmptyCustomerState",
  "name=\"account\"", "name=\"q\"",
]) assert.ok(source.includes(kept), `Required functionality missing: ${kept}`);
console.log("Customer Support UI cleanup contract passed");
