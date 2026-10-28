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
];
for (const [file, label] of pages) {
  const source = read(file);
  assert.match(source, /await requirePartnerReportScope\(\)/, `${label}: missing authenticated reporting gate`);
  assert.doesNotMatch(source, /createSupabaseAdminClient|getEmployeeAccessScope|requireCapability/, `${label}: must not load Operations admin reports`);
  assert.doesNotMatch(source, /payin|payout|retention|margin/i, `${label}: financial payin/payout must not be visible`);
  assert.doesNotMatch(source, /\b(?:params|searchParams)\.(?:partner|group|branch)\b|[?&](?:partner|group|branch)=/, `${label}: hierarchy parameters must not expand scope`);
  assert.match(source, new RegExp(`PartnerReportsShell active="${label}" scope={reportScope}`), `${label}: shared report shell missing`);
}
for (const name of ["portfolio", "operations"]) {
  const page = read(`app/partner/reports/${name}/page.tsx`);
  assert.match(page, /await requirePartnerReportScope\(\)/, `${name}: must authenticate before redirect`);
  assert.match(page, /redirect\("\/partner\/reports"\)/, `${name}: retired page must redirect`);
  assert.doesNotMatch(page, /listPartnerWeb|createSupabaseAdminClient/, `${name}: retired pages must not load data`);
}
const tabs = read("components/partner-portal/partner-report-tabs.tsx");
assert.match(tabs, /label: "Overview"/);
assert.match(tabs, /label: "Business"/);
assert.doesNotMatch(tabs, /label: "Portfolio"|label: "Operations"/);
const sharedShell = read("components/partner-portal/partner-reports-shell.tsx");
assert.match(sharedShell, /PartnerReportTabs active={active}/, "Shared report navigation must remain present");
assert.match(sharedShell, /reports-reference-shell/, "Shared shell must inherit reference Reports styling");
assert.doesNotMatch(sharedShell, /createSupabaseAdminClient|payin|retention|margin/i, "Shared shell must not access confidential financial data");
const distribution = read("components/partner-portal/scoped-report-distribution.tsx");
assert.doesNotMatch(distribution, /createSupabaseAdminClient|payin|retention|margin/i, "Shared distribution must remain presentation-only");
assert.match(read(pages[1][0]), /buildBusinessRows\(filtered\)/, "Business must use filtered authorized policy rows");
assert.doesNotMatch(read(pages[1][0]), /Partner Payout|getPartnerWebPayoutSummary/, "Partner payout must not appear");
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
assert.doesNotMatch(overview, /payout|payin/i, "Overview must not show payin or payout");
assert.match(read("components/partner-portal/partner-navigation.tsx"), /href: "\/partner\/reports"/, "Sidebar navigation missing");

const businessExport = read("app/partner/business/export/route.ts");
assert.match(businessExport, /listPartnerWebPolicies/, "Business export must use scoped policies");
assert.match(businessExport, /const pageSize = 100/, "Business export must use bounded pages");
assert.match(businessExport, /bookType: "xlsx"/, "Business export must be Excel");
assert.doesNotMatch(businessExport, /"Pay-in"|"Payout"|"Retention"|gross_payout|total_payin/i, "Confidential financial columns must not be exported");
const exportRoute = read("app/partner/reports/export/route.ts");
assert.match(exportRoute, /await requirePartnerReportScope\(\)/, "Exports must validate reporting scope");
assert.match(exportRoute, /MAX_ROWS = 200/, "Exports must be explicitly bounded");
assert.match(exportRoute, /listPartnerWebPolicies/, "Policy export must reuse account-scoped RPC");
assert.match(exportRoute, /listPartnerWebClaims/, "Claims export must reuse account-scoped RPC");
assert.doesNotMatch(exportRoute, /createSupabaseAdminClient/, "Exports must not use privileged report loaders");
assert.match(exportRoute, /no-store/, "Sensitive exported data must not be cached");

console.log("Partner hierarchy reporting static boundary checks passed.");
