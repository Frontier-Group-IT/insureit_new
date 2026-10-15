import fs from "node:fs";
import assert from "node:assert/strict";
const home=fs.readFileSync("app/customer/(protected)/home/page.tsx","utf8");
for(const snippet of [
  "resolveCustomerWebScope(params.account)",
  "loadCustomerWebVehicles(account.id)",
  "loadCustomerWebPolicies(account.id)",
  "loadCustomerClaimListContext(account.id)",
  "CustomerAccountTabs accounts={accounts}",
  "uncoveredVehicles.slice(0, 3)",
  "duePolicies.slice(0, 2)",
  "attentionCount === 0",
  "Needs your attention",
  "/customer/support",
  "/customer/insurance-quote",
  "/customer/renewals",
  "/customer/exchange",
  "/customer/vehicles/",
  "/customer/policies/",
]) assert.ok(home.includes(snippet), `Customer Home regression: missing ${snippet}`);
assert.ok(!home.includes("Your next steps"), "Removed Customer Home shortcut card must stay absent: Your next steps");
assert.ok(!home.includes("Everyday services"), "Removed Customer Home shortcut card must stay absent: Everyday services");
assert.ok(!home.includes("Claims progress"), "Removed Customer Home shortcut card must stay absent: Claims progress");
assert.ok(!home.includes("const kpis ="), "Old redundant KPI row should be removed");
assert.ok(!home.includes("label: \"WhatsApp\""), "Do not advertise a WhatsApp action that only opens Support");
assert.ok(!home.includes("label: \"Call\""), "Do not advertise a Call action that only opens Support");
assert.ok(!home.includes("createSupabaseAdminClient"), "No service-role bypass allowed");
console.log("Customer action-first Home regression passed");
