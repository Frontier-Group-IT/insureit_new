import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/policies/page.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("../app/policies/policy-workspace.tsx", import.meta.url), "utf8");
const policyScope = await readFile(new URL("../lib/policy-access-scope.ts", import.meta.url), "utf8");
const policyDetail = await readFile(new URL("../app/policies/[id]/page.tsx", import.meta.url), "utf8");
const dashboardBusiness = await readFile(new URL("../app/dashboard-v2/dashboard-business.ts", import.meta.url), "utf8");
const dashboardView = await readFile(new URL("../app/dashboard-v2/dashboard-view.tsx", import.meta.url), "utf8");
const reportBusiness = await readFile(new URL("../lib/reports/policy-business.ts", import.meta.url), "utf8");
const reportPage = await readFile(new URL("../app/reports/(workspace)/business/page.tsx", import.meta.url), "utf8");
const reportMigration = await readFile(new URL("../../../supabase/migrations/20260915163500_policy_business_report_net_premium_v5.sql", import.meta.url), "utf8");

const mainQuery = page.match(/let\s+query\s*=\s*admin\s*\.from\("policies"\)\s*\.select\("([^"]+)"\)/s)?.[1] ?? "";
assert.ok(mainQuery, "Policies page should keep an explicit main register select.");
assert.ok(!mainQuery.includes("premium_amount"), "Main policy register should not fetch unused premium_amount.");
assert.ok(!mainQuery.includes("mime_type"), "Main policy register should not fetch unused policy document mime_type.");
assert.ok(mainQuery.includes("policy_premium_details(gross_premium)"), "Gross premium used by the register must remain.");
assert.ok(mainQuery.includes("policy_documents(id, document_type, file_name)"), "Policy copy identity and file name must remain for open action.");
assert.ok(page.includes('select("id,policy_no,policy_type,start_date,end_date,insured_declared_value,premium_amount,'), "Backoffice premium display must remain unchanged.");
assert.ok(!workspace.includes("premium_amount: number | null;"), "Policy workspace type should not retain unused premium_amount.");
assert.ok(!workspace.includes("mime_type: string | null;"), "Policy workspace document type should not retain unused mime_type.");

assert.ok(!page.includes('from("external_policies")'), "Main Policy Register must not load external policies; they have a dedicated register.");
assert.ok(!page.includes("externalWorkspaceRows"), "Main Policy Register must not merge external policy rows into its workspace.");
assert.ok(page.includes("getAccessiblePolicyRmEmployeeIds"), "Policy Register must use the canonical policy RM scope.");
assert.ok(page.includes('.in("rm_employee_id", accessibleRmEmployeeIds)'), "Policy Register data query must constrain non-organization users by rm_employee_id.");

assert.ok(policyScope.includes("getEmployeeAccessScope"), "Canonical policy scope must inherit employee self/hierarchy/organization scope.");
assert.ok(policyScope.includes('.in("rm_employee_id", rmEmployeeIds)'), "Direct policy access guard must validate rm_employee_id ownership.");
assert.ok(policyDetail.includes("canAccessPolicy"), "Direct policy detail route must enforce policy-level access before returning a record.");

assert.ok(dashboardBusiness.includes("getAccessiblePolicyRmEmployeeIds"), "Dashboard business data must use policy RM scope rather than customer scope.");
assert.ok(dashboardBusiness.includes('.in("rm_employee_id", rmEmployeeIds)'), "Dashboard policy population must be constrained by RM employee scope.");
assert.ok(dashboardBusiness.includes("netPremium"), "Dashboard business data must expose net premium for headline reporting.");
assert.ok(dashboardView.includes("Net premium"), "Dashboard business headline must label the requested metric as Net premium.");
assert.ok(dashboardView.includes("Avg. net / policy"), "Dashboard business headline must show average net premium per policy.");
assert.ok(dashboardView.includes("Ranked by gross premium"), "Dashboard rankings must clearly use gross premium.");

