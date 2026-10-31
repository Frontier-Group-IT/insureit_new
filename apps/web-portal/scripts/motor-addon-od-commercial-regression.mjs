import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL(p,import.meta.url),'utf8');
const form=read('../components/policy-unified-form.tsx');
const sql=read('../../../supabase/migrations/20261021224000_motor_addon_od_commissions.sql');
const od=form.indexOf('label="OD premium"'), addon=form.indexOf('label="Add-on premium"'),tp=form.indexOf('label="TP premium"');
assert.ok(od>=0 && addon>od && tp>addon,'OD → Add-on → TP order');
assert.match(form,/projectedOd=\(od\+addOn\)\*numeric\(form.projectedOdPercent\)\/100/);
assert.match(form,/payoutOd=flatPayout\?0:\(od\+addOn\)\*numeric\(form.payoutOdPercent\)\/100/);
assert.match(sql,/projected_od_amount = coalesce\(pi.projected_od_amount,0\) \+/);
assert.match(sql,/total_projected_payin = coalesce\(pi.total_projected_payin,0\) \+/);
assert.match(sql,/tds_amount = round/);
assert.match(sql,/od_payout_amount = coalesce\(po.od_payout_amount,0\) \+/);
assert.match(sql,/gross_payout = coalesce\(po.gross_payout,0\) \+/);
assert.ok(sql.includes("po.payout_basis,'') <> 'FIXED_AMOUNT'"));
assert.match(sql,/PERFORM public.set_motor_policy_addon_premium_v1\(v_id,v_amount\)/);
function projected(od,addon,pct){return Math.round((od+addon)*pct)/100}
assert.equal(projected(4675.17,10539.73,25),3803.73);
console.log('Motor addon OD payin/payout calculation and migration contracts passed');
