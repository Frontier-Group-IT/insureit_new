import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const sql = read("../../../supabase/migrations/20261104183000_motor_addon_payin_tds_atomic_consistency.sql");
const edit = read("../app/policies/policy-edit-actions.ts");
const legacy = read("../../../supabase/migrations/20261021224000_motor_addon_od_commissions.sql");

const begin = sql.indexOf("    UPDATE public.policy_payin_details pi\n       SET projected_od_amount");
const finish = sql.indexOf("    UPDATE public.policy_intermediary_payouts po", begin);
assert.ok(begin > 0 && finish > begin, "Atomic pay-in update must precede unchanged payout update");
const payin = sql.slice(begin, finish);
assert.equal((payin.match(/UPDATE public\.policy_payin_details/gi) || []).length, 1,
  "Do not split Pay-in and TDS into separate SQL statements");
assert.match(payin, /projected_od_amount\s*=/);
assert.match(payin, /total_projected_payin\s*=/);
assert.match(payin, /tds_amount\s*=/);
assert.match(payin, /payin_after_tds\s*=/);
assert.match(payin, /round\(v_amount \* coalesce\(pi\.projected_od_percent,0\) \/ 100,2\)/,
  "Add-on OD commission must remain percentage-based and rounded");
assert.match(sql, /PERFORM public\.set_motor_policy_addon_premium_v1\(v_id,v_amount\)/,
  "Keep the premium/GST add-on handler");
assert.match(sql, /IF v_amount <> 0 OR coalesce\(v_existing_amount,0\) <> 0 THEN/,
  "Preserve legacy zero-add-on skip");
assert.match(sql, /IF v_amount > 0 THEN/, "Zero add-on should not get a new uplift");
assert.ok(sql.includes("po.payout_basis,'') <> 'FIXED_AMOUNT'"), "Preserve fixed-amount payout exclusion");
assert.match(sql, /IF auth\.role\(\) IS DISTINCT FROM 'service_role'/, "Preserve database role check");
assert.match(sql, /REVOKE ALL ON FUNCTION public\.save_motor_policy_with_addon_v1/, "Keep privileged RPC inaccessible to client roles");
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.save_motor_policy_with_addon_v1\([^)]+\) TO service_role/, "Keep service-role RPC access");
assert.doesNotMatch(sql, /DROP CONSTRAINT|DISABLE TRIGGER|ALTER TABLE|UPDATE public\.policies\s+SET/,
  "Do not weaken constraints or bulk-update customer policy data");
assert.match(edit, /save_motor_policy_with_date_approval_v1/,
  "Policy Edit must keep the OTP-protected atomic save wrapper");
assert.match(legacy, /UPDATE public\.policy_payin_details pi/,
  "Keep original migration history untouched");

function roundMoney(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
function projected(baseOd, baseTotal, addon, odPercent, tdsPercent) {
  const uplift = roundMoney(addon * odPercent / 100);
  const od = roundMoney(baseOd + uplift);
  const total = roundMoney(baseTotal + uplift);
  const tds = roundMoney(total * tdsPercent / 100);
  const after = roundMoney(total - tds);
  return { od, total, tds, after };
}
// Reproduce the exact rejected production row for chassis MD2C5920XTAG78427.
const affected = projected(633.60, 2172.80, 683, 40, 10);
assert.deepEqual(affected, { od: 906.8, total: 2446, tds: 244.6, after: 2201.4 });
assert.equal(roundMoney(affected.total - affected.tds), affected.after,
  "Pay-in after TDS must balance within the existing DB CHECK constraint");
assert.equal(roundMoney(affected.od - 633.60), 273.2, "Add-on must be applied exactly once");
assert.deepEqual(projected(400, 800, 0, 25, 10),
  { od: 400, total: 800, tds: 80, after: 720 });
assert.deepEqual(projected(0, 0, 10539.73, 25, 10),
  { od: 2634.93, total: 2634.93, tds: 263.49, after: 2371.44 });
assert.deepEqual(projected(100, 175, 300, 0, 0),
  { od: 100, total: 175, tds: 0, after: 175 });
console.log("Motor add-on Pay-in/TDS atomic constraint regression passed");
