import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboardPage = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
const dashboardData = await readFile(new URL("../lib/operations-dashboard.ts", import.meta.url), "utf8");
const accountsDashboardData = await readFile(new URL("../lib/accounts-dashboard.ts", import.meta.url), "utf8");
const accountsBusinessMis = await readFile(new URL("../lib/accounts-business-mis.ts", import.meta.url), "utf8");
const accountsClient = await readFile(new URL("../app/accounts/accounts-dashboard-client.tsx", import.meta.url), "utf8");
const accountsSnapshotActions = await readFile(new URL("../app/accounts/accounts-snapshot-actions.ts", import.meta.url), "utf8");
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
assert.match(accountsBusinessMis, /\.or\(businessDateFilter\(filters\.fromDate, filters\.toDate\)\)/, "Accounts policy filtering must be pushed into the database query.");
assert.match(accountsBusinessMis, /if \(filters\.insurerId\) filteredPolicyQuery = filteredPolicyQuery\.eq\("insurance_company_id", filters\.insurerId\)/, "Accounts insurer filtering must be pushed into the database query.");
assert.match(accountsClient, /loadAccountsSnapshotAction\(/, "Accounts filters should refresh through the lightweight snapshot action.");
assert.match(accountsClient, /window\.history\.replaceState\(window\.history\.state/, "Accounts filter changes should update the URL without a full route render.");
assert.doesNotMatch(accountsClient, /router\.replace\(/, "Accounts filter changes must not trigger full App Router page replacement.");
assert.match(accountsClient, /cache\.current\.get\(key\)/, "Accounts client should reuse already fetched filter snapshots.");
assert.match(accountsSnapshotActions, /loadAccountsDashboardSnapshot\(profile, filters, \{ includeInsurers: false \}\)/, "Accounts refresh action must skip the repeated insurer-options query.");
assert.match(accountsClient, /const inflight = useRef\(new Map<string, Promise<Result>>\(\)\)/, "Accounts client must deduplicate in-flight filter requests.");
assert.match(accountsClient, /window\.setTimeout\(\(\) => \{[\s\S]*\["last_month", "mtd"\]/, "Accounts client should prewarm standard periods shortly after load.");
assert.match(accountsBusinessMis, /options: \{ includeInsurers\?: boolean \} = \{\}/, "Accounts snapshot loader must support omitting insurer options on refresh.");
assert.match(accountsBusinessMis, /policy_premium_details\(od_premium,tp_premium,cpa_amount,net_premium\)/, "Accounts snapshot must embed premium rows in the filtered policy query.");
assert.match(accountsBusinessMis, /policy_payin_details\(projected_od_percent,[^"]*payin_after_tds\)/, "Accounts snapshot must embed pay-in rows in the filtered policy query.");
assert.match(accountsBusinessMis, /partner_payables\(id,partner_payment_allocations\(allocated_amount,partner_payments\(payment_date,payment_reference\)\)\)/, "Accounts snapshot must embed payable payment allocations in the filtered policy query.");
assert.doesNotMatch(accountsBusinessMis, /db\.from\("policy_premium_details"\)/, "Accounts snapshot must not issue a separate premium query.");
assert.doesNotMatch(accountsBusinessMis, /db\.from\("policy_payin_details"\)/, "Accounts snapshot must not issue a separate pay-in query.");
assert.doesNotMatch(accountsBusinessMis, /db\.from\("partner_payment_allocations"\)/, "Accounts snapshot must not issue a separate payment-allocation query.");

assert.doesNotMatch(accountsPage, /href="\/reconciliation"/, "New Accounts workflow must not redirect to legacy reconciliation.");
assert.doesNotMatch(accountsPage, /href="\/accounts\/billing"/, "New Accounts workflow must not redirect to legacy billing.");
assert.doesNotMatch(accountsPage, /href="\/accounts\/receivables"/, "New Accounts workflow must not redirect to legacy receivables.");
assert.match(accountsWorkbook, /book_append_sheet\(workbook, worksheet, "Business MIS"\)/, "Accounts reconciliation workbook must reuse the single Business MIS sheet.");
assert.match(accountsWorkbook, /BUSINESS_MIS_HIDDEN_HEADERS/, "Business MIS export must include hidden system IDs for reconciliation matching.");
assert.match(accountsWorkbook, /INSUREITTemplate/, "Business MIS export must carry template metadata for structural validation.");
assert.match(accountsWorkbook, /book_append_sheet\(workbook, metadataSheet, "INSUREIT_META"\)/, "Business MIS export must persist durable reconciliation metadata in a dedicated worksheet.");
assert.match(accountsWorkbook, /\{ name: "INSUREIT_META", Hidden: 1 \}/, "INSUREIT metadata worksheet must be hidden from normal Accounts users.");
assert.match(accountsWorkbook, /\["INSUREIT_META_V3", ""\]/, "Hidden metadata worksheet must carry the durable marker.");
assert.match(accountsUpload, /readTemplateMetadata\(workbook, sheet, workbook\.Sheets\[METADATA_SHEET_NAME\]\)/, "Upload validation must resolve metadata from the dedicated hidden sheet.");
assert.match(accountsUpload, /readHiddenMetadataSheet\(metadataSheet\)/, "Upload validation must support the hidden metadata sheet when custom properties are stripped.");
assert.match(accountsUpload, /workbook\.SheetNames\.some\(\(name\) => !allowedSheets\.has\(name\)\)/, "Upload validation must reject unexpected extra sheets while allowing the hidden metadata sheet.");
assert.match(accountsUpload, /Business MIS rows were added or removed/, "Upload validation must reject added or removed Business MIS rows.");
assert.match(accountsUpload, /System-controlled Business MIS values were edited/, "Upload validation must reject edits to system-controlled MIS values.");
assert.doesNotMatch(accountsUpload, /uploaded Difference will not be updated/, "Uploaded Difference must be ignored rather than surfaced as a mismatch warning.");
assert.match(accountsUpload, /Difference is always calculated internally from Total Pay-in - Bill Amount/, "Difference must remain internally calculated and non-authoritative from Excel.");
assert.match(accountsUpload, /Template validated successfully\. No new Pay-In or Pay-Out changes were detected\./, "An unchanged valid workbook must report successful validation instead of an error-like state.");
assert.match(accountsUpload, /messageKind: "success"/, "Unchanged valid workbooks must be explicitly marked as successful validation.");
assert.match(accountsWorkbook, /Enter values only in highlighted Accounts fields/, "Business MIS export must tell Accounts where data entry is allowed.");
assert.match(accountsWorkbook, /editableFill/, "Business MIS export must visually highlight editable reconciliation fields.");
assert.match(accountsWorkbook, /BUSINESS_MIS_EDITABLE_COLUMNS\.has\(c\)/, "Editable styling must be driven by the canonical Accounts editable-column set.");
assert.match(accountsUpload, /const candidateRows = dataRows[\s\S]*\.filter\(\(\{ row \}\) => hasEditableInput\(row\)\)/, "Reconciliation preview must identify Accounts-input rows before live validation.");
assert.match(accountsUpload, /loadBusinessMisRecordsByPolicyIds\(profile, candidatePolicyIds\)/, "Reconciliation preview must load heavyweight live MIS data only for candidate policy rows.");
assert.doesNotMatch(accountsUpload, /loadBusinessMisRecordsByPolicyIds\(profile, policyIds\)/, "Reconciliation preview must not reload live MIS data for every workbook policy.");
assert.match(accountsUpload, /candidatePayoutIds/, "Payout validation queries must be restricted to candidate rows.");
assert.match(accountsUpload, /populatedWorksheetBounds\(sheet\)/, "Reconciliation upload must calculate populated worksheet bounds instead of trusting optional Excel dimension metadata.");
assert.doesNotMatch(accountsUpload, /decode_range\(sheet\["!ref"\] \|\| "A1:A1"\)/, "Google Sheets compatibility must not depend on the optional worksheet !ref dimension.");
assert.match(accountsUpload, /decode_cell\(address\)/, "Worksheet bounds must be derived from actual populated cell addresses.");
assert.match(accountsUpload, /if \(!candidateRows\.length\)/, "A structurally valid workbook with no Accounts input should return before live policy queries.");
assert.match(accountsUpload, /const dmy = raw\.match\(\/\^\\d\{1,2\}.*\\d\{2\}\|\\d\{4\}/s, "Reconciliation dates must accept DD/MM/YY as exported by Google Sheets.");
assert.doesNotMatch(accountsUpload, /Gross Payout must be greater than zero before Accounts can record a payment\./, "Zero projected gross payout must not block recording an actual payout.");
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
