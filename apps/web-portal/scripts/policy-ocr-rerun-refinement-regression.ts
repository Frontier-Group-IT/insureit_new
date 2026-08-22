import assert from "node:assert/strict";
// @ts-expect-error -- This regression runner executes TypeScript directly with Node --experimental-strip-types.
import { refineApprovedMotorPolicyLayout } from "../lib/policy-ocr-approved-layout-refiner.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";
import type { StructuredPolicyTable } from "../lib/policy-ocr-iffco-structured-refiner.ts";

function parsed(parserId: string, fields: ParsedPolicyResult["fields"] = []): ParsedPolicyResult {
  return { parserId, parserVersion: `${parserId}.1.0`, fields, warnings: [] };
}
function values(result: ParsedPolicyResult) {
  return Object.fromEntries(result.fields.map((field) => [field.key, field.value]));
}
function run(name: string, result: ParsedPolicyResult, expected: Record<string,string>) {
  const v=values(result); for (const [k,x] of Object.entries(expected)) assert.equal(v[k],x,`${name}: ${k}`); console.log('PASS',name,result.parserId,result.parserVersion);
}

run('Magma SAOD', refineApprovedMotorPolicyLayout([
  'MAGMA GENERAL INSURANCE LIMITED\nSTAND-ALONE OWN DAMAGE POLICY FOR PRIVATE CAR\nPolicy No P0099999999/9999/999999\nPeriod Of Insurance 21:23 Hrs of 27/06/2026 To Midnight of 26/06/2027'
], [{page:2,rows:[["Registration No","HR29SAFE9101"],["Engine No","ENGSAFE9101"],["Chassis No","CHSSAFE9101"],["Make","MARUTI SUZUKI"],["Model","WAGON R VXI CNG"],["CC","998"],["Year of Manufacture","2025"],["Total Value","598072"],["Total Own Damage Premium","9575"],["CGST @ 9%","861.75"],["SGST @ 9%","861.75"]]}], parsed('generic_motor_v1')), {
  insurer_name:'Magma General Insurance Limited',policy_product:'SAOD',idv:'598072',od_premium:'9575',tp_premium:'0',cpa_opted:'No',cpa_premium:'0',total_premium:'9575',tax_amount:'1723.5',gross_premium:'11298.5'
});

run('Magma PCP Package', refineApprovedMotorPolicyLayout([
  'MAGMA GENERAL INSURANCE LIMITED\nPRIVATE CAR PACKAGE POLICY\nPolicy No P0099999999/4101/102104\nPeriod of Insurance 12/06/2026 TO 11/06/2027'
], [{page:2,rows:[["IDV of Vehicle","320000"],["Total Value","320000"],["Total Own Damage Premium(A)","5739"],["Basic - TP","3416"],["PA Owner Driver -SI Rs.1500000 Tenure 1 Year(s)","375"],["LL to Paid Driver IMT 28","50"],["Total Liability Premium(B)","3841"],["Total Package Premium(A+B)","9580"],["CGST @ 9%","862.20"],["SGST @ 9%","862.20"],["TOTAL","11304"]]}], parsed('generic_motor_v1')), {
  insurer_name:'Magma General Insurance Limited',policy_product:'Package',idv:'320000',od_premium:'5739',tp_premium:'3466',cpa_opted:'Yes',cpa_premium:'375',total_premium:'9580',tax_amount:'1724.4',gross_premium:'11304'
});

run('Magma GCV Liability', refineApprovedMotorPolicyLayout([
  'MAGMA GENERAL INSURANCE LIMITED\nCOMMERCIAL VEHICLE LIABILITY ONLY POLICY\nPolicy No P0099999999/4193/100974\nPeriod Of Insurance 04/07/2026 TO 03/07/2027\nReason for not opting PA Cover of Owner Driver : Do not hold a valid driving license'
], [{page:2,rows:[["Basic - TP","35313"],["LL to Paid Driver IMT 28","100"],["Sub Total","35413"],["IGST @ 5%","1765.65"],["IGST @ 18%","18.00"],["Total Liability Premium","35413"],["TOTAL IGST","1783.65"],["TOTAL","37197"]]}], parsed('iffco_tokio_commercial_motor_v2')), {
  insurer_name:'Magma General Insurance Limited',policy_product:'Third Party',idv:'0',od_premium:'0',tp_premium:'35313',cpa_opted:'No',cpa_premium:'100',total_premium:'35413',tax_amount:'1783.65',gross_premium:'37197'
});

