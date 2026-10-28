import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const guard = read("lib/reports/partner-report-scope.ts");
assert.match(guard, /getPartnerWebSession\(\)/, "Scope must come from authenticated session");
assert.match(guard, /scope_mode === "organization"/, "Intermediaries must never receive organization-wide reporting");
assert.match(guard, /scope\.scope_mode !== "hierarchy"/, "Group must require hierarchy scope");
assert.match(guard, /scope\.scope_mode !== "self"/, "Branch must require self scope");
assert.match(guard, /partnerIds\.length !== 1/, "Branch must be limited to its one mapped partner");
assert.match(guard, /scope\.scope_mode !== "partner_family"/, "Partner must be restricted to partner family");
assert.match(guard, /partnerIds\.includes\(identity\.partner_id\)/, "Partner identity must match scoped partner");
assert.match(guard, /portal_account_source === "associate"/, "Partner Associate must inherit assigned Partner scope");
assert.match(guard, /account_subtype === "group_associate"/, "Group Associate must inherit assigned Group scope");
assert.doesNotMatch(guard, /createSupabaseAdminClient/, "No privileged database client in reporting gate");

const pages = [
  ["app/partner/reports/page.tsx", "Overview"],
  ["app/partner/reports/business/page.tsx", "Business"],
  ["app/partner/reports/portfolio/page.tsx", "Portfolio"],
  ["app/partner/reports/operations/page.tsx", "Operations"],
];
for (const [file, label] of pages) {
  const source = read(file);
  const gateAt = source.indexOf("await requirePartnerReportScope()");
  assert(gateAt >= 0, `${label}: missing authenticated reporting gate`);
  assert(!/createSupabaseAdminClient|getEmployeeAccessScope|requireCapability/.test(source), `${label}: must not load Operations admin reports`);
  assert(!/\b(?:insurer_payin|payin_amount|broker_retention|retention_amount|retention_percent|internal_margin|profit_margin)\b/i.test(source), `${label}: confidential employee-only financial fields must not enter intermediary Reports`);
  assert(!/\b(?:params|searchParams)\.(?:partner|group|branch)\b|[?&](?:partner|group|branch)=/.test(source), `${label}: hierarchy parameters must not expand scope`);
  assert.match(source, new RegExp(`PartnerReportsShell active="${label}" scope={reportScope}`), `${label}: shared report shell missing`);
}
const sharedShell = read("components/partner-portal/partner-reports-shell.tsx");
assert.match(sharedShell, /PartnerReportTabs active={active}/, "Shared report navigation must remain present");
assert.match(sharedShell, /reports-reference-shell/, "Shared shell must inherit reference Reports styling");
assert.doesNotMatch(sharedShell, /createSupabaseAdminClient|payin|retention|margin/i, "Shared shell must not access confidential financial data");
const distribution = read("components/partner-portal/scoped-report-distribution.tsx");
assert.doesNotMatch(distribution, /createSupabaseAdminClient|payin|retention|margin/i, "Shared distribution must remain presentation-only");
assert.match(read(pages[2][0]), /ScopedReportDistribution/, "Portfolio must reuse scoped distribution chart");
assert.match(read(pages[3][0]), /ScopedReportDistribution/, "Operations must reuse scoped distribution chart");
assert.match(read(pages[1][0]), /buildBusinessRows\(filtered\)/, "Business must use filtered authorized policy rows");
assert.match(read(pages[1][0]), /canShowPayout && payout\?\.available/, "Payout must be gated by partner role and RPC authorization");
assert.match(read("app/partner/business/page.tsx"), /redirect\(/, "Legacy My Business URL must redirect to Reports");
assert.doesNotMatch(read("components/partner-portal/partner-navigation.tsx"), /label: "My Business"/, "My Business must not appear in desktop menu");
assert.doesNotMatch(read("components/partner-portal/partner-mobile-navigation.tsx"), /label: "My Business"/, "My Business must not appear in mobile menu");
assert.match(read(pages[1][0]), /const pageSize = 100/, "Business loading must match RPC page cap");
assert.match(read("app/partner/business/export/route.ts"), /const pageSize = 100/, "Business export must match RPC page cap");
const overview = read(pages[0][0]);
assert.match(overview, /name="period"/, "Overview must expose a date period filter");
assert.match(overview, /name="business"/, "Overview must expose a business category filter");
assert.match(overview, /scopedPolicyRows\(\)/, "Overview must use scoped policy rows");
assert.match(overview, /filtered\.reduce/, "Premium must derive from filtered scoped rows");
assert.match(overview, /points={trendPoints}/, "Trend must respond to the chosen scope");
assert.match(overview, /mixRows\.map/, "Business Mix must respond to the chosen scope");
assert.match(overview, /payout\.available && canShowPayout/, "Payout output must require existing payout authorization");
assert.match(overview, /reportScope\.role === "partner"/, "Partner payout must not be inherited by Group/Branch");
assert.match(read("components/partner-portal/partner-navigation.tsx"), /href: "\/partner\/reports"/, "Sidebar navigation missing");

assert.ok(read("app/partner/reports/portfolio/page.tsx").includes("listPartnerWebPolicies({ limit: 21, offset })"), "Portfolio register must use bounded Partner policy RPC");
assert.ok(read("app/partner/reports/operations/page.tsx").includes("listPartnerWebClaims({ limit: 21, offset })"), "Operations register must use bounded Partner claims RPC");

for (const path of ["app/partner/reports/portfolio/page.tsx", "app/partner/reports/operations/page.tsx"]) {
  const page = read(path);
  assert.ok(page.includes(String.raw`/^[1-9]\d{0,3}$/`), "Page must validate supplied positive integer");
  assert.ok(page.includes("slice(0, 20)"), "Pagination must render only 20 rows");
}

assert.match(read(pages[2][0]), /row\.premium_amount/, "Policy register must use only scoped premium data");
assert.match(read(pages[3][0]), /row\.settlement_amount/, "Claim register must use only scoped settlement data");
const exportRoute = read("app/partner/reports/export/route.ts");
assert.match(exportRoute, /await requirePartnerReportScope\(\)/, "Exports must validate reporting scope");
assert.match(exportRoute, /MAX_ROWS = 200/, "Exports must be explicitly bounded");
assert.match(exportRoute, /listPartnerWebPolicies/, "Policy export must reuse account-scoped RPC");
assert.match(exportRoute, /listPartnerWebClaims/, "Claims export must reuse account-scoped RPC");
assert.doesNotMatch(exportRoute, /createSupabaseAdminClient/, "Exports must not use privileged report loaders");
assert.match(exportRoute, /no-store/, "Sensitive exported data must not be cached");

console.log("Partner hierarchy reporting static boundary checks passed.");
