import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
const sql = readFileSync(new URL("../../../supabase/migrations/20261107163000_verified_pending_customer_membership.sql", import.meta.url), "utf8");
assert.match(sql, /phone_confirmed_at\s+is\s+null/i, "Pending links require confirmed Auth phone.");
assert.doesNotMatch(sql, /raw_user_meta_data/i, "Editable user metadata cannot authorize linking.");
for (const name of ["customer_memberships", "customer_contacts", "customer_onboarding_contacts"]) {
  assert.match(sql, new RegExp("update public\\." + name), "Preserve pending linking for " + name);
}
assert.match(sql, /profile_id = auth\.uid\(\) and status = 'active'/i, "Preserve already active memberships.");
console.log("SEC-PR-01 static identity guards verified (not an authorization runtime test).");
