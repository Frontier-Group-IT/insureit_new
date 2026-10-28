import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const up=readFileSync("../../supabase/migrations/20261022163000_customer_policyless_claim_draft_insert_rls.sql","utf8");
const down=readFileSync("../../docs/rollback/20261022_customer_policyless_claim_insert_rollback.sql","utf8");
const action=readFileSync("app/customer/(protected)/start-claim/actions.ts","utf8");
for(const guard of [
  "for insert to authenticated", "created_by = auth.uid()", "policy_id is null",
  "external_policy_id is null", "current_status = 'Draft'",
  "can_access_customer(auth.uid(), customer_id)",
  "can_access_vehicle(auth.uid(), vehicle_id)", "v.customer_id = customer_id",
]) assert.ok(up.includes(guard), "Missing authorization guard: "+guard);
assert.match(down,/drop policy if exists "customer_policyless_claim_draft_insert" on public.claims/);
assert.match(action,/if \(!vehicles\.some\(v => v\.id === vehicleId\)\)/);
assert.match(action,/policy\?\.id \?\? null/);
assert.match(action,/code === "42501"/);
assert.match(action,/destination: "\/customer\/spot-intimation/);
assert.match(action,/controlNo: claimNo/);
console.log("Policyless claim draft RLS, rollback, and customer action contracts passed");