run('UIIC PCV Package', refineApprovedMotorPolicyLayout([
 'UNITED INDIA INSURANCE COMPANY LIMITED\nPCV 4 WHEELER EXCEEDING 6 or 3 WHEELER EXCEEDING 18 PACKAGE POLICY\nPolicy No. 2230003126P199999999\nEffective date of commencement of Insurance for the purpose of Act from 00:00 Hrs on 29/08/2026\nDate of Expiry of the Insurance Midnight on 28/08/2027\nCompulsory Personal Accident (CPA) cover is removed, since owner driver is not holding a valid driving license.'
], [{page:2,rows:[["Insured's Declared Value","1420250"],["Gross OD(A)","1597"],["B. Basic - TP","14343"],["LL to Paid Driver IMT 28","100"],["Legal Liability to Passenger","30695"],["Gross TP(B)","45138"],["Premium(A+B)","46735"],["IGST(18%)","8412.30"],["TOTAL PAYABLE PREMIUM","55147.30"]]}], parsed('united_india_motor_v1')), {
  policy_product:'Package',idv:'1420250',od_premium:'1597',tp_premium:'14343',cpa_opted:'No',cpa_premium:'30795',total_premium:'46735',tax_amount:'8412.3',gross_premium:'55147.3'
});

run('UIIC 3W Liability', refineApprovedMotorPolicyLayout([
 'UNITED INDIA INSURANCE COMPANY LIMITED\nMOTOR INSURANCE - GCV PUBLIC CARRIERS MOTORIZED 3 WHEELERS AND MOTORIZED PEDAL CYCLES LIABILITY ONLY POLICY\nPolicy No. 2230003126P199999998\nEffective date of commencement of Insurance for the purpose of Act from 12:22 Hrs on 09/07/2026\nDate of Expiry of the Insurance Midnight on 08/07/2027\nCompulsory Personal Accident (CPA) cover is removed, since owner driver is not holding a valid driving license.'
], [{page:2,rows:[["Gross OD(A)","0.00"],["B. Basic - TP","4492"],["LL to Paid Driver IMT 28","50"],["Gross TP(B)","4542"],["Total Liability Premium","4542"],["IGST-Others(18%)","9"],["IGST-Basic TP(5%)","225"],["TOTAL PAYABLE PREMIUM","4776"]]}], parsed('united_india_motor_v1')), {
  policy_product:'Third Party',idv:'0',od_premium:'0',tp_premium:'4492',cpa_opted:'No',cpa_premium:'50',total_premium:'4542',tax_amount:'234',gross_premium:'4776'
});

run('National PCP Liability', refineApprovedMotorPolicyLayout([
 'National Insurance Co. Ltd.\nPolicy Schedule - Motor - Private Car - Liability Only\nPolicy Number: 360800312619999999\nPolicy Effective from 14:35 hours, on 30/05/2026 to midnight of 29/05/2027\nPremium ₹ 8,172.00\nIGST ₹ 1,471.00\nTotal Amount ₹ 9,643.00'
], [{page:2,rows:[["Own Damage Cover","NA"],["Legal Liability Cover","7897"],["Personal Accident","275"],["Total","8172"]]}], parsed('national_motor_v1')), {
  policy_product:'Third Party',idv:'0',od_premium:'0',tp_premium:'7897',cpa_opted:'Yes',cpa_premium:'275',total_premium:'8172',tax_amount:'1471',gross_premium:'9643'
});

run('National TWP Bundled', refineApprovedMotorPolicyLayout([
 'National Insurance Co. Ltd.\nPolicy Schedule-Motor - Two Wheelers - OD with LongTerm Act (MCY)\nPolicy Number: 361802312619999999\nLong Term Two Wheelers Bundled Policy\nPolicy Effective from 19:15 hours, on 23/07/2026 to midnight of 22/07/2027 (for Own Damage)\nPolicy Effective from 19:15 hours, on 23/07/2026 to midnight of 22/07/2031 (Liability to Third Parties)\nPremium ₹ 4,059.00\nIGST ₹ 731.00\nTotal Amount ₹ 4,790.00'
], [{page:2,rows:[["Vehicle IDV","61677"],["Own Damage Cover Premium","103.37"],["Legal Liability Cover","3851"],["Total","3851"]]}], parsed('national_motor_v1')), {
  policy_product:'Bundled',idv:'61677',od_premium:'208',tp_premium:'3851',cpa_opted:'No',cpa_premium:'0',total_premium:'4059',tax_amount:'731',gross_premium:'4790'
});

