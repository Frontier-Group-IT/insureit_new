// Run: node infra/n8n-local/tests/non-tata-commercial-parser-regression.mjs
// Synthetic, non-identifying fixtures: 6 New India, 1 IFFCO, 1 Digit + negatives.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parseNonTata}=require('../workflows/non-tata-commercial-motor-native-pdf-parser-v1.js');
const field=(r,k)=>r.fields.find(f=>f.key===k)?.value;
const nia=[
 ['NIA-A',15184,35738,50922,4576,55498,'MP-51',false],
 ['NIA-B',26102,44375,70477,6973,77450,'MP-23',false],
 ['NIA-C',4672,16149,20821,1661,22482,'MP-20',false],
 ['NIA-D',6810,16149,22959,2046,25005,'MP-18',false],
 ['NIA-E',5677,16424,22101,1891,23992,'HR-00',false],
 ['NIA-F',430,16149,16579,897,17476,'MP-20-GB-2902',true]
];
for(let i=0;i<nia.length;i++){
 const [tag,od,tp,net,gst,gross,plate,complete]=nia[i];
 const text=[
 'THE NEW INDIA ASSURANCE CO. LTD.',
 'POLICY SCHEDULE CUM CERTIFICATE OF INSURANCE',
 'Commercial Vehicle Package Policy',
 'Policy Number :3128003126030000'+String(2100+i),
 "Insured's Name EXAMPLE SAMPLE CUSTOMER        Customer ID TEST012",
 'Period of cover 06/11/2026 02:46:54 PM to 05/11/2027 11:59:59 PM',
 'Chassis no./Engine no.: MAT843319T7J28325/3.6L',
 'RDE03JTX530573',
 'Make/Model: TATA MOTOR/TEST TRUCK       Registration no. '+plate,
 'INSURED DECLARED VALUE (Rs)',
 'Vehicle Trailer Non-Elec Acc Electrical Acc Total Value',
 '2978298 0 0 0 0 2978298',
 'Total OD Premium (Rs) '+od,
 'Total TP Premium (Rs) '+tp,
 'Net Premium (Rs) '+net,
 'GST (Rs) '+gst,
 'Total Payable (Rs) '+gross,
 'Date of Issue: 19/11/2026'
 ].join('\n');
 // Native PDF.js may collapse table columns to one intervening space.
 // Keep a heading-delimited extraction; never take arbitrary adjacent text.
 if(i===0 || i===1){
  const narrow=text
    .replace("Insured's Name EXAMPLE SAMPLE CUSTOMER        Customer ID",
      "Insured's Name EXAMPLE SAMPLE CUSTOMER Customer ID")
    .replace("Make/Model: TATA MOTOR/TEST TRUCK       Registration no.",
      "Make/Model: TATA MOTOR/TEST TRUCK Registration no.");
  const parsedNarrow=parseNonTata(narrow);
  assert.equal(field(parsedNarrow,'insured_name'),'EXAMPLE SAMPLE CUSTOMER');
  assert.equal(field(parsedNarrow,'vehicle_make'),'TATA MOTOR');
  assert.equal(field(parsedNarrow,'vehicle_model'),'TEST TRUCK');
  assert.equal(parsedNarrow.checks.registration_complete,true);
  assert.equal(parsedNarrow.ok,true,'RTO-only prefix must classify as new unregistered');
  assert.equal(field(parsedNarrow,'vehicle_registration_status'),'unregistered');
 }
 const r=parseNonTata(text);
 assert.equal(r.parser_id,'new_india_cv_native_pdf',tag);
 assert.deepEqual([r.premium_components.od,r.premium_components.tp,r.premium_components.net,r.premium_components.gst,r.premium_components.gross],[od,tp,net,gst,gross],tag);
 assert.equal(r.checks.net_od_tp_reconciled,true,tag);
 assert.equal(r.checks.gross_net_tax_reconciled,true,tag);
 assert.equal(r.ok,true,tag+' RTO-only prefix is a verified unregistered vehicle');
 assert.equal(field(r,'vehicle_registration_status'),complete?'registered':'unregistered');
 assert.equal(r.checks.registration_complete,true,tag+' registration status verified from prefix');
 assert.equal(r.review_required,true);
 assert.equal(r.auto_finalize_allowed,false);
 assert.equal(field(r,'policy_issuance_date'),'2026-11-19',tag);
}
// Unknown/malformed registration evidence must still fail strict checks.
const niaUnknown=[
 'THE NEW INDIA ASSURANCE CO. LTD.',
 'POLICY SCHEDULE CUM CERTIFICATE OF INSURANCE',
 'Commercial Vehicle Package Policy',
 'Policy Number :31280031260300002100',
 "Insured's Name EXAMPLE SAMPLE CUSTOMER Customer ID TEST012",
 'Period of cover 06/11/2026 02:46:54 PM to 05/11/2027 11:59:59 PM',
 'Chassis no./Engine no.: MAT843319T7J28325/3.6L',
 'RDE03JTX530573',
 'Make/Model: TATA MOTOR/TEST TRUCK Registration no. XX-00',
 'INSURED DECLARED VALUE (Rs)',
 'Vehicle Trailer Non-Elec Acc Electrical Acc Total Value',
 '2978298 0 0 0 0 2978298',
 'Total OD Premium (Rs) 15184',
 'Total TP Premium (Rs) 35738',
 'Net Premium (Rs) 50922',
 'GST (Rs) 4576',
 'Total Payable (Rs) 55498',
 'Date of Issue: 19/11/2026',
].join('\\n');
const invalidPrefix=parseNonTata(niaUnknown);
assert.equal(invalidPrefix.ok,false);
assert.equal(invalidPrefix.checks.registration_complete,false);

