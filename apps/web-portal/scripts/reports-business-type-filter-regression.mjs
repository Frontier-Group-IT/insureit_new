import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const finance = await readFile(new URL("../lib/reports/finance.ts", import.meta.url), "utf8");
const policyBusiness = await readFile(new URL("../lib/reports/policy-business.ts", import.meta.url), "utf8");
const claims = await readFile(new URL("../lib/reports/claims.ts", import.meta.url), "utf8");
const renewals = await readFile(new URL("../lib/reports/renewals.ts", import.meta.url), "utf8");
const operations = await readFile(new URL("../lib/reports/operations.ts", import.meta.url), "utf8");
const managementPack = await readFile(new URL("../lib/reports/management-pack.ts", import.meta.url), "utf8");
const compactFilters = await readFile(new URL("../components/reports/report-compact-filters.tsx", import.meta.url), "utf8");
const businessPage = await readFile(new URL("../app/reports/(workspace)/business/page.tsx", import.meta.url), "utf8");
const overviewPage = await readFile(new URL("../app/reports/(workspace)/page.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../../../supabase/migrations/20261003123000_reports_overview_business_filter.sql", import.meta.url), "utf8");
const schemaWorkflow = await readFile(new URL("../../../.github/workflows/apply-reports-overview-business-filter.yml", import.meta.url), "utf8");
const deployWorkflow = await readFile(new URL("../../../.github/workflows/deploy-production.yml", import.meta.url), "utf8");

const businessLines = ["Motor", "Non Motor", "Life", "Health"];

assert.match(
  finance,
  /businessLine:"Motor"\|"Non Motor"\|"Life"\|"Health"\|null/,
  "Finance reporting must support the same four business lines as the Business report.",
);
assert.match(
  finance,
  /function businessLine\([^)]*\)[^{]*\{return v==="Motor"\|\|v==="Non Motor"\|\|v==="Life"\|\|v==="Health"\?v:null\}/,
  "Finance filter parsing must preserve Motor, Non Motor, Life and Health instead of collapsing Life/Health to All Business.",
);
assert.match(finance, /p_business_line:filters\.businessLine/, "The validated business line must be forwarded to get_finance_report_v4.");

assert.match(
  policyBusiness,
  /businessLine: "Motor" \| "Non Motor" \| "Life" \| "Health" \| null/,
  "Policy Business reporting must keep the same four-line filter contract.",
);
for (const line of businessLines) {
  assert.ok(compactFilters.includes(`{value:"${line}",label:"${line}"}`), `Reports business selector must keep the ${line} option.`);
}

