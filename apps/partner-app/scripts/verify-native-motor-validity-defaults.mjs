import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { motorCoverExpiry, motorValidityEnds } from '../lib/motor-validity-dates.ts';

assert.equal(motorCoverExpiry('2026-11-10',1),'2027-11-09','OD anniversary is inclusive');
assert.deepEqual(motorValidityEnds('2026-11-10','PCP','Bundled'),{
  validUpto:'2027-11-09',tpValidUpto:'2029-11-09',cpaValidUpto:'2029-11-09'
},'PCP Bundled OD one year, TP/CPA three years');
assert.deepEqual(motorValidityEnds('2026-11-10','TWP','Bundled'),{
  validUpto:'2027-11-09',tpValidUpto:'2031-11-09',cpaValidUpto:'2031-11-09'
},'TWP Bundled OD one year, TP/CPA five years');
assert.deepEqual(motorValidityEnds('2026-11-10','GCV','Comprehensive'),{
  validUpto:'2027-11-09',tpValidUpto:'',cpaValidUpto:''
},'Non-bundled policies auto-fill only standard validity');
assert.deepEqual(motorValidityEnds('2026-11-10','PCP','Third Party'),{
  validUpto:'2027-11-09',tpValidUpto:'',cpaValidUpto:''
},'Changing away from Bundled clears unused TP/CPA end dates');
assert.equal(motorCoverExpiry('2024-02-29',1),'2025-02-28','Leap day rollover mirrors web UTC behavior');
assert.equal(motorCoverExpiry('2026-02-30',1),'','Reject invalid dates rather than invent expiration');
assert.deepEqual(motorValidityEnds('','TWP','Bundled'),{validUpto:'',tpValidUpto:'',cpaValidUpto:''},'Clearing start date clears auto-filled end dates');
const app=readFileSync(new URL('../app/policy-intakes/onboarding.tsx',import.meta.url),'utf8');
const web=readFileSync(new URL('../../web-portal/components/policy-unified-form.tsx',import.meta.url),'utf8');
assert.match(web,/coverExpiry\(value,current\.vehicleClass==="TWP"\?5:3\)/,'Website source defines PCP/TWP bundled periods');
assert.match(app,/key==='validFrom'\|\|key==='policyProduct'\|\|\(key==='vehicleClass'/,'Recompute only on explicit start/product/class edits');
assert.match(app,/Object\.assign\(next,motorValidityEnds\(/,'Keep three end dates in native draft on input change');
assert.match(app,/onChange=\{v=>update\(f\.key,v\)\}/,'Date picker commits through the shared update path');
assert.match(app,/\{key:'validUpto',label:draft\?\.policyProduct==='Bundled'\?'OD Validity Upto':'Validity up to'/,'Bundled validity end is labeled OD Validity Upto; other products keep the original label');
assert.match(app,/key:'tpValidUpto' as FieldKey/,'Bundled TP validity up-to field stays editable');
assert.match(app,/key:'cpaValidUpto' as FieldKey/,'Bundled CPA validity up-to field stays editable');
assert.match(app,/const next=\{\.\.\.current,\[key\]:value\}/,'Existing draft fields remain intact');
console.log('Native Motor validity dates match website PCP/TWP and standard expiry rules.');
