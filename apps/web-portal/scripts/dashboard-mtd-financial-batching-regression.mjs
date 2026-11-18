import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadScopedDashboardRows, dashboardScopeBatchSize, dashboardScopePageSize } from "../lib/dashboard-scoped-query-batches.ts";

const source = readFileSync(new URL("../app/dashboard-v2/dashboard-data.ts", import.meta.url), "utf8");
const ids = Array.from({ length: 646 }, (_, i) => "synthetic-policy-" + String(i + 1).padStart(4, "0"));
const calls = [];
const premiums = await loadScopedDashboardRows(ids, async (batch, from, to) => {
  calls.push({ count: batch.length, from, to });
  return { data: batch.slice(from, to + 1).map(policy_id => ({
    policy_id, net_premium: 100, gross_premium: 118,
  })), error: null };
});

assert.equal(dashboardScopeBatchSize, 100, "Keep UUID filters small enough for PostgREST URLs");
assert.equal(dashboardScopePageSize, 500, "Preserve the capped page size");
assert.equal(calls.length, 7, "646 MTD policies require seven bounded requests rather than one oversized UUID list");
assert(calls.every(call => call.count <= 100), "No request may contain more than 100 policy IDs");
assert.equal(premiums.error, null, "All successful batch results should be accepted");
assert.equal(premiums.data?.length, 646, "All 646 premium rows must be aggregated, not truncated to the first batch");
assert.equal(premiums.data?.reduce((total, row) => total + row.net_premium, 0), 64600, "Net premium totals must include every batch");
assert.equal(premiums.data?.reduce((total, row) => total + row.gross_premium, 0), 76228, "Gross premium totals must include every batch");

const multiplePages = Array.from({ length: 620 }, (_, i) => ({ policy_id: "synthetic", sequence: i }));
let pageCalls = 0;
const paged = await loadScopedDashboardRows(["synthetic"], async (_batch, from, to) => {
  pageCalls++;
  return { data: multiplePages.slice(from, to + 1), error: null };
});
assert.equal(pageCalls, 2, "A full 500-row response must trigger the following page");
assert.equal(paged.data?.length, multiplePages.length, "Rows must remain complete when a batch needs pagination");

let requestCount = 0;
const failed = await loadScopedDashboardRows(ids, async batch => {
  requestCount++;
  if (requestCount === 3) return { data: null, error: { message: "simulated PostgREST failure" } };
  return { data: batch.map(policy_id => ({ policy_id })), error: null };
});
assert.equal(failed.data, null, "Any failed batch must discard all partial financial totals");
assert.match(failed.error?.message ?? "", /simulated PostgREST failure/, "A failed batch must return its actual diagnostic message");
assert.equal(requestCount, 3, "Stop immediately after the first failed batch");

for (const [name, type] of [
  ["policy_premium_details", "PremiumRow"],
  ["policy_payin_details", "PayinRow"],
  ["policy_intermediary_payouts", "PayoutRow"],
]) {
  const query = new RegExp('loadScopedDashboardRows<' + type + '>\\(mtdPolicyIds, \\(batch, from, to\\) => admin[\\s\\S]*?\\.from\\("' + name + '"\\)[\\s\\S]*?\\.in\\("policy_id", batch\\)\\.order\\("policy_id"\\)\\.range\\(from, to\\)', "m");
  assert.match(source, query, name + " must use bounded policy-ID lists, deterministic ordering and explicit row pagination");
}
assert.doesNotMatch(source, /\.in\("policy_id", mtdPolicyIds\)/, "Never restore a monolithic 25KB ID filter");
assert.doesNotMatch(source, /\.in\("policy_id", mtdPolicies\.map\(/, "Never rebuild the oversized premium URL from policy records");
assert.match(source, /if \(premiumResult\.error\) warnings\.push\("MTD premium figures could not be refreshed\."\)/, "Premium failures must remain visible");
assert.match(source, /if \(payinResult\.error \|\| payoutResult\.error\) warnings\.push\("MTD commercial operations could not be refreshed\."\)/, "Commercial failures must remain visible");
assert.match(source, /if \(!payinResult\.error && !payoutResult\.error && !receivableResult\.error && !invoiceResult\.error && !payableResult\.error\)/, "Never show partial commercial metrics when a dependency fails");
assert.match(source, /if \(access\.viewAccounts && access\.commercial\)/, "Financial data must remain role-gated");

console.log("Dashboard MTD financial batching, complete totals, failure isolation and access contract regression passed.");
