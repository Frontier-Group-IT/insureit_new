import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboardPage = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
const dashboardData = await readFile(new URL("../lib/operations-dashboard.ts", import.meta.url), "utf8");
const dashboardMigration = await readFile(
  new URL("../../../supabase/migrations/20260831174500_optimize_operations_dashboard_single_pass.sql", import.meta.url),
  "utf8",
);

assert.match(
  dashboardPage,
  /getEffectivePermissionAccessMap\(profile\)/,
  "Dashboard should resolve effective permissions in one bulk read.",
);
assert.doesNotMatch(
  dashboardPage,
  /hasEffectiveCapability\(/,
  "Dashboard should not perform per-capability permission lookups.",
);
assert.match(
  dashboardPage,
  /const \[base, permissionMap\] = await Promise\.all\(\[/,
  "Dashboard base data and permission map should load in parallel after authentication.",
);
assert.match(
  dashboardPage,
  /getOperationsDashboardData\(supabase, profile\)/,
  "Dashboard base data should reuse the already-authenticated profile.",
);
assert.doesNotMatch(
  dashboardData,
  /getAuthenticatedProfile\(/,
  "Operations dashboard should not perform another authentication lookup.",
);
assert.doesNotMatch(
  dashboardData,
  /\.auth\.getUser\(/,
  "Operations dashboard should not perform a second direct Auth user lookup.",
);

for (const aggregate of [
  "customer_stats",
  "vehicle_stats",
  "policy_stats",
  "claim_stats",
  "onboarding_stats",
  "task_stats",
  "document_stats",
  "activity_stats",
]) {
  assert.match(
    dashboardMigration,
    new RegExp(`\\b${aggregate}\\s+as\\s*\\(`, "i"),
    `Operations dashboard migration should keep ${aggregate} as a consolidated aggregate.`,
  );
}
assert.doesNotMatch(
  dashboardMigration,
  /'customers'\s*,\s*\(select count\(\*\) from public\.customers\)/i,
  "Dashboard totals should not re-scan customers for each metric.",
);
assert.doesNotMatch(
  dashboardMigration,
  /'policies'\s*,\s*\(select count\(\*\) from public\.policies\)/i,
  "Dashboard totals should not re-scan policies for each metric.",
);
assert.doesNotMatch(
  dashboardMigration,
  /'claims'\s*,\s*\(select count\(\*\) from public\.claims\)/i,
  "Dashboard totals should not re-scan claims for each metric.",
);


const dashboardView = await readFile(new URL("../app/dashboard-v2/dashboard-view.tsx", import.meta.url), "utf8");
const dashboardLinks = dashboardView.match(/<Link\b[^>]*>/gs) ?? [];
assert.ok(dashboardLinks.length > 0, "Dashboard should contain navigational links.");
for (const link of dashboardLinks) {
  assert.match(link, /prefetch=\{false\}/, "Dashboard links must not auto-prefetch heavy authenticated routes.");
}

console.log("Dashboard performance regression passed.");
