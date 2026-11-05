import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const helper = read("../lib/dashboard-scoped-query-batches.ts");
const scoped = read("../lib/scoped-operations-dashboard.ts");
const dashboard = read("../app/dashboard-v2/dashboard-data.ts");
const source = read("../app/dashboard/page.tsx");
const view = read("../app/dashboard-v2/dashboard-view.tsx");

assert.match(helper, /dashboardScopeBatchSize = 100;/, "Bound UUID list in each PostgREST URL.");
assert.match(helper, /dashboardScopePageSize = 500;/, "Use explicit pagination below PostgREST row cap.");
assert.match(helper, /if \(response\.error\) return \{ data: null, error: new Error\(response\.error\.message\) \}/,
  "A failed batch must not produce silently partial or incorrect metrics.");
assert.match(helper, /if \(page\.length < dashboardScopePageSize\) break/,
  "Full result pages must continue loading until the final partial page.");

for (const table of ["customers", "claims", "vehicles", "policies", "claim_tasks", "claim_documents", "customer_activity_events"]) {
  assert.ok(scoped.includes('.from("' + table + '")'), "Scoped Operations dashboard must retain " + table);
}
assert.ok((scoped.match(/loadScopedDashboardRows\(/g) ?? []).length >= 7, "All Operations scoped requests must be bounded.");
assert.doesNotMatch(scoped, /\.in\("customer_id", scopedCustomerIds\)/, "No large monolithic scoped customer queries.");
assert.doesNotMatch(scoped, /\.in\("id", customerIds\)/, "No large monolithic customer ID query.");
assert.match(scoped, /latestClaims: \[\.\.\.claimRows\]\.sort/,
  "Chunked claim results must still show the most recent claims.");

assert.match(dashboard, /loadScopedDashboardRows\(claimCustomerIds/, "RM claim analytics use bounded requests.");
assert.match(dashboard, /loadScopedDashboardRows\(taskCustomerIds/, "RM task scope uses bounded requests.");
assert.match(dashboard, /loadScopedDashboardRows\(taskClaimIds/, "Task totals use bounded claim IDs.");
assert.match(dashboard, /loadScopedDashboardRows\(customerIds/, "RM fleet uses bounded requests.");
assert.match(dashboard, /loadScopedDashboardRows\(openIds/, "Claim documents use bounded claim IDs.");
assert.match(dashboard, /loadScopedDashboardRows\(financialClaimIds/, "Claim financials use bounded claim IDs.");
assert.match(dashboard, /loadScopedDashboardRows\(internalOpenIds/, "Claim stage amounts use bounded claim IDs.");
assert.match(dashboard, /\.sort\(\(a, b\) => b\.updated_at\.localeCompare\(a\.updated_at\)\)/,
  "Claim analytics must maintain chronological ordering despite batching.");
assert.match(source, /getEffectivePermissionAccessMap/, "Existing role capabilities remain enforced.");
assert.match(source, /getOperationsDashboardData\(supabase, profile\)/,
  "Scoped dashboard must continue using signed-in profile.");
assert.match(dashboard, /b\.created_at\.localeCompare\(a\.created_at\)/, "Latest stage financial values must win after page stitching.");
assert.match(view, /data\.base\.errors\.includes\("Customer portfolio could not be loaded\."\) \? "—"/, "Failed customer totals must never be displayed as a real zero.");
console.log("RM Dashboard bounded scope queries, paging and failure handling regression passed.");
