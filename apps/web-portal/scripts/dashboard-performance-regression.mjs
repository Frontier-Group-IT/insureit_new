import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboardPage = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
const dashboardData = await readFile(new URL("../lib/operations-dashboard.ts", import.meta.url), "utf8");

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
  /getOperationsDashboardData\(supabase, accessToken\)/,
  "Dashboard base data should reuse the existing authenticated access token.",
);
assert.match(
  dashboardData,
  /getAuthenticatedProfile\(accessToken\)/,
  "Operations dashboard should reuse the request-cached authentication helper.",
);
assert.doesNotMatch(
  dashboardData,
  /\.auth\.getUser\(/,
  "Operations dashboard should not perform a second direct Auth user lookup.",
);


const dashboardView = await readFile(new URL("../app/dashboard-v2/dashboard-view.tsx", import.meta.url), "utf8");
const dashboardLinks = dashboardView.match(/<Link\b[^>]*>/gs) ?? [];
assert.ok(dashboardLinks.length > 0, "Dashboard should contain navigational links.");
for (const link of dashboardLinks) {
  assert.match(link, /prefetch=\{false\}/, "Dashboard links must not auto-prefetch heavy authenticated routes.");
}

console.log("Dashboard performance regression passed.");
