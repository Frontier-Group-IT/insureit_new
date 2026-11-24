// Standalone, anonymized n8n Code-node regression. Real PDFs are never committed.
// Run: node infra/n8n-local/tests/united-india-gcv-layout-regression.mjs
import assert from 'node:assert/strict';
import {assessUiicGcvDirectConversion,assessUiicPrivateCarDirectConversion} from '../../../apps/web-portal/lib/policy-commercial-direct-eligibility.ts';
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

// RTO geography is optional: missing both, city-only, state-only, or unfamiliar
// city must never cause a failed parser check by itself.
for(const [label,options,city,state] of [
 ['neither',{authority:'NOT PRINTED'},undefined,undefined],
 ['city only',{authority:'KATNI ARTO INDIA'},'KATNI',undefined],
 ['state only',{authority:'NOT PRINTED',registered:true},undefined,'Madhya Pradesh'],
 ['new city',{authority:'RJ14 JAIPUR INDIA'},'JAIPUR',undefined],
]){
 const result=parse(sample(options));
 assert.equal(result.ok,true,label+': '+result.warnings.join('; '));
 assert.equal(value(result,'vehicle_rto_name'),city,label);
 assert.equal(value(result,'vehicle_rto_state'),state,label);
}
for(const [label,pdf] of [
 ['tampered premium',sample({tamperNet:true})],
 ['missing chassis',sample({omitChassis:true})],
 ['unreconciled CPA',sample({omitCpa:true})],
 ['conflicting issue dates',sample({conflictingIssue:true})],
])assert.equal(parse(pdf).ok,false,label+' must fail closed');

const privateCarText=[
 'UNITED INDIA INSURANCE COMPANY LIMITED','PRIVATE CAR -','PACKAGE POLICY',
 'POLICY NO.:2230003126P000000001','VEHICLE NO.:MP - 20 - CH - 1211',
 'PERIOD OF INSURANCE','From 00:00 Hrs of 29/11/2026','To Midnight of 28/11/2027',
 'Insured','MS EXAMPLE CUSTOMER',
 'Policy No. 2230003126P000000001 Previous Policy No. 123/31/2026/1',
 'Insured Details Customer Id 23680000000','Name MS EXAMPLE CUSTOMER',
 'Particulars of Vehicle Insured','Registration No.','Obsolete','Vehicle',
 'Engine No. Chassis No. Make/ Model','Type of','Body /','Fuel Type',
 'Year of','Mfg','Cubic','Capacity/KW','Seating','including','driver',
 'Vehicle','Trailer','( if any)','MP - 20 - CH -','1211','No',
 'MBHCZC03SJG000001 D13A0000001','MARUTI','SUZUKI /','SWIFT(2011',
 '- ) ZDI','CAR /','Diesel','2018 1248 5',"Insured's Declared Value",
 'For Vehicle For Trailer Non Electrical Accessories Electrical/Electronic Accessories CNG Unit LPG Unit Total Value',
 '270000 0 0 0 0 0 270000',
 'Registration Authority Auto Association Membership No. Geographical Area Extension',
 'MP20 JABALPUR INDIA',
 'Premium: 4,823.00','IGST(18%): 868.00','Stamp Duty: 1.00',
 'Total (Rounded Off): 5,691.00','A. Basic - OD 1,809.54',
 'No Claim Bonus 25% 452.39','Gross OD(A) 1,357.00','B. Basic - T P 3,416.00',
 'LL to Paid Driver IMT 28 50.00','Gross TP(B) 3,466.00',
 'Gross OD & TP:','(A) + (B)','4,823.00',
 'Compulsory Personal Accident (CPA) cover is removed','Date of Issue: 23/11/2026'
].join('\n');
const privateWithoutRto=parse(privateCarText.replace('MP20 JABALPUR INDIA','NOT PRINTED'));
assert.equal(privateWithoutRto.ok,true,'missing Private Car RTO city must not block');
assert.equal(value(privateWithoutRto,'vehicle_rto_name'),undefined);
const privateCar=parse(privateCarText);
assert.equal(privateCar.ok,true,privateCar.warnings.join('; '));
assert.equal(privateCar.parser_id,'united_india_private_car_package_native_pdf');
assert.equal(value(privateCar,'vehicle_class'),'Private Car');
assert.equal(value(privateCar,'vehicle_make'),'MARUTI SUZUKI');
assert.equal(value(privateCar,'vehicle_model'),'SWIFT(2011 - ) ZDI');
assert.equal(value(privateCar,'cpa_premium'),'0');
assert.deepEqual([privateCar.premium_components.od,privateCar.premium_components.tp,
 privateCar.premium_components.net,privateCar.premium_components.gst,
 privateCar.premium_components.gross],[1357,3466,4823,868,5691]);
