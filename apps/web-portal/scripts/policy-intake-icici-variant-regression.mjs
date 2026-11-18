import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync(new URL("../../../infra/n8n-local/parser/icici-3005-dual-v2.js",import.meta.url),"utf8");
const extract=new Function("$input",source);
function parse(text){
  const rows=extract({first:()=>({json:{text}})});
  assert.equal(rows.length,1);
  return rows[0].json;
}
function assertPassed(result,parser){
  assert.equal(result.parser_id,parser);
  assert.equal(result.validation_passed,true,JSON.stringify(result.checks));
  assert.equal(result.warnings.length,0,JSON.stringify(result.warnings));
  assert.equal(Object.keys(result.checks).length,13);
  assert(Object.values(result.checks).every(Boolean));
}
function odText({suffix="000",ncb=false}={}){
  const basic=ncb?1774:2056;
  const addon1=ncb?634:640,addon2=ncb?99:0;
  const subtotal=basic+addon1+addon2,deduction=ncb?444:0;
  const net=subtotal-deduction;
  const tax=ncb?371:485,gross=net+tax;
  const igst=ncb?"371.34":"485.28";
  return `ICICI LOMBARD GENERAL INSURANCE COMPANY LIMITED
Product Code: 3005/O
Stand-Alone Own Damage Two wheeler Insurance Policy
Please find enclosed Policy No. 3005/O/987654321/00/${suffix}
Insured & Vehicle Details
Name of the Insured    TEST CUSTOMER
Period of Insurance - Own Damage    Nov 12, 2026 to Nov 11, 2027
Vehicle Make / Model    BAJAJ / CHETAK 3503
RTO City    MADHYA PRADESH-JABALPUR
Vehicle Registration No. MP20XA6575
Vehicle Registration Date Nov 17, 2025
Engine No. E20ASH69298
Chassis No. MD2C59200SAH52808
${ncb?"Current Year NCB(%) 25%":""}
Previous Policy Details
Third Party Insurance Details
Third Party Policy No. OG-26-4474-1826-00003127
Third Party Period of Insurance Nov 12, 2025 to Nov 11, 2030
Third Party Insurer Name BAJAJ GIL
This Policy covers only Own Damage Risk with no other liability
Policy Issued On : Nov 10, 2026
MP20XA6575 BAJAJ CHETAK 3503 Solo With Pillion 4.2 2025 2 MD2C59200SAH52808 E20ASH69298
Vehicle IDV  Total IDV
98,505.00 0.00 0.00 0.00 98,505.00
Premium Details
Basic OD Premium      ${basic.toLocaleString("en-IN")}.00
Zero Depreciation (Silver)       ${addon1}.00
${ncb?"IL Smart Assist       99.00":""}
Sub Total       ${subtotal.toLocaleString("en-IN")}.00
${ncb?"Less:\\nNo Claim Bonus 25%       444.00\\nSub-Total Deductions       444.00":""}
Total Own Damage Premium(A)       ${net.toLocaleString("en-IN")}.00
IGST
% 18
${igst}
Total Tax Payable in Rs ${tax}.00
Total Premium Payable In Rs ${gross.toLocaleString("en-IN")}.00
Unique Identification Number (UIN) Details`.replace(/\\n/g,"\n");
}
const regular=parse(odText());
assertPassed(regular,"icici_3005_od_n8n_native_pdf");
assert.equal(regular.premium_components.od_deductions,0);
assert.equal(regular.premium_components.net_premium,2696);
assert.equal(regular.premium_components.gross_premium,3181);
const amended=parse(odText({suffix:"B00",ncb:true}));
assertPassed(amended,"icici_3005_od_n8n_native_pdf");
assert.equal(amended.premium_components.od_deductions,444);
assert.equal(amended.premium_components.net_premium,2063);
assert.equal(amended.premium_components.gross_premium,2434);
assert.equal(amended.insureit_proposal.find(f=>f.key==="policy_number").value,"3005/O/987654321/00/B00");

const bundled=`ICICI LOMBARD GENERAL INSURANCE COMPANY LIMITED
Product Code: 3005
Bundled – Two Wheeler Policy
Please find enclosed Policy No. 3005/987654321/00/000
Insured & Vehicle Details
Name of Insured                 TEST BUSINESS
Period of Insurance - Own Damage       Nov 16, 2026 to Nov 15, 2027
Period of Insurance - Third Party      Nov 16, 2026 to Nov 15, 2031
Vehicle Make / Model                 CHETAK / CHETAK 3503
RTO City MADHYA PRADESH-JABALPUR
Vehicle Registration No. NEW
Vehicle Registration Date Nov 16, 2026
Engine No. E20ATH53290
Chassis No. MD2C59204TAH52134
Name of the Insured : TEST BUSINESS
Policy Issued On : Nov 16, 2026
Vehicle Registration No. Make Model Type of Body CC/KW Mfg Yr Seating Capacity
NEW CHETAK CHETAK 3503 Solo With Pillion 4.2 2026 2 MD2C59204TAH52134 E20ATH53290
Vehicle IDV  Total IDV
1,24,163.00 0.00 0.00 0.00 1,24,163.00
Premium Details
OWN DAMAGE(A) LIABILITY(B)
Basic OD Premium 1,598.00 Basic Third Party Liability 3,273.00
Zero Depreciation (Silver) 683.00 Total 3,273.00
Return to Invoice 248.00
Battery Protect Premium 310.00
Sub Total 2,839.00
Total Own Damage Premium(A) 2,839.00 Total Liability Premium(B) 3,273.00
Total Package Premium(A+B): 6,112.00
% 18.00 IGST 1,100.16
Total Tax Payable in Rs 1,100.00
Total Premium Payable In Rs 7,212.00
Geographical Area: India
Compulsory Personal Accident cover has not been opted in this policy on account that, the vehicle to be insured is not owned by an individual.
PA Cover for Owner-Driver under Section III: CSI 0/-`;
const corp=parse(bundled);
assertPassed(corp,"icici_3005_n8n_native_pdf");
assert.equal(corp.premium_components.owner_driver_cpa,0);
assert.equal(corp.premium_components.gross_premium,7212);
const fields=new Map(corp.insureit_proposal.map(f=>[f.key,f.value]));
for(const [key,value] of Object.entries({
 policy_issuance_date:"2026-11-16",
 vehicle_class:"Two Wheeler",vehicle_fuel_type:"Electric",
 vehicle_motor_power_kw:"4.2",cpa_premium:"0",
})){assert.equal(fields.get(key),value,`verified bundled field ${key}`);}
console.log("ICICI 3005 variants: no-NCB OD, B00 NCB OD, no-CPA business Bundled PASS (13/13 each)");
