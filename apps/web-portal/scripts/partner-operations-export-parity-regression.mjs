import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const partner=readFileSync(new URL("../app/partner/business/export/route.ts",import.meta.url),"utf8");
const ops=readFileSync(new URL("../app/reports/export/policy-business/route.ts",import.meta.url),"utf8");
const head=p=>[...p.matchAll(/"([^"]+)"/g)].map(x=>x[1]);
const oh=head(ops.match(/const HEADERS = \[([\s\S]*?)\] as const;/)?.[1]||"");
const ph=head(partner.match(/const headers = \[([\s\S]*?)\] as const;/)?.[1]||"");
assert.equal(oh.length,50);
assert.equal(ph.length,35);
assert.deepEqual(ph,oh.slice(0,35),"Partner uses exactly the non-commercial Operations header order");
for(const forbidden of oh.slice(35))assert.ok(!ph.includes(forbidden),"Internal commercial heading leaked: "+forbidden);
assert.match(partner,/await requirePartnerReportScope\(\)/,"Partner export must verify portal role");
assert.match(partner,/listPartnerWebPolicies\(\{ limit: pageSize, offset, lifecycle: "all" \}\)/,"Source must remain Partner-authenticated policies");
assert.match(partner,/assertCanonicalBranchListAccess|loadAuthorizedPolicyDetails\(rows\)/,"Export enriches scoped rows only");
assert.match(partner,/partner_app_export_policy_details/,"Details must use scoped database RPC");
assert.match(partner,/p_policy_ids: batch/,"RPC receives only IDs authorized by the Partner list");
const migration=readFileSync(new URL("../../../supabase/migrations/20261104130000_partner_business_mis_scoped_details.sql",import.meta.url),"utf8");
assert.match(migration,/partner_app_policy_in_scope/,"Each requested policy must pass canonical authorization");
assert.match(migration,/cardinality\(p_policy_ids\) > 100/,"Batch limit is required");
assert.match(migration,/grant execute on function public\.partner_app_export_policy_details\(uuid\[\]\) to authenticated/);
assert.doesNotMatch(partner,/policy_payin_details|policy_intermediary_payouts/,"Never read internal finance tables");
assert.doesNotMatch(migration,/policy_payin_details|policy_intermediary_payouts|insurer_scheme_amount|retention_amount|tds_amount/,"RPC never selects internal finance columns");
assert.match(partner,/details\.size!==ids\.length/,"Fail closed if policy enrichment incomplete");
for(const field of ["lead_source","insured_declared_value","add_on_premium","phone","engine_no","rto_name"])assert.ok(partner.includes(field),field);
const parityMigration=readFileSync(new URL("../../../supabase/migrations/20261104190000_partner_business_export_scope_parity.sql",import.meta.url),"utf8");
assert.match(parityMigration,/partner_app_export_policy_details\(p_policy_ids uuid\[\]\)/,"Scope fix must replace only the scoped export function");
assert.match(parityMigration,/v_is_branch_login := exists/,"Canonical branch identity must be checked");
assert.match(parityMigration,/partner_branch_login_links/,"Branch-link identity must match policy list authorization");
assert.match(parityMigration,/partner_branch_authorized_policy_ids\(\)/,"Branch policies must retain branch-only scope");
assert.match(parityMigration,/v_partner_ids/,"Partner-linked policy scope must match policy list");
assert.match(parityMigration,/scoped_partner\.partner_code=scoped_policy\.intermediary_code/,"Partner code attribution must match list scope");
assert.match(parityMigration,/scoped_policy\.rm_employee_id=any\(v_employee_ids\)/,"Employee scope must be preserved");
assert.match(parityMigration,/scoped_policy\.intermediary_group_id=any\(v_group_ids\)/,"Group policy authorization must be preserved");
assert.match(parityMigration,/when v_scope_mode='none' then false/,"Unknown scope must fail closed");
assert.match(parityMigration,/cardinality\(p_policy_ids\) > 100/,"Maximum batch size must remain 100");
assert.match(parityMigration,/where scoped_policy\.id is null or not coalesce\(\(/,"Missing or nullable scope decisions must fail closed");
assert.match(parityMigration,/grant execute on function public\.partner_app_export_policy_details\(uuid\[\]\) to authenticated/,"Only authenticated users may invoke export");
assert.doesNotMatch(parityMigration,/policy_payin_details|policy_intermediary_payouts|insurer_scheme_amount|retention_amount|tds_amount/,"Commercial columns must never enter partner export");
assert.match(partner,/console\.error\("Partner Business MIS scoped enrichment failed"/,"RPC error diagnostics must remain server-side");
assert.match(partner,/batchCount: batch\.length/,"Log batch size, not policy IDs");
assert.match(partner,/throw new Error\("Authorized Partner export details unavailable\."\)/,"Public errors must remain generic");
// All Business is sent as business=all by the Overview report and should not eliminate any scoped rows.
assert.match(partner, /const business = params\.get\("business"\) \|\| "all";/);
const businessFilter = partner.match(/if \((business !== "all" && normalizedBusinessType\(policy\) !== business)\) return false;/);
assert.ok(businessFilter, "Export must treat All Business as no additional business-type filter");
const excludesPolicy = new Function("business", "policy", "normalizedBusinessType", `return ${businessFilter[1]};`);
for (const accountType of ["group", "group associate", "branch", "partner", "partner associate"]) {
  const scopedPolicy = { business_type: "motor", accountType };
  assert.equal(excludesPolicy("all", scopedPolicy, policy => policy.business_type), false,
    `${accountType}: All Business must include authorized policies`);
  assert.equal(excludesPolicy("motor", scopedPolicy, policy => policy.business_type), false,
    `${accountType}: matching business type must remain included`);
  assert.equal(excludesPolicy("health", scopedPolicy, policy => policy.business_type), true,
    `${accountType}: non-matching business types must remain excluded`);
}
const operationsMapping=readFileSync(new URL("../lib/reports/policy-business-mis-export.ts",import.meta.url),"utf8");
assert.ok(operationsMapping.includes("policyProduct: text(row.policy_type)"),"Operations MIS uses policy_type as Policy Product");
assert.ok(partner.includes('row.policy_type?.trim() || "",amountOrBlank(detail.insured_declared_value)'),"Partner MIS must display the same policy_type as Operations");
assert.ok(!partner.includes('row.policy_product||""'),"Do not export the empty Motor policy_product field");
console.log("Partner Operations parity (35 columns, five scoped roles, no finance) passed");
