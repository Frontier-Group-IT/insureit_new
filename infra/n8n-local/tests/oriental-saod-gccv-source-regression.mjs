import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const module={exports:{}};
vm.runInNewContext(fs.readFileSync(path.resolve(here,'../extensions/oriental-private-car-od-gccv-candidate.js'),'utf8'),{module,exports:module.exports});
const parse=module.exports.parseOrientalMotor;
function sample(gcv=false){
 const header=[
 'The Oriental Insurance Company Limited',
 '123456/31/2027/5618Policy No :',
 'FROM 14:38 ON 19/11/2026 TO MIDNIGHT OF 18/11/2027',
 'MR SAMPLE CUSTOMER (GSTIN: 0)',
 gcv?'GCCV-PUBLIC CARRIERS OTHER THAN THREE WHEELERS PACKAGE\nPOLICY - ZONE C'
    :'STANDALONE OWN DAMAGE(OD)-PRIVATE CAR POLICY - ZONE B',
 gcv?'PB 06 Q 0536':'PB 25 K 4404',
 gcv?'25000':'1199',
 gcv?'TIPPER 1 + 1':'HATCHBACK 4 + 1',
 gcv?'400950D0002649 2013':'REV12345678901',
 gcv?'MEC2411BEDP0025':'162',
 gcv?'48':'2025',
 gcv?'Gurdaspur -':'MAT123456789012',
 gcv?'2523C TIPPER':'37',
 gcv?'5883':'',
 gcv?'':'TATA MOTORS-',
 gcv?'':'PUNCH PUR 1.2P MT',
 'MOTOR INSURANCE CERTIFICATE CUM POLICY SCHEDULE',
 'Type Of Fuel',
 gcv?'DIESEL':'PETROL'
 ];
 const money=gcv?[
 'ADD :BASIC TP COVER','BASIC TP TOTAL','ADD :PA FOR OWNER DRIVER-GR36A',
 'ADD :LL-PAID DRIVER,','CONDUCTOR,CLEANER-IMT-40','TP TOTAL','TOTAL PREMIUM',
 'STAMP DUTY','ADD :CGST_OD','ADD :SGST_OD','ADD :SGST_TP',
 'ADD :CGST_TP','TOTAL AMOUNT',
 '43,950.00','43,950.00','320.00','100.00','44,370.00','48,928.00','0.50',
 '448.00','448.00','1,099.00','1,099.00','52,022.00'
 ]:[
 'TOTAL PREMIUM','STAMP DUTY','ADD :SGST','ADD :CGST','TOTAL AMOUNT',
 '6,074.00','0.50','547.00','547.00','7,168.00',
 '*This insurance excludes any loss/liability arising out of Third Party or personal accident.'
 ];
 return [...header,...money,'Total Value IDV','\n'+(gcv?'9,00,000':'5,30,091'),
   gcv?'9,00,000':'5,30,091',''].join('\n');
}
for(const gcv of [false,true]){
 const s=sample(gcv);
 const p=parse(s);
 assert.equal(p.parser_id,gcv?'oriental_gccv_package_native_pdf':'oriental_private_car_standalone_od_native_pdf');
 assert.deepEqual(p.warnings,['Review required: printed_issuance_or_verified_image_date'],
   'Generic certificate Date must not become issuance date');
 assert.equal(Object.keys(p.checks).length,18);
 assert.equal(Object.values(p.checks).filter(Boolean).length,17);
 assert.equal(p.premium_components.net,gcv?48928:6074);
 assert.equal(p.premium_components.gst,gcv?3094:1094);
 assert.equal(p.premium_components.gross,gcv?52022:7168);
 assert.equal(p.premium_components.cpa,gcv?320:0);
 assert.equal(p.premium_components.tp,gcv?44370:0);
 assert.equal(p.fields.some(x=>x.key==='policy_issuance_date'),false);
 assert.equal(p.fields.some(x=>x.key==='vehicle_rto_name'),false,
   'Missing optional RTO must not cause failure');
 const printedIssue=parse(s+'\nDate of Issue: 19/11/2026');
 assert.equal(printedIssue.ok,true,'Explicitly printed issue date should complete 18 checks');
 assert.equal(printedIssue.fields.find(x=>x.key==='policy_issuance_date')?.value,'2026-11-19');
 for(const edited of [
   s.replace('TOTAL AMOUNT','TOTAL AMOUNT\n99,999.00'),
   s.replace(gcv?'52,022.00':'7,168.00','99,999.00'),
   s.replace('PB 06 Q 0536','MP 51'),
   s.replace('PB 25 K 4404','MP 51'),
   s.replace('The Oriental Insurance Company Limited','Unknown Insurance Company'),
 ]){
   assert.equal(parse(edited).ok,false,'Altered current-source schedule must fail');
 }
}
assert.equal(parse(sample(false).replace('PUNCH PUR 1.2P MT','UNRECOGNIZED MODEL')).ok,false);
assert.equal(parse(sample(true).replace('2523C TIPPER','UNKNOWN VEHICLE')).ok,false);
console.log('Oriental: SAOD/Package split, source checks, 4x GST, no-date review and tamper negatives passed');
