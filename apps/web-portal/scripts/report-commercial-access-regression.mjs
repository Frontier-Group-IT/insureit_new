import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const policyAccess = await read("../lib/policy-commercial-access.ts");
const overview = await read("../app/reports/(workspace)/page.tsx");
const business = await read("../app/reports/(workspace)/business/page.tsx");
const financeExport = await read("../app/reports/export/finance/route.ts");
const managementExport = await read("../app/reports/export/management-pack/route.ts");
const businessExport = await read("../app/reports/export/policy-business/route.ts");

assert.match(policyAccess, /export function canViewReportCommercials/);
assert.match(policyAccess, /if \(profile\?\.role === "super_admin"\) return true;/, "All Super Admin users must receive report-only commercial read access without an ID allowlist");
const operationalAccess = policyAccess.split("export function canViewReportCommercials")[0];
assert.doesNotMatch(operationalAccess, /profile\?\.role === "super_admin"/, "Report-only Super Admin permission must not widen operational commercial privileges");
const operationalList = policyAccess.split("export function canAccessPolicyCommercials")[0];
assert.doesNotMatch(operationalList, /7bda6ffc-340e-48aa-bd3d-4f1f62cf85d9/i, "Gagandeep must not receive commercial editing/review access");
assert.match(policyAccess, /profile\.role === "sales_head" && REPORT_COMMERCIAL_READ_PROFILE_IDS\.has\(profile\.id\)/, "Reports grant must require both profile ID and Sales Head role");

for (const [name, source] of [["overview", overview], ["business", business], ["finance export", financeExport], ["management export", managementExport], ["business MIS export", businessExport]]) {
  assert.match(source, /canViewReportCommercials\(profile\)/, name + " must use common report-only gate");
}
assert.match(business, /commercialAccess\s*\?\s*loadCompleteFinanceReport/, "Business must not load sensitive finance rows for unauthorized users");
assert.match(business, /commercialAccess\s*\?\s*<CommercialFlow/, "Business must mask restricted financial KPIs");
assert.match(business, /commercialAccess\s*\?\s*<section className="portal-card overflow-hidden"><Header title="RM Performance"/, "Business must mask detailed RM commercial rows");
assert.match(businessExport, /!applicationId && !canViewReportCommercials\(profile\)/, "Unscoped detailed MIS must reject unauthorized financial export");
assert.match(financeExport, /status: 403/, "Finance export requires server-side rejection");
assert.match(managementExport, /status: 403/, "Management export requires server-side rejection");

console.log("Reports-only commercial authorization regression passed.");
