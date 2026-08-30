import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
const loader = await readFile(new URL("../lib/operations-dashboard.ts", import.meta.url), "utf8");

assert.match(page, /getEffectivePermissionAccessMap\(profile\)/, "Dashboard must resolve permissions through the bulk access map");
assert.doesNotMatch(page, /hasEffectiveCapability\(/, "Dashboard must not fan out individual capability reads");
assert.match(page, /getOperationsDashboardData\(supabase, profile\)/, "Dashboard must pass the authenticated profile into its data loader");
assert.doesNotMatch(loader, /auth\.getUser\(/, "Operations dashboard loader must not reauthenticate");
assert.doesNotMatch(loader, /getAuthenticatedProfile\(/, "Operations dashboard loader must reuse the authenticated page profile");

console.log("Dashboard hot-path regression passed.");