assert.ok(reportBusiness.includes("getAccessiblePolicyRmEmployeeIds"), "Business reports must use policy RM scope rather than customer scope.");
assert.ok(reportBusiness.includes('get_policy_business_report_v5'), "Business reports must use the net-premium RM-scoped report function.");
assert.ok(reportBusiness.includes('query.period)?query.period:"mtd"'), "Business reports should default to MTD to reconcile with Dashboard and Policy Register.");
assert.ok(reportPage.includes("Net Premium"), "Business report must label premium output as Net Premium.");
assert.ok(!reportPage.includes("Avg. net / policy"), "Business report must not restore the removed average-net-per-policy summary metric.");
assert.ok(!reportPage.includes("Gross premium"), "Business report page must not expose Gross premium labels.");
assert.ok(reportMigration.includes("p.rm_employee_id=any(p_scope_rm_employee_ids)"), "Report SQL must enforce the authorized RM employee scope.");
assert.ok(reportMigration.includes("b.rm_employee_id=p_rm_employee_id"), "Selected RM report filter must match stable employee id, not RM name text.");
assert.ok(reportMigration.includes("sum(net_premium)"), "Report SQL must aggregate net premium for report values.");
assert.ok(!reportMigration.includes("select full_name from public.employees where id=p_rm_employee_id"), "Report SQL must not translate selected RM id back to a name for authorization/filtering.");

assert.match(workspace, /function usePolicyFloatingMenu\(/, "Policy register custom menus must use a shared floating menu mechanism");
assert.match(workspace, /menu\.position && createPortal\(/g, "Both custom filter menus should escape the horizontal scroller");
assert.equal((workspace.match(/menu\.position && createPortal\(/g) ?? []).length, 2, "Business and Date Range must each render through a portal");
assert.match(workspace, /document\.body/, "Menus must render outside the clipped toolbar");
assert.match(workspace, /document\.addEventListener\("pointerdown", outside\)/, "Floating menus must close on outside click");
assert.match(workspace, /event\.key !== "Escape"/, "Floating menus must support Escape");
assert.match(workspace, /window\.addEventListener\("scroll", dismissOnScroll, true\)/, "Floating menus must respond to toolbar scrolling");
assert.match(workspace, /onBusinessChange\(value\); menu\.close\(\)/, "Business selection must retain filtering and close menu");
assert.match(workspace, /onQuickRange\(range\); menu\.close\(\)/, "Quick dates must retain range selection");
assert.match(workspace, /onFromDateChange\(event\.target\.value\)/, "Custom From date must remain functional");
assert.match(workspace, /onToDateChange\(event\.target\.value\)/, "Custom To date must remain functional");
console.log("Policy register and business scope regression passed.");

const periodModule = await import("../lib/policy-register-period.ts");
const periodRows = [
  { id: "older", businessDate: "2026-09-15" },
  { id: "current", businessDate: "2026-11-04" },
  { id: "other", businessDate: "2026-10-23" },
];
const choosePeriod = (scope) => periodModule.filterPolicyRegisterPeriod(periodRows, scope, "2026-11-01", "2026-11-04", (row) => row.businessDate).map((row) => row.id);
assert.deepEqual(choosePeriod("mtd"), ["current"], "MTD must show only current-month policies");
assert.deepEqual(choosePeriod("all"), ["older", "current", "other"], "All must restore all authorized matching policies");
assert.match(workspace, /filterPolicyRegisterPeriod\(controlFiltered, timeScope, mtdStart, mtdEnd, policyBusinessDate\)/, "All/MTD selection must control visible policy rows");
assert.match(workspace, /window\.sessionStorage\.setItem\(POLICY_REGISTER_PERIOD_KEY, next\)/, "Selected period must survive navigation");
assert.match(workspace, /window\.sessionStorage\.getItem\(POLICY_REGISTER_PERIOD_KEY\)/, "Saved period must be read on navigation");
assert.match(workspace, /setFromDate\("")/, "Changing period must clear incompatible custom date filters");
assert.match(workspace, /setView\("all"\)/, "Changing period must reset the active status tab");
assert.match(workspace, /setPage\(1\)/, "Changing period must reset pagination");
