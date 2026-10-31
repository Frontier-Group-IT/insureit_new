import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const onboarding = read('../app/policies/policy-onboarding-actions.ts');
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
console.log('Motor Add-on Premium static wiring and GST regression checks passed');
