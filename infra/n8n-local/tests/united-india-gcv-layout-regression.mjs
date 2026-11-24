// Standalone, anonymized n8n Code-node regression. Real PDFs are never committed.
// Run: node infra/n8n-local/tests/united-india-gcv-layout-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(resolve(here,'../extensions/united-india-gcv-parser-node.js'),'utf8');
const node=new Function('$input','$',source);
const parse=t=>node({all:()=>[{json:{text:t}}]},()=>({first:()=>({json:{}})}))[0].json;
const value=(r,k)=>r.fields.find(f=>f.key===k)?.value;
function sample({registered=false,authority='MP51 MANDLA INDIA',kind='petrol',policy='1234567890P123456789',
  tamperNet=false,omitChassis=false,omitCpa=false,conflictingIssue=false}={}){
 const diesel=kind==='diesel';
 const od=diesel?12405:3145,tp=diesel?27686:16474;
 const net=od+tp+(tamperNet?100:0),tax=dieSelTax();
 function dieSelTax(){return diesel?[2323,1359]:[643,802];}
 const title='GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY';
 const engine=diesel?'3.3B0E6SYNTHETIC777':'275MPFI03SYNTHETIC9';
 const chassis='MAT00000000000001';
 return [
 'UNITED INDIA INSURANCE COMPANY LIMITED',title,
 'VEHICLE NO.:'+(registered?'MP - 21 - ZH - 1234':'NEW'),
 'PERIOD OF INSURANCE',
 'From 23:00 Hrs of 16/11/2026',
 'To Midnight of 15/11/2027',
 'Policy No. '+policy+' Certificate Number '+policy,
 'Customer Id 12345678900',
 'Name of the Insured MR TEST POLICYHOLDER',
 'Address of the Insured',
 'UNRELATED CITY MUST NOT BECOME RTO',
 'Effective date of commencement of Insurance for the purpose of Act from 23:00 Hrs on 16/11/2026',
 'Date of Expiry of the Insurance Midnight on 15/11/2027',
 'Date of Issue: 16/11/2026',
 ...(conflictingIssue?['Date of Issue: 15/11/2026']:[]),
 'Particulars of Vehicle Insured',
 'Registration No.','Obsolete','Vehicle Engine No. Chassis No. Make/Model',
 registered?'MP - 21 - ZH - 1234 No':'NEW No',
 engine, 'BODY SERIAL',...(omitChassis?[]:[chassis]),
 'Tata Motors /',
 diesel?'912 LPT null':'ACE GOLD',
 diesel?'':'PETROL S CLB',diesel?'':'BSVI null',
 diesel?'2026':'Closed / Petrol 2026 700',
 diesel?'Closed / Diesel 3300 9150':'1740',
 "Insured's Declared Value 1200000",
 'Registration Authority Geographical Area',
 authority,
 'Amount in words: synthetic policy only',
 'A. Basic - OD 1000',
 'Gross OD(A) '+od,
 'B. Basic - TP '+(diesel?27186:16049),
 ...(omitCpa?[]:['Compulsory PA for Owner Driver 325.00']),
 'LL to Paid Driver IMT 28 100.00',
 ...(diesel?['Legal Liability to Non-Fare Paying','Passenger(Employee) 75.00']:[]),
 'Gross TP(B) '+tp,
 'Gross OD & TP:','(A) + (B)',String(net),
 'IGST-Others(18%): '+tax[0],
 'IGST-Basic TP(5%): '+tax[1],
 'Stamp Duty: 1.00',
 'Total(Rounded Off): '+(net+tax[0]+tax[1]),
 ].filter(Boolean).join('\n');
}
const goodsPetrol=parse(sample());
assert.equal(goodsPetrol.ok,true,goodsPetrol.warnings.join('; '));
assert.equal(value(goodsPetrol,'insured_name'),'MR TEST POLICYHOLDER');
assert.equal(value(goodsPetrol,'vehicle_registration_status'),'registration_pending');
assert.equal(value(goodsPetrol,'vehicle_rto_name'),'MANDLA');
assert.equal(value(goodsPetrol,'vehicle_rto_state'),'Madhya Pradesh');
assert.equal(value(goodsPetrol,'vehicle_fuel_type'),'Petrol');
assert.equal(value(goodsPetrol,'vehicle_capacity'),'700');
assert.equal(value(goodsPetrol,'policy_issuance_date'),'2026-11-16');
assert.equal(value(goodsPetrol,'cpa_premium'),'325');
assert.deepEqual([goodsPetrol.premium_components.od,goodsPetrol.premium_components.tp,goodsPetrol.premium_components.net,goodsPetrol.premium_components.gst,goodsPetrol.premium_components.gross],[3145,16474,19619,1445,21064]);
const goodsDiesel=parse(sample({kind:'diesel',authority:'MP18 SHAHDOL INDIA'}));
assert.equal(goodsDiesel.ok,true,goodsDiesel.warnings.join('; '));
assert.equal(value(goodsDiesel,'vehicle_rto_name'),'SHAHDOL');
assert.equal(value(goodsDiesel,'vehicle_fuel_type'),'Diesel');
assert.equal(value(goodsDiesel,'vehicle_capacity'),'3300');
assert.equal(value(goodsDiesel,'vehicle_manufacturing_year'),'2026');
assert.equal(goodsDiesel.premium_components.net,40091);
const katni=parse(sample({registered:true,authority:'KATNI ARTO INDIA'}));
assert.equal(katni.ok,true,katni.warnings.join('; '));
assert.equal(value(katni,'vehicle_rto_name'),'KATNI');
assert.equal(value(katni,'vehicle_registration_status'),'registered');
const privateCar=parse('UNITED INDIA INSURANCE COMPANY LIMITED\nPRIVATE CAR -\nPACKAGE POLICY\n'+sample());
assert.equal(privateCar.ok,false);
assert.match(privateCar.warnings.join(' '),/Private Car Package/);
for(const [name,text] of [
 ['unknown RTO',sample({authority:'UNKNOWN CITY INDIA'})],
 ['tampered premium',sample({tamperNet:true})],
 ['missing chassis',sample({omitChassis:true})],
 ['unreconciled CPA',sample({omitCpa:true})],
 ['conflicting issue dates',sample({conflictingIssue:true})],
 ['spoofed insured city',sample({authority:'UNKNOWN LOCATION INDIA'})],
]){
 const r=parse(text);
 assert.equal(r.ok,false,name+' must fail closed');
}
console.log('United India GCV layout variants: 3 positive + Private Car guard + 6 hard negatives passed');
