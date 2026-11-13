import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const onboarding = read('../lib/policy-onboarding-engine.ts');
assert.match(read('../app/policies/policy-onboarding-actions.ts'), /onboardPolicyForVerifiedActor/, 'Website action must delegate to shared booking engine');
const editing = read('../app/policies/policy-edit-actions.ts');
const form = read('../components/policy-unified-form.tsx');
const migration = read('../../../supabase/migrations/20261021193000_motor_policy_addon_atomic_save.sql');
for (const mode of ['create', 'intake', 'replace']) {
  assert.match(onboarding, new RegExp('p_operation:\\s*["\\x27]' + mode + '["\\x27]'), mode);
}
assert.match(editing, /p_operation:\s*"edit"/);
assert.match(migration, /PERFORM public\.set_motor_policy_addon_premium_v1\(v_id,v_amount\)/);
assert.match(migration, /RAISE EXCEPTION 'Motor policy save did not succeed'/);
assert.match(migration, /IF v_amount <> 0 OR coalesce\(v_existing_amount,0\) <> 0 THEN/);
assert.doesNotMatch(onboarding, /admin\.rpc\("set_motor_policy_addon_premium_v1"/);
assert.doesNotMatch(editing, /admin\.rpc\("set_motor_policy_addon_premium_v1"/);
assert.match(form, /Add-on premium/);
assert.match(form, /net=od\+tpWithCpa\+addOn/);
function calc(od,tp,cpa,addon,isGcv) {
  const net=od+tp+cpa+addon;
  const gst=isGcv ? (od+cpa+addon)*.18+tp*.05 : net*.18;
  return [net,Math.round(gst*100)/100];
}
assert.deepEqual(calc(1000,200,100,300,false),[1600,288]);
assert.deepEqual(calc(1000,200,100,300,true),[1600,262]);
assert.deepEqual(calc(1000,200,100,0,true),[1300,208]);

// The current production RPC must match the reviewed 2026-11-04 atomic
// Pay-in/TDS fix. PostgreSQL CHECK constraints run after each UPDATE:
// updating total before TDS in a separate statement is invalid.
const atomicPayinMigration = read('../../../supabase/migrations/20261104183000_motor_addon_payin_tds_atomic_consistency.sql');
const addonAdjustment = atomicPayinMigration.match(/IF v_amount > 0 THEN([\s\S]*?)UPDATE public\.policy_intermediary_payouts po/);
assert.ok(addonAdjustment, 'Reviewed add-on Pay-in adjustment must be present');
const payinUpdates = addonAdjustment[1].match(/UPDATE public\.policy_payin_details pi/g) ?? [];
assert.equal(payinUpdates.length, 1, 'Pay-in and TDS must update in ONE statement, never split into two');
for (const column of ['projected_od_amount', 'total_projected_payin', 'tds_amount', 'payin_after_tds']) {
  assert.match(addonAdjustment[1], new RegExp('\\b'+column+'\\s*='), column+' must be in the same UPDATE');
}
assert.ok(atomicPayinMigration.includes('END; $function$;'), 'Migration must terminate the function definition before grants');
assert.match(atomicPayinMigration, /REVOKE ALL ON FUNCTION public\.save_motor_policy_with_addon_v1[\s\S]*FROM PUBLIC, anon, authenticated/, 'Privileged booking function stays restricted');
assert.match(atomicPayinMigration, /GRANT EXECUTE ON FUNCTION public\.save_motor_policy_with_addon_v1[\s\S]*TO service_role/, 'Service role retains booking access');

console.log('Motor Add-on Premium static wiring, GST and atomic Pay-in/TDS regression checks passed');