run('Digit PCP Package', refineApprovedMotorPolicyLayout([
 'Go Digit General Insurance Ltd.\nDigit Private Car Policy\nPolicy No: D999999999\nPeriod of Policy for Own Damage Cover From 01-Jun-2026 00:00:01 To 31-May-2027 23:59:59'
], [{page:2,rows:[["Total IDV","902850"],["Total OD Premium","9963.95"],["Basic Third-Party Liability","3416"],["PA cover for Owner-Driver","330"],["Legal Liability to Paid Driver","50"],["Total Act Premium","3796"],["Net Premium","13759.95"],["CGST @ 9%","1238.39"],["SGST/UTGST @ 9%","1238.39"],["Final Premium","16236.73"]]}], parsed('digit_commercial_motor_v1')), {
  policy_product:'Package',idv:'902850',od_premium:'9963.95',tp_premium:'3466',cpa_opted:'Yes',cpa_premium:'330',total_premium:'13759.95',tax_amount:'2476.78',gross_premium:'16236.73'
});

run('HDFC PCP Package', refineApprovedMotorPolicyLayout([
  'HDFC ERGO General Insurance Company Limited\nPRIVATE CAR PACKAGE POLICY\nPolicy No. 2302 9999 8888 0600 000\nPeriod of Insurance\nFrom 19 Jun, 2026 00:01 hrs\nTo 18 Jun, 2027 23:59\nNet Own Damage Premium (a) 9788\nNet Liability Premium (b) 3851\nPA Cover for Owner Driver of 1500000 325\nTotal Package Premium (a+b) 13639\nIntegrated Tax 18% 2455\nTotal Premium 16094',
], [{page:1,rows:[["Total IDV","300000"]]}], parsed('hdfc_ergo_motor_v1')), {
  policy_product:'Package',idv:'300000',od_premium:'9788',tp_premium:'3526',cpa_opted:'Yes',cpa_premium:'325',total_premium:'13639',tax_amount:'2455',gross_premium:'16094'
});

run('HDFC TWP SAOD', refineApprovedMotorPolicyLayout([
  'HDFC ERGO General Insurance Company Limited\nStandalone Motor Own Damage Cover - Two Wheeler\nPolicy No. 2301 9999 2337 0200 000\nPeriod of Insurance\nFrom 01 Jul, 2026 00:01 hrs\nTo 30 Jun, 2027 Midnight\nNet Own Damage Premium (a) 863\nGST 18% 155\nTotal Premium 1018\nActive TP Policy No: 6104601804',
], [{page:1,rows:[["Total IDV","70000"]]}], parsed('hdfc_ergo_motor_v1')), {
  policy_product:'SAOD',policy_number:'2301999923370200000',idv:'70000',od_premium:'863',tp_premium:'0',cpa_opted:'No',cpa_premium:'0',total_premium:'863',tax_amount:'155',gross_premium:'1018'
});

run('UIIC GCV Package with owner CPA removed', refineApprovedMotorPolicyLayout([
  'UNITED INDIA INSURANCE COMPANY LIMITED\nGCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY\nPOLICY NO.:SAFE/UI/009104\nPERIOD OF INSURANCE\nFrom 23:00 Hrs of 23/06/2026\nTo Midnight of 22/06/2027\nCompulsory Personal Accident (CPA) cover is removed, since owner driver is not holding a valid driving license.',
], [{page:4,rows:[["Total IDV","652425"],["Gross OD(A)","7027"],["B. Basic - TP","13642"],["LL to Paid Driver IMT 28","100"],["Liability to Workmen greater than 6","100"],["Gross TP(B)","13842"],["Premium (A+B)","20869"],["IGST-Others(18%)","1301"],["IGST-Basic TP(5%)","682"],["Total(Rounded Off)","22852"]]}], parsed('united_india_motor_v1')), {
  policy_product:'Package',idv:'652425',od_premium:'7027',tp_premium:'13642',cpa_opted:'No',cpa_premium:'200',total_premium:'20869',tax_amount:'1983',gross_premium:'22852'
});

run('New India SAOD', refineApprovedMotorPolicyLayout([
  'THE NEW INDIA ASSURANCE CO. LTD.\nStandalone Motor Own Damage Policy for Private car - Enhanced Covers\nPolicy Number :900000000000009105\nPeriod of cover 14/08/2026 12:00:01 AM to 13/08/2027 11:59:59 PM',
], [{page:1,rows:[["Total Value","1055000"],["Total OD Premium","12831"],["Net Premium","12831"],["GST in Rs","2310"],["Total Payable","15141"]]}], parsed('generic_motor_v1')), {
  policy_product:'SAOD',idv:'1055000',od_premium:'12831',tp_premium:'0',cpa_opted:'No',cpa_premium:'0',total_premium:'12831',tax_amount:'2310',gross_premium:'15141'
});

console.log('OCR 22-policy insurer/layout v5 refinement regression passed.');
