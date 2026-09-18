import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboardPage = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
const dashboardData = await readFile(new URL("../lib/operations-dashboard.ts", import.meta.url), "utf8");
const accountsDashboardData = await readFile(new URL("../lib/accounts-dashboard.ts", import.meta.url), "utf8");
const accountsBusinessMis = await readFile(new URL("../lib/accounts-business-mis.ts", import.meta.url), "utf8");
const accountsControls = await readFile(new URL("../app/accounts/accounts-controls.tsx", import.meta.url), "utf8");
const accountsPage = await readFile(new URL("../app/accounts/page.tsx", import.meta.url), "utf8");
const accountsWorkbook = await readFile(new URL("../app/accounts/business-mis-export/route.ts", import.meta.url), "utf8");
const accountsUpload = await readFile(new URL("../app/accounts/reconciliation-upload-actions.ts", import.meta.url), "utf8");
const dashboardMigration = await readFile(new URL("../../../supabase/migrations/20260831174500_optimize_operations_dashboard_single_pass.sql", import.meta.url), "utf8");

assert.match(dashboardPage, /getEffectivePermissionAccessMap\(profile\)/, "Dashboard should resolve effective permissions in one bulk read.");
assert.doesNotMatch(dashboardPage, /hasEffectiveCapability\(/, "Dashboard should not perform per-capability permission lookups.");
assert.match(dashboardPage, /const \[base, permissionMap\] = await Promise\.all\(\[/, "Dashboard base data and permission map should load in parallel after authentication.");
assert.match(dashboardPage, /getOperationsDashboardData\(supabase, profile\)/, "Dashboard base data should reuse the already-authenticated profile.");
assert.doesNotMatch(dashboardData, /getAuthenticatedProfile\(/, "Operations dashboard should not perform another authentication lookup.");
assert.doesNotMatch(dashboardData, /\.auth\.getUser\(/, "Operations dashboard should not perform a second direct Auth user lookup.");

assert.match(accountsDashboardData, /\.select\("policy_id,gross_payout,retention_amount"\)/, "Accounts dashboard payout totals must use the computed policy payout and retention fields.");
assert.doesNotMatch(accountsDashboardData, /\.select\("[^"]*partner_payout_amount[^"]*"\)/, "Accounts dashboard must not fetch partner payout planning inputs as projected cashflow.");
assert.match(accountsDashboardData, /function payoutValue\(row: PayoutRow\) \{\s*return numberValue\(row\.gross_payout\);\s*\}/s, "Accounts dashboard projected payout must resolve directly from gross_payout.");

assert.match(accountsPage, /loadAccountsDashboardSnapshot\(profile, filters\)/, "Accounts page must derive KPIs and Business MIS from one shared snapshot.");
assert.doesNotMatch(accountsPage, /loadAccountsDashboard\(/, "Accounts page must not run a second KPI data pipeline beside Business MIS.");
assert.doesNotMatch(accountsPage, /loadBusinessMisRows\(/, "Accounts page must not run a duplicate Business MIS data pipeline.");
assert.match(accountsBusinessMis, /payin_after_tds/, "Shared Accounts snapshot must preserve projected net pay-in semantics.");
assert.match(accountsBusinessMis, /Promise\.all\(\s*chunk\(payableIds, 120\)/s, "Accounts payment allocation reads should run in parallel by batch.");
assert.match(accountsBusinessMis, /\.or\(businessDateFilter\(filters\.fromDate, filters\.toDate\)\)/, "Accounts policy filtering must be pushed into the database query.");
assert.match(accountsBusinessMis, /if \(filters\.insurerId\) filteredPolicyQuery = filteredPolicyQuery\.eq\("insurance_company_id", filters\.insurerId\)/, "Accounts insurer filtering must be pushed into the database query.");
assert.match(accountsControls, /router\.prefetch\(accountsHref\(standardPeriod/, "Accounts controls should prefetch the alternate standard period.");

assert.doesNotMatch(accountsPage, /href="\/reconciliation"/, "New Accounts workflow must not redirect to legacy reconciliation.");
assert.doesNotMatch(accountsPage, /href="\/accounts\/billing"/, "New Accounts workflow must not redirect to legacy billing.");
assert.doesNotMatch(accountsPage, /href="\/accounts\/receivables"/, "New Accounts workflow must not redirect to legacy receivables.");
assert.match(accountsWorkbook, /book_append_sheet\(workbook, worksheet, "Business MIS"\)/, "Accounts reconciliation workbook must reuse the single Business MIS sheet.");
assert.match(accountsWorkbook, /BUSINESS_MIS_HIDDEN_HEADERS/, "Business MIS export must include hidden system IDs for reconciliation matching.");
assert.match(accountsWorkbook, /INSUREITTemplate/, "Business MIS export must carry template metadata for structural validation.");
assert.match(accountsUpload, /workbook\.SheetNames\.length !== 1 \|\| workbook\.SheetNames\[0\] !== "Business MIS"/, "Upload validation must require exactly the single Business MIS sheet.");
assert.match(accountsUpload, /Business MIS rows were added or removed/, "Upload validation must reject added or removed Business MIS rows.");
assert.match(accountsUpload, /System-controlled Business MIS values were edited/, "Upload validation must reject edits to system-controlled MIS values.");
assert.match(accountsUpload, /uploaded Difference will not be updated/, "Difference mismatches must warn that INSUREIT keeps the internally calculated value.");
assert.match(accountsUpload, /payinUploadGroups/, "Pay-In preview must retain duplicate-reference grouping checks.");
assert.match(accountsUpload, /payoutUploadGroups/, "Pay-Out preview must retain duplicate-reference grouping checks.");
assert.doesNotMatch(accountsUpload, /\.from\([^\n]+\)\.(?:insert|update|delete)\(|\.rpc\(/, "Accounts workbook preview must remain read-only; cryptographic hash updates are allowed but database writes are not.");

for (const aggregate of ["customer_stats", "vehicle_stats", "policy_stats", "claim_stats", "onboarding_stats", "task_stats", "document_stats", "activity_stats"]) {
  assert.match(dashboardMigration, new RegExp(`\\b${aggregate}\\s+as\\s*\\(`, "i"), `Operations dashboard migration should keep ${aggregate} as a consolidated aggregate.`);
}
assert.doesNotMatch(dashboardMigration, /'customers'\s*,\s*\(select count\(\*\) from public\.customers\)/i, "Dashboard totals should not re-scan customers for each metric.");
assert.doesNotMatch(dashboardMigration, /'policies'\s*,\s*\(select count\(\*\) from public\.policies\)/i, "Dashboard totals should not re-scan policies for each metric.");
assert.doesNotMatch(dashboardMigration, /'claims'\s*,\s*\(select count\(\*\) from public\.claims\)/i, "Dashboard totals should not re-scan claims for each metric.");

const dashboardView = await readFile(new URL("../app/dashboard-v2/dashboard-view.tsx", import.meta.url), "utf8");
const dashboardLinks = dashboardView.match(/<Link\b[^>]*>/gs) ?? [];
assert.ok(dashboardLinks.length > 0, "Dashboard should contain navigational links.");
for (const link of dashboardLinks) assert.match(link, /prefetch=\{false\}/, "Dashboard links must not auto-prefetch heavy authenticated routes.");

console.log("Dashboard performance regression passed.");