for(const [name,pdf] of [
 ['wrong insurer product',privateCarText.replace('PRIVATE CAR -','GCV PUBLIC CARRIER OTHER THAN 3 WHEELER -')],
 ['altered NCB',privateCarText.replace('452.39','352.39')],
 ['missing CPA waiver',privateCarText.replace('Compulsory Personal Accident (CPA) cover is removed','')],
 ['tampered private tax',privateCarText.replace('IGST(18%): 868.00','IGST(18%): 768.00')],
 ['conflicting issue date',privateCarText+'\nDate of Issue: 24/11/2026'],
]){
 const r=parse(pdf);
 assert.equal(r.ok,false,name+' must block');
}

const eligibility=r=>assessUiicGcvDirectConversion({
 parserId:r.parser_id, checksPassed:Object.values(r.checks).filter(x=>x===true).length,
 warnings:r.warnings,fields:r.fields,commercialPremium:r.premium_components,
});
for(const [label,r] of [['new petrol',goodsPetrol],['new diesel',goodsDiesel],['Katni registered',katni]]){
 assert.equal(eligibility(r).eligible,true,label+': '+eligibility(r).reason);
}
const fakeAuthority=structuredClone(goodsPetrol);
fakeAuthority.fields.find(f=>f.key==='vehicle_rto_name').evidence='Native PDF policy schedule';
assert.equal(eligibility(fakeAuthority).eligible,true,'RTO name provenance is optional');
const fakeCpa=structuredClone(goodsDiesel);
fakeCpa.fields.find(f=>f.key==='cpa_premium').evidence='Unverified CPA';
assert.equal(eligibility(fakeCpa).eligible,false,'CPA amount without source evidence is not eligible');
const wrongClass=structuredClone(goodsPetrol);
wrongClass.fields.find(f=>f.key==='vehicle_class').value='Private Car';
assert.equal(eligibility(wrongClass).eligible,false,'Wrong vehicle class not eligible');
const inventedPlate=structuredClone(goodsPetrol);
inventedPlate.fields.find(f=>f.key==='vehicle_registration_number').value='MP511234';
assert.equal(eligibility(inventedPlate).eligible,false,'invented plate not eligible');
const doubleCounted=structuredClone(goodsDiesel);
doubleCounted.premium_components.tp+=325;
assert.equal(eligibility(doubleCounted).eligible,false,'double-counted owner driver CPA not eligible');
const privateEligible=assessUiicPrivateCarDirectConversion({
 parserId:privateCar.parser_id,checksPassed:Object.values(privateCar.checks).filter(Boolean).length,
 warnings:privateCar.warnings,fields:privateCar.fields,commercialPremium:privateCar.premium_components,
});
assert.equal(privateEligible.eligible,true,'certified private car package: '+privateEligible.reason);
const wrongSource=structuredClone(privateCar);
wrongSource.fields.find(f=>f.key==='vehicle_rto_name').evidence='Insured address Jabalpur';
assert.equal(assessUiicPrivateCarDirectConversion({
 parserId:wrongSource.parser_id,checksPassed:18,warnings:wrongSource.warnings,
 fields:wrongSource.fields,commercialPremium:wrongSource.premium_components,
}).eligible,true,'RTO provenance cannot block conversion');
const action=readFileSync(resolve(here,'../../../apps/web-portal/app/development/ai-policy-onboarding/actions.ts'),'utf8');
assert.match(action,/reverifiedUiicExtraction=uiicFailedSource/);
assert.match(action,/assessUiicGcvDirectConversion/);
assert.match(action,/mapVerifiedUiicGcvCommercialPremium/);
assert.match(action,/extracted\.preview\.documentId===queued\.document_id/);

console.log('United India GCV: 4 layout families, optional RTO city/state combinations, strict financial negatives and source-gated conversion passed');
