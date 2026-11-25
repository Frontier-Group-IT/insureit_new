import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const module={exports:{}};
const code=fs.readFileSync(path.resolve(here,'../extensions/national-private-car-liability-only-source-candidate.js'),'utf8');
vm.runInNewContext(code,{module,exports:module.exports});
const parse=module.exports.parseNationalPrivateCarLiability;
const sample=[
 'पॉलिसी अनुसूची /Policy Schedule - Motor - Private Car - Liability Only',
 'पॉलिसी संख्या / Policy Number: 123456789012345678',
 'ग्राहक का नाम /Customer Name: MR SAMPLE CUSTOMER/Customer ID: 123456',
 'प्रीमियम की अनुसूची /Schedule of Premium',
 '/Policy Effective from 11:09 hours, on 23/11/2026 /to midnight of 22/11/2027',
 'प्रीमियम/ Premium',
 '₹ 3,416.00',
 'सीजीएसटी/CGST',
 '₹ 0.00',
 'एसजीएसटी/UTGST/SGST/UTG',
 'ST',
 '₹ 0.00',
 'आईजीएसटी/IGST',
 '₹ 615.00',
 '/Recoverable Stamp',
 'Duty',
 '₹ 0.00',
 '/ Total Amount',
 '₹ 4,031.00',
 '/Vehicle IDV',
 'NA',
 '/Regn. Number',
 'HR-51-BB-7085',
 '/IDV',
 'Engine or M/c',
 'No.',
 'EP21490',
 '/Chassis Number',
 'FAKECHASSIS987654321',
 '/Regn.',
 'Authority',
 'Faridabad',
 '/Geographical Area',
 'India',
 '/Make',
 'FORD',
 '/Addl. Towing',
 'NA',
 '/Model',
 'ECOSPORT',
 '/Anti Theft Device',
 'No',
 '/Variant',
 'AMBIENTE 1.5L TDCI',
 '/CC / KW',
 '1498',
 '/Class of Vehicle',
 'Private Car',
 '/ Type of Fuel',
 'DIESEL',
 '/Body Type',
 'SUV',
 '/Year of Mfg.',
 '2014',
 '/ Date of Registration',
 '23/11/2014',
 'National Insurance Co. Ltd.',
 'जारी करने की ततधि /Date of issue: 23/11/2026'
].join('\n');
const valid=parse(sample);
assert.equal(valid.ok,true,JSON.stringify(valid.warnings));
assert.equal(Object.keys(valid.checks).length,18);
assert.equal(valid.premium_components.od,0);
assert.equal(valid.premium_components.cpa,0);
assert.equal(valid.premium_components.tp,3416);
assert.equal(valid.premium_components.gst,615);
assert.equal(valid.premium_components.gross,4031);
assert.equal(valid.fields.find(f=>f.key==='vehicle_rto_name')?.value,'Faridabad');
const withoutRto=sample.replace('/Regn.\nAuthority\nFaridabad\n','');
assert.equal(parse(withoutRto).ok,true,'Missing optional RTO cannot fail');
assert.equal(parse(withoutRto).fields.some(f=>f.key==='vehicle_rto_name'),false);
const alternateCity=sample.replace('Authority\nFaridabad','Authority\nGwalior');
assert.equal(parse(alternateCity).ok,true,'Non-allowlisted city is optional enrichment');
assert.equal(parse(alternateCity).fields.find(f=>f.key==='vehicle_rto_name')?.value,'Gwalior');
for(const altered of [
 sample.replace('National Insurance Co. Ltd.','Unknown Insurance Co.'),
 sample.replace('Liability Only','Package'),
 sample.replace('/Date of issue: 23/11/2026','/Date of issue: 01/99/2026'),
 sample.replace('₹ 4,031.00','₹ 4,999.00'),
 sample.replace('₹ 615.00','₹ 915.00'),
 sample.replace('HR-51-BB-7085','MP-51'),
 sample.replace('/Chassis Number\nFAKECHASSIS987654321','/Chassis Number\n'),
 sample.replace('/ Type of Fuel\nDIESEL','/ Type of Fuel\nUNKNOWN'),
 sample.replace('/Vehicle IDV\nNA','/Vehicle IDV\n100000'),
])assert.equal(parse(altered).ok,false,'Invalid source must not qualify');
console.log('National Liability Only: bilingual schedule 18-check, premium, optional RTO and negatives passed');
