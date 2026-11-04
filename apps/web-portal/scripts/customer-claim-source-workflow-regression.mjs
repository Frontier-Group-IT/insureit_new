import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root=new URL("../",import.meta.url);
const read=(name)=>readFileSync(new URL(name,root),"utf8");
const stage=read("app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
const actions=read("app/customer/(protected)/claims/[id]/stage/[stage]/actions.ts");
const data=read("lib/customer-web-phase2-data.ts");
assert.match(stage,/const canEditStage = external && Boolean\(CUSTOMER_EXTERNAL_STAGE_FIELDS\[selected.key\]\)/);
assert.doesNotMatch(stage,/switchCustomerClaimToSelfManaged|Complete this claim yourself/);
assert.doesNotMatch(actions,/claim\.claim_service_mode\s*!==\s*"self_managed"/);
assert.doesNotMatch(actions,/switchCustomerClaimToSelfManaged/);
assert.match(actions,/if\(!isExternalCustomerClaim\(claim\)\)/);
assert.match(actions,/Complete the preceding claim stage first/);
assert.match(actions,/resolveCustomerWebScope\(accountId\)/);
assert.doesNotMatch(data,/!completed && claim\.claim_service_mode === "self_managed"/);
assert.match(stage,/external\?buildExternalClaimProjection\(milestones\)/);
console.log("Customer claim internal/external workflow parity source checks passed");

const sql=read("../../supabase/migrations/20261104170000_customer_claim_all_stage_operations_details.sql");
assert.match(sql, /security definer/, "Read-only projection must use a narrowly scoped SQL function");
assert.match(sql, /public\.can_access_claim\(auth\.uid\(\), p_claim_id\)/, "SQL must check ownership before reading Operations rows");
assert.match(sql, /revoke all on function public\.customer_claim_operations_stage_details\(uuid\) from public, anon/, "Anonymous users cannot invoke the RPC");
assert.match(sql, /grant execute on function public\.customer_claim_operations_stage_details\(uuid\) to authenticated/, "Authenticated owners can invoke the RPC");
assert.match(sql, /from public\.claim_stage_details d/, "Projection reads authoritative Operations detail rows");
assert.match(sql, /order by d\.created_at asc, d\.id asc/, "Latest populated Operations field values win");
assert.match(sql, /'final_documents_dealership_details'/, "Legacy Stage 3 dealership forms must be included");
assert.match(sql, /field_row\.value <> '""'::jsonb/, "Empty draft fields must not hide saved values");
assert.doesNotMatch(sql, /insert into public\.claim_milestones|update public\.claims|update public\.claim_milestones/, "Read projection cannot change stage progression or claim state");
for (const name of ["spot_intimation", "spot_status", "claim_intimation", "work_approval", "repair_ri", "billing", "delivery_order", "vehicle_delivery", "payment_encashment"]) {
  assert.ok(sql.includes("when '" + name + "'") || sql.includes("'" + name + "'"), "Missing operations stage " + name);
}
assert.match(data, /supabase\.rpc\("customer_claim_operations_stage_details", \{ p_claim_id: claimId \}\)/, "Customer detail loader must fetch scoped Operations fields");
assert.match(data, /mergeCustomerClaimOperationsDetails\(/, "Customer detail loader must merge Operations fields");
assert.match(data, /isExternalCustomerClaim\(claim\)/, "Merge keeps customer-entered external stages authoritative");
assert.match(data, /milestone_status: "not_started"/, "Synthetic display records cannot advance external stages");
assert.doesNotMatch(data, /createSupabaseAdminClient/, "Customer reader must not use a service-role client");
console.log("Customer claim Operations stage field synchronization and RLS regressions passed");