const iffcoText=[
 'IFFCO TOKIO GENERAL INSURANCE CO.LTD',
 'COMMERCIAL VEHICLE CERTIFICATE OF INSURANCE cum SCHEDULE & TAX INVOICE',
 'UIN: IRDAN106P0005V01200607',
 'EXAMPLE AGRI INDUSTRIES PRIVATE LIMITED',
 'Policy #:',
 'P400 Policy # N1234567',
 'Invoice/Issuance Date: 29/10/2026 19:38:26',
 'Period of Insurance From: 08/11/2026 00:00:00',
 'To: Midnight On 07/11/2027 23:59:59',
 'Vehicle Name JCB 3 DX 2WD / BACKHOE LOADER',
 'Registration Mark & No. MP20XA6008',
 'Engine No. H00494870',
 'Chassis No. RAJ3DXS5H03577322',
 'Total Value Net Premium Rs.',
 '2978742.00','0.00','0.00','0','2978742.00',
 'Net (A) 5847.00','Net (B) 7367.00',
 'Premium/Taxable Value RS. 13214.00',
 'Gross Premium Payable Rs. 15592.52',
 'GST Details','997134','13214.00','18.00','2378.52','15592.52'
].join('\n');
const i=parseNonTata(iffcoText);
assert.equal(i.ok,true,JSON.stringify(i.warnings));
assert.equal(i.parser_id,'iffco_tokio_cv_native_pdf');
assert.deepEqual([i.premium_components.od,i.premium_components.tp,i.premium_components.net,i.premium_components.gst,i.premium_components.gross],[5847,7367,13214,2378.52,15592.52]);
const digitText=[
 'Digit Commercial Vehicle Insurance',
 'Go Digit General Insurance Ltd.',
 'Name MR SAMPLE POLICYHOLDER             Vehicle Registration No. MP20DA1234',
 'Policy No. D123456789 / 19112026',
 'Policy Issue Date 19-Nov-2026',
 'Make JCB',
 'Model/Vehicle Variant 3 DX ECO XPERT / BACKHOE LOADER',
 'From 21-Nov-2026 00:00:01',
 'To 20-Nov-2027 23:59:59',
 'Chassis No. HAR3DXINH01234567',
 'Engine No. H00123456',
 'YOUR VEHICLE IDV',
 'Vehicle IDV',
 '2061770 --',
 'OWN DAMAGE PREMIUM [A]',
 'Total OD () 2415.46      TotalPremiumAct () 7647.00',
 'Net Premium [A+B} () 10062.46',
 'IGST @ 18% = (1811.24)',
 'Total Premium () 11873.70'
].join('\n');
const d=parseNonTata(digitText);
assert.equal(d.ok,true,JSON.stringify(d.warnings));
assert.equal(d.parser_id,'go_digit_cv_native_pdf');
const digitRawName = digitText.replace(
  'Name MR SAMPLE POLICYHOLDER             Vehicle Registration No.',
  'Name MR SAMPLE POLICYHOLDER Vehicle Registration No.',
);
const rawNameResult=parseNonTata(digitRawName);
assert.equal(rawNameResult.ok,true,JSON.stringify(rawNameResult.warnings));
assert.equal(field(rawNameResult,'insured_name'),'MR SAMPLE POLICYHOLDER');
assert.equal(rawNameResult.checks.insured_name_verified,true);
// Existing titled Go Digit schedules may have indentation, or place the
// registration label on the next line. Keep the original permissive titled
// match exactly, even while new untitled cases require adjacent provenance.
for(const titledVariant of [
  digitText.replace('Name MR SAMPLE POLICYHOLDER             Vehicle Registration No.',
    'Name MR SAMPLE POLICYHOLDER\nVehicle Registration No.'),
  digitText.replace('Name MR SAMPLE POLICYHOLDER             Vehicle Registration No.',
    '    Name MR SAMPLE POLICYHOLDER             Vehicle Registration No.'),
]){
  const parsed=parseNonTata(titledVariant);
  assert.equal(parsed.ok,true,'Previously supported titled layout must remain accepted');
  assert.equal(field(parsed,'insured_name'),'MR SAMPLE POLICYHOLDER');
}

