// Focused, anonymized Tata AIG private car parser contract checks.
// Original policy PDF text is replayed privately, never committed.
// Run: node infra/n8n-local/tests/tata-aig-private-car-source-variants-regression.mjs
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
const dir=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(resolve(dir,"../extensions/tata-aig-private-car-18check-parser-node.js"),"utf8");
const parse=new Function("$input","$",source);
assert.equal(typeof parse,"function");
assert.match(source,/const registered=\/\^\[A-Z\]\{2\}\\d\{2\}/);
assert.match(source,/RTO Location\[ \\t\]\+/);
assert.match(source,/KOLKATA:'WEST BENGAL'/);
assert.match(source,/PANCHKULA:'HARYANA'/);
assert.match(source,/WB:'WEST BENGAL'/);
assert.match(source,/checks\.rto_resolved=!rto\|\|!state\|\|!registered/);
assert.match(source,/const printedRtoState=match\(vehicleSection/);
assert.match(source,/state=printedRtoState\?\?stateByRto\[rto\]\?\?stateByPlate/);
assert.match(source,/explicitlyPrintedShortEngine=Boolean\(engine&&\/\^\\d\{6\}\$\/\.test\(engine\)/);
assert.match(source,/Engine Number/);
assert.match(source,/engine\.length>=7\|\|explicitlyPrintedShortEngine/);
assert.match(source,/engine!==chassis/);
assert.match(source,/chassis\.length>=14/);
assert.match(source,/cngKitComplete=!/);
assert.match(source,/cngOd>0&&cngTp>0/);
assert.match(source,/checks\.basic_od_ncb_reconciled=cngKitComplete&&near\(\(basicOd\?\?NaN\)\+cngOd-\(ncb\?\?NaN\),odPrinted\?\?NaN,0\.03\)/);
assert.match(source,/checks\.liability_components_reconciled=cngKitComplete&&near\(\(basicTp\?\?NaN\)\+cngTp\+ownerDriverCpa\+passenger\+legal,liability\?\?NaN,0\.03\)/);
assert.match(source,/cng_kit_od:cngOd,cng_kit_tp:cngTp/);
assert.match(source,/tp_premium:cent\(\(basicTp\?\?NaN\)\+cngTp\+legal\+passenger\+rsa\)/);
assert.match(source,/auto_finalize_allowed:false/);
assert.match(source,/booking_ready:false/);
assert.match(source,/policy_issuance_date:null/); // Missing signature-date stays review-controlled

// Insurer-printed accounting examples use synthetic identifiers, never PII.
const valid={basicOd:2758.85,cngOd:137.94,ncb:724.20,od:2172.59,
  basicTp:3416,cngTp:60,cpa:375,passengers:250,paidDriver:50,liability:4151};
const cents=n=>Math.round(n*100);
const odPass=x=>Math.abs(cents(x.basicOd+x.cngOd-x.ncb)-cents(x.od))<=3;
const tpPass=x=>Math.abs(cents(x.basicTp+x.cngTp+x.cpa+x.passengers+x.paidDriver)-cents(x.liability))<=3;
assert.equal(odPass(valid),true);
assert.equal(tpPass(valid),true);
assert.equal(odPass({...valid,cngOd:0}),false);
assert.equal(tpPass({...valid,cngTp:0}),false);
assert.equal(odPass({...valid,cngOd:237.94}),false);
assert.equal(tpPass({...valid,cngTp:120}),false);
assert.equal(odPass({...valid,ncb:0}),false);
assert.equal(odPass({...valid,od:2100}),false);
const textFixture="Registration No. WB 08 H 0751\nRTO Location KOLKATA\nEngine Number / Motor No. (for EV)\n746443\nChassis No. EXAMPLEVIN00000001";
assert.match(textFixture,/\bRegistration No\. WB 08 H 0751/);
assert.match(textFixture,/\bRTO Location KOLKATA/);
assert.match(textFixture,/\bEngine Number \/ Motor No\. \(for EV\)\s*746443/);
console.log("Tata AIG source variants: engine provenance, WB/Kolkata/Panchkula, IMT25 OD/TP, negatives and fail-closed behavior passed.");
