import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const access = readFileSync(resolve(root, "lib/claim-workflow-access.ts"), "utf8");
const action = readFileSync(resolve(root, "app/claims/stage-actions.ts"), "utf8");

assert.match(access, /hasEffectiveCapability\(profile, "manage_claims", "edit"\)/, "Employee mutation must retain edit capability");
assert.match(access, /canAccessCustomer\(profile\.id, profile\.role, claim\.customer_id, "manage_claims"\)/, "Employee mutation must retain customer scope");
assert.match(access, /isPartner: false as const,\s*\/\/[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*supabase: admin/, "Authorized employee stage writes must not re-read through employee RLS");
assert.match(access, /partner_app_claim_detail/, "Partner mutation must retain authenticated Partner scope proof");
assert.match(access, /isPartner: true as const/, "Partner access must retain separate identity");
assert.match(access, /partner_app_insert_claim_stage_detail/, "Partner detail insert remains scoped RPC");
assert.match(action, /const access = await requireClaimWorkflowAccess\(claimId/, "Stage mutations must require authorized access");
assert.match(action, /const \{ profile, supabase \} = access/, "Stage mutations must reuse the authorized database client");
assert.match(action, /\.from\("claims"\)\.select\("id,current_status,claim_service_mode,policy_service_source"\)/, "Stage action must read the authorized claim");
console.log("Operations claim payment-stage authorization regression passed.");