// An absent identity must still be rejected rather than guessed.
const digitNoName=parseNonTata(digitRawName.replace('Name MR SAMPLE POLICYHOLDER ', ''));
assert.equal(digitNoName.checks.insured_name_verified,false);
assert.equal(digitNoName.ok,false);

assert.deepEqual([d.premium_components.od,d.premium_components.tp,d.premium_components.net,d.premium_components.gst,d.premium_components.gross],[2415.46,7647,10062.46,1811.24,11873.7]);
// Reproduces the four failed JCB/Go Digit 3 DX 2WD native-PDF layouts
// with synthetic values only. Other insurer branches and ECO XPERT must
// retain their existing outputs.
const digitJcb=digitText
  .replace('Name MR SAMPLE POLICYHOLDER             Vehicle Registration No.',
    'Name\nEXAMPLE CONTRACTORS\nVehicle Registration No.')
  .replace('3 DX ECO XPERT / BACKHOE LOADER','3 DX 2WD / BACKHOE\nLOADER')
  .replace('HAR3DXINH01234567','RAJ3DXS5T03577700')
  .replace('7647.00','7317.00')
  .replace('10062.46','9732.46')
  .replace('1811.24','1751.84')
  .replace('11873.70','11484.30')
  +'\nBasic Third-Party Liability (`'+') 7267.00'
  +'\nPA cover for Owner-Driver (`'+')\n--'
  +'\nLegal Liability to Paid (`'+') Driver (Persons:1) 50.00';
const jcb=parseNonTata(digitJcb);
assert.equal(jcb.ok,true,JSON.stringify(jcb.warnings));
assert.equal(field(jcb,'insured_name'),'EXAMPLE CONTRACTORS');
assert.equal(field(jcb,'vehicle_model'),'3 DX 2WD / BACKHOE LOADER');
assert.equal(field(jcb,'vehicle_chassis_number'),'RAJ3DXS5T03577700');
assert.deepEqual([jcb.premium_components.od,jcb.premium_components.tp,jcb.premium_components.gross],[2415.46,7317,11484.3]);
assert.equal(jcb.checks.tp_itemization,true);
const titledJcb=parseNonTata(digitJcb.replace('Name\nEXAMPLE CONTRACTORS\n',
  'Name MS EXAMPLE DRIVER '));
assert.equal(titledJcb.ok,true);
assert.equal(field(titledJcb,'insured_name'),'MS EXAMPLE DRIVER');
const missingOwnerPa=digitJcb.replace('PA cover for Owner-Driver (`'+')\n--\n','');
assert.equal(parseNonTata(missingOwnerPa).checks.tp_itemization,false,
  'Missing owner PA cannot be silently zeroed');
assert.equal(parseNonTata(missingOwnerPa).ok,false);
const changedTp=digitJcb.replace('TotalPremiumAct () 7317.00','TotalPremiumAct () 7647.00');
assert.equal(parseNonTata(changedTp).ok,false,'Incorrect TP fails independent net reconciliation');
assert.equal(parseNonTata(digitJcb.replace('EXAMPLE CONTRACTORS','')).ok,false,
  'No insured must not be inferred from registration or broker name');
assert.equal(parseNonTata(digitJcb.replace('RAJ3DXS5T03577700',
  'RAJ3DXS5T03577700\nRAJ3DXS5T03577701')).checks.vehicle_identification_verified,false,
  'Conflicting chassis identities must fail closed');
assert.equal(parseNonTata(digitJcb.replace('RAJ3DXS5T03577700',
  'ZZZ3DXS5T03577700')).ok,false,
  'Unverified JCB chassis prefixes must not be accepted');

const unknown=parseNonTata('UNTRAINED LIFE INSURER DOCUMENT 12345');
assert.equal(unknown.ok,false);assert.equal(unknown.auto_finalize_allowed,false);
const altered=parseNonTata(iffcoText.replace('Gross Premium Payable Rs. 15592.52','Gross Premium Payable Rs. 16592.52'));
assert.equal(altered.ok,false,'Tampered gross must fail independent GST validation');
const alteredTax=parseNonTata(iffcoText.replace('2378.52','2278.52'));
assert.equal(alteredTax.ok,false,'Tampered GST must fail independent net-plus-tax validation');
console.log('PASS 6 NIA + IFFCO + Digit + 2 negative tests. Review only; no policy writes.');