assert.match(businessPage, /const businessQuery: PolicyBusinessQuery = \{ \.\.\.query,/, "Business report must receive the page query, including the business filter.");
assert.match(businessPage, /const financeQuery: FinanceQuery = \{ \.\.\.query,/, "Finance report must receive the same page query, including the business filter.");
assert.match(businessPage, /<CommercialFlow finance=\{finance\}/, "Summary commercials must come from the filtered finance report.");
assert.match(businessPage, /buildInsurerRows\(finance\)/, "Insurer rows must come from the filtered finance report.");
assert.match(businessPage, /buildRmRows\(finance\)/, "RM rows must come from the filtered finance report.");
assert.match(businessPage, /buildIntermediaryRows\(finance, report\)/, "Intermediary rows must come from the filtered finance report.");

assert.match(overviewPage, /businessLine: "Motor" \| "Non Motor" \| "Life" \| "Health" \| null/, "Overview must use the canonical four-line business contract.");
assert.match(overviewPage, /value === "life"[^\n]+businessLine: "Life", category: null/, "Overview Life must map directly to the Life business line.");
assert.match(overviewPage, /value === "health"[^\n]+businessLine: "Health", category: null/, "Overview Health must map directly to the Health business line.");
assert.ok(!overviewPage.includes('businessLine: "Non Motor", category: "Life"'), "Overview must not translate Life into legacy Non Motor + category filtering.");
assert.ok(!overviewPage.includes('businessLine: "Non Motor", category: "Health"'), "Overview must not translate Health into legacy Non Motor + category filtering.");
assert.match(overviewPage, /business: business\.businessLine \?\? undefined/, "Overview must pass the selected canonical business line into its loaders.");
assert.match(overviewPage, /managementPackExportHref\(period, business\)/, "Overview export must use the same resolved business scope.");

assert.match(managementPack, /loadClaimsReport\(profile, monthQuery\)/, "Overview management pack must pass business/date scope into Claims.");
assert.match(managementPack, /loadRenewalReport\(profile, \{ horizon: "90", page: "1", \.\.\.businessScope \}\)/, "Overview management pack must pass business scope into Renewals.");
assert.match(managementPack, /loadOperationsReport\(profile, \{ horizon: "90", page: "1", \.\.\.businessScope \}\)/, "Overview management pack must pass business scope into Operations.");

assert.match(claims, /businessLine:"Motor"\|"Non Motor"\|"Life"\|"Health"\|null/, "Claims reporting must accept all four business lines.");
assert.match(claims, /admin\.rpc\("get_claims_report_v2"/, "Claims reporting must use the business-aware v2 RPC.");
assert.match(claims, /p_business_line:filters\.businessLine,p_category:filters\.category/, "Claims RPC must receive the validated business/category filters.");

assert.match(renewals, /businessLine: "Motor" \| "Non Motor" \| "Life" \| "Health" \| null/, "Renewals reporting must accept all four business lines.");
assert.match(renewals, /v==="Motor"\|\|v==="Non Motor"\|\|v==="Life"\|\|v==="Health"\?v:null/, "Renewals parser must preserve Life and Health.");

assert.match(operations, /businessLine:"Motor"\|"Non Motor"\|"Life"\|"Health"\|null/, "Operations reporting must accept all four business lines.");
assert.match(operations, /admin\.rpc\("get_operations_compliance_report_v2"/, "Operations reporting must use the business-aware v2 RPC.");
assert.match(operations, /p_business_line:filters\.businessLine,p_category:filters\.category/, "Operations RPC must receive the validated business/category filters.");

assert.match(migration, /create or replace function public\.get_claims_report_v2\(/i, "Migration must create the business-aware Claims RPC.");
assert.match(migration, /create or replace function public\.get_operations_compliance_report_v2\(/i, "Migration must create the business-aware Operations RPC.");
assert.match(migration, /p_business_line is null or lower\(coalesce\(nullif\(trim\(p\.business_line\)/i, "Claims/Operations SQL must enforce the selected policy business line.");
assert.match(migration, /where p\.vehicle_id=v\.id/i, "Operations business scoping must require a vehicle linked to a matching policy.");
assert.match(migration, /grant execute on function public\.get_claims_report_v2[^;]+to service_role;/i, "Claims v2 RPC must remain service-role only.");
assert.match(migration, /grant execute on function public\.get_operations_compliance_report_v2[^;]+to service_role;/i, "Operations v2 RPC must remain service-role only.");

assert.ok(schemaWorkflow.includes("20261003123000_reports_overview_business_filter.sql"), "The protected schema workflow must apply the exact Overview migration.");
assert.ok(schemaWorkflow.includes("get_claims_report_v2"), "The schema workflow must verify the Claims v2 contract.");
assert.ok(schemaWorkflow.includes("get_operations_compliance_report_v2"), "The schema workflow must verify the Operations v2 contract.");
assert.ok(deployWorkflow.includes("20261003123000_reports_overview_business_filter.sql"), "Production deploy must recognize the Overview migration.");
assert.ok(deployWorkflow.includes('schema_workflow="apply-reports-overview-business-filter.yml"'), "Production deploy must wait for the Overview schema workflow.");

console.log("Reports business-type global filter regression passed, including Overview scope.");
