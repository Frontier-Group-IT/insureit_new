import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/policies/page.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("../app/policies/policy-workspace.tsx", import.meta.url), "utf8");
const policyScope = await readFile(new URL("../lib/policy-access-scope.ts", import.meta.url), "utf8");
const policyDetail = await readFile(new URL("../app/policies/[id]/page.tsx", import.meta.url), "utf8");
const dashboardBusiness = await readFile(new URL("../app/dashboard-v2/dashboard-business.ts", import.meta.url), "utf8");
const dashboardView = await readFile(new URL("../app/dashboard-v2/dashboard-view.tsx", import.meta.url), "utf8");
const reportBusiness = await readFile(new URL("../lib/reports/policy-business.ts", import.meta.url), "utf8");
const reportMigration = await readFile(new URL("../../../supabase/migrations/20260905225000_policy_business_report_rm_scope_v4.sql", import.meta.url), "utf8");

const mainQuery = page.match(/let query = admin\.from\("policies"\)\.select\("([^"]+)"\)/)?.[1] ?? "";
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
assert.ok(dashboardBusiness.includes("averageGrossPremium"), "Dashboard should use gross premium as the canonical business metric.");
assert.ok(dashboardView.includes("Gross premium"), "Dashboard business headline must label the canonical metric as Gross premium.");
assert.ok(dashboardView.includes("Ranked by gross premium"), "Dashboard rankings must clearly use gross premium.");

assert.ok(reportBusiness.includes("getAccessiblePolicyRmEmployeeIds"), "Business reports must use policy RM scope rather than customer scope.");
assert.ok(reportBusiness.includes('get_policy_business_report_v4'), "Business reports must use the RM-scoped report function.");
assert.ok(reportBusiness.includes('query.period)?query.period:"mtd"'), "Business reports should default to MTD to reconcile with Dashboard and Policy Register.");
assert.ok(reportMigration.includes("p.rm_employee_id=any(p_scope_rm_employee_ids)"), "Report SQL must enforce the authorized RM employee scope.");
assert.ok(reportMigration.includes("b.rm_employee_id=p_rm_employee_id"), "Selected RM report filter must match stable employee id, not RM name text.");
assert.ok(!reportMigration.includes("select full_name from public.employees where id=p_rm_employee_id"), "Report SQL must not translate selected RM id back to a name for authorization/filtering.");

console.log("Policy register and business scope regression passed.");
