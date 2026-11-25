import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(here,'../extensions/magma-private-car-package-source-candidate.js');
const module={exports:{}};
vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports});
const parse=module.exports.parseMagmaPrivateCar;
function mock({kia=false,wrongFuel=false}={}){
 const maker=kia?'KIA INDIA PRIVATE LIMITED':'RENAULT';
 const model=kia?'KIA INDIA PRIVATE LIMITED SELTOS G1.5 IMT HTK PLUS':'TRIBER RXE MT';
 const spec=kia?'1497.00 5 0':'999 7 0';
 const year=kia?'11/2021':'2022';
 const reg=kia?'UP14EX4176':'HR30Z0885';
 const tax=kia?'IGST @ 18% 2,791.26':'CGST @ 9% 651.87\nSGST @ 9% 651.87';
 const premium=kia
  ?'Basic - OD 6,030.99\nKey Replacement 499.00\nLoss Of Personal Belongings 250.00\nBasic Roadside Assistance 51.00\nDepreciation Re-imbursement 3,850.00\nConsumables 910.00\nSub Total 11,590.99\nTotal Own Damage Premium(A) 11,591.00'
  :'Basic - OD 2,680.40\nBasic Roadside Assistance 51.00\nDepreciation Re-imbursement 2,100.00\nConsumables 756.00\nSub Total 5,587.40\nLess:\nNo claim bonus 35% 938.14\nSub-Total Deductions 938.14\nTotal Own Damage Premium(A) 4,649.00';
 const tp=kia?'3,416.00':'2,094.00',cpa='450.00',liability=kia?'3,916.00':'2,594.00',net=kia?'15,507.00':'7,243.00',gross=kia?'18,298.00':'8,547.00';
 const fuel=wrongFuel?' DIESEL':'';
 return [
  'Magma General Insurance Limited',
  'PRIVATE CAR PACKAGE POLICY',
  'Policy No P0123456789/4101/654321',
  'Name of Insured MR SAMPLE CUSTOMER',
  'Period of Insurance 27/11/2026 TO 26/11/2027',
  'Vehicle Make/Model '+maker+' / '+model,
  'RTO '+(kia?'GHAZIABAD, UTTAR PRADESH':'PALWAL'),
  'Vehicle Registration No. '+reg,
  'Engine No. E123456789',
  'Chassis No. CHASSIS123456789',
  'INSURED MOTOR VEHICLE DETAILS AND PREMIUM COMPUTATION',
  'Engine No. Chassis No. Make / Model / Type of Body',
  year+' E123456789 CHASSIS123456789',
  maker+' '+model,
  spec,
  'IDV (INSURED\'S DECLARED VALUE)',
  'Bi-Fuel kit(LPG/CNG) Other accessories Total Value',
  (kia?'700000':'420000')+' 0 0 0 / 0 0 '+(kia?'700000':'420000'),
  'OWN DAMAGE(A)',
  premium,
  'LIABILITY(B)',
  'Basic - TP '+tp,
  'PA Owner Driver -SI Rs.1500000 '+cpa,
  'LL to Paid Driver IMT 28 50.00',
  'Total Liability Premium(B) '+liability,
  'Total Package Premium(A+B) '+net,
  tax,
  'TOTAL '+gross,
  'Date of Issue : 20/11/2026',
  fuel
 ].join('\n');
}
for(const kia of [false,true]){
 const text=mock({kia});
 const good=parse(text);
 assert.equal(good.ok,true,JSON.stringify(good.warnings));
 assert.equal(Object.keys(good.checks).length,18);
 assert.equal(Object.values(good.checks).filter(Boolean).length,18);
 assert.equal(good.fields.find(f=>f.key==='vehicle_fuel_type')?.value,'Petrol');
 assert.equal(good.fields.find(f=>f.key==='od_premium')?.value,String(good.premium_components.od));
 assert.equal(good.fields.find(f=>f.key==='tp_premium')?.value,String(good.premium_components.tp));
 assert.equal(good.fields.filter(f=>f.key==='od_premium').length,1);
 assert.equal(good.fields.filter(f=>f.key==='tp_premium').length,1);
 assert.equal(good.fields.find(f=>f.key==='vehicle_rto_name')?.value,kia?'GHAZIABAD':'PALWAL');
 assert.equal(good.premium_components.taxRegime,kia?'IGST':'CGST_SGST');
 for(const manipulated of [
   text.replace('Date of Issue : 20/11/2026','No separately printed issuance date'),
   text.replace('TOTAL '+(kia?'18,298.00':'8,547.00'),'TOTAL 99,999.00'),
   text.replace('LL to Paid Driver IMT 28 50.00','LL to Paid Driver IMT 28 500.00'),
   text.replace('Magma General Insurance Limited','Unknown General Insurance Limited'),
   text.replace('Vehicle Make/Model '+(kia?'KIA INDIA PRIVATE LIMITED / ':'RENAULT / '), 'Vehicle Make/Model UNKNOWN / '),
   text.replace(kia?'1497.00 5 0':'999 7 0','2010 5 0')
 ]) assert.equal(parse(manipulated).ok,false,'Manipulated source must fail');
 const absentRto=parse(text.replace(/^RTO .+$/m,''));
 assert.equal(absentRto.ok,true,'Missing optional RTO cannot block extraction');
 assert.equal(absentRto.fields.some(f=>f.key==='vehicle_rto_name'),false);
 const movedCity=parse(text.replace(/^RTO .+$/m,'RTO '+(kia?'PUNE, MAHARASHTRA':'JAIPUR')));
 assert.equal(movedCity.ok,true,'Other dynamically labelled RTO geography is optional');
 assert.equal(movedCity.fields.find(f=>f.key==='vehicle_rto_name')?.value,kia?'PUNE':'JAIPUR');
}
const unknown=mock().replace('RENAULT / TRIBER RXE MT','RENAULT / UNKNOWN ELECTRIC MODEL');
assert.equal(parse(unknown).ok,false,'Never infer Petrol merely from Renault make');
console.log('Magma source parser: both tax layouts, 18 checks, optional RTO and negative source tests passed');
