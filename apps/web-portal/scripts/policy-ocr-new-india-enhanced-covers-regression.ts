import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { parsePolicyDocument } from "../lib/policy-ocr-parsers.ts";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineNewIndiaCommercialPolicy } from "../lib/policy-ocr-new-india-refiner.ts";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineNewIndiaStructuredPolicy } from "../lib/policy-ocr-new-india-structured-refiner.ts";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineNewIndiaEnhancedCoversPolicy } from "../lib/policy-ocr-new-india-enhanced-covers-refiner.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";
import type { StructuredPolicyTable } from "../lib/policy-ocr-iffco-structured-refiner.ts";

function field(result: ParsedPolicyResult, key: string) {
  return result.fields.find((entry) => entry.key === key)?.value;
}

function run(pages: string[], tables: StructuredPolicyTable[] = []) {
  const base = parsePolicyDocument(pages);
  assert.equal(base.parserId, "new_india_motor_v1");
  const text = refineNewIndiaCommercialPolicy(pages, base);
  const structured = refineNewIndiaStructuredPolicy(tables, text);
  return refineNewIndiaEnhancedCoversPolicy(pages, tables, structured);
}

const trainedPages = [
  `THE NEW INDIA ASSURANCE CO. LTD.
POLICY SCHEDULE CUM CERTIFICATE OF INSURANCE
Commercial Vehicle Package Policy - Enhanced Covers
UIN Number - IRDAN190RP0044V01100001
Policy Number :31280031260300009999
POLICY DETAILS
Period of cover 12/09/2026 04:35:13 PM to 11/09/2027 11:59:59 PM
VEHICLE DETAILS
Geographical Area / Zone: India/C Year of manufacture: 2026
Type of Commercial Vehicles: A - Goods Carrying Sub Type: Other than 3 wheeler - Public Carrier
Chassis no./Engine no.: ZXCVBNM1234567/ENG 55 TEST 998877
Type of fuel: Diesel Cubic capacity(cc)/Wattage(kW): 0cc
Type of body: Open Gross Vehicle Weight (GVW): 55000
Make/Model: SYNTH TRUCKS/5532 Registration no. RJ-45
Seating capacity including Driver: 3 Variant: 5532T 4X2
Name of registration authority: RAJASTHAN
INSURED DECLARED VALUE (Rs)
Vehicle Trailer Non-Elec Acc Electrical Acc Bi-fuel/CNG/LPG kit Total Value
5558450 0 0 0 0 5558450`,
  `THE NEW INDIA ASSURANCE CO. LTD.
SCHEDULE OF PREMIUM
Own Damage Liability
Basic OD Premium 14391
Basic TP Premium 44242
(+)Compulsory PA Premium for Owner Driver(Sum Insured Rs 1500000) 275
(+)LL to paid driver conductor cleaner employed for oprn 150
Calculated OD Premium 41397 Calculated TP Premium 44667
Total OD Premium (Rs) 41397 Total TP Premium (Rs) 44667
Net Premium (Rs) 86,064
GST (Rs) 9,740
Total Payable (Rs) 95,804`,
];

const trainedTables: StructuredPolicyTable[] = [
  {
    page: 1,
    rows: [
      ["Year of manufacture", "2026", "Type of Commercial Vehicles", "A - Goods Carrying"],
      ["Sub Type", "Other than 3 wheeler - Public Carrier", "Chassis no./Engine no.", "ZXCVBNM1234567/ENG55TEST998877"],
      ["Type of fuel", "Diesel", "Gross Vehicle Weight (GVW)", "55000"],
      ["Make/Model", "SYNTH TRUCKS/5532", "Registration no.", "RJ-45"],
      ["Name of registration authority", "RAJASTHAN"],
      ["INSURED DECLARED VALUE (Rs)"],
      ["Vehicle", "Trailer", "Non-Elec Acc", "Electrical Acc", "Bi-fuel/CNG/LPG kit", "Total Value"],
      ["5558450", "0", "0", "0", "0", "5558450"],
    ],
  },
  {
    page: 2,
    rows: [
      ["Total OD Premium (Rs)", "41397", "Total TP Premium (Rs)", "44667"],
      ["Net Premium (Rs)", "86064"],
      ["GST (Rs)", "9740"],
      ["Total Payable (Rs)", "95804"],
    ],
  },
];

const trained = run(trainedPages, trainedTables);
assert.equal(field(trained, "vehicle_make"), "SYNTH TRUCKS");
assert.equal(field(trained, "vehicle_model"), "5532");
assert.equal(field(trained, "vehicle_manufacturing_year"), "2026");
assert.equal(field(trained, "vehicle_class"), "GCV");
assert.equal(field(trained, "vehicle_capacity"), "55000");
assert.equal(field(trained, "vehicle_chassis_number"), "ZXCVBNM1234567");
assert.equal(field(trained, "vehicle_engine_number"), "ENG55TEST998877");
assert.equal(field(trained, "vehicle_fuel_type"), "Diesel");
assert.equal(field(trained, "vehicle_rto_state"), "Rajasthan");
assert.equal(field(trained, "vehicle_registration_number"), undefined, "short RJ-45 evidence must not become a complete registration number");
assert.equal(field(trained, "od_premium"), "41397");
assert.equal(field(trained, "tp_premium"), "44667", "Enhanced Covers TP must remain the printed Total TP including CPA");
assert.equal(field(trained, "cpa_premium"), "275");
assert.equal(field(trained, "total_premium"), "86064");
assert.match(trained.parserVersion, /new-india-enhanced-covers-v1/);

const freshSiblingPages = [
  `THE NEW INDIA ASSURANCE CO. LTD.
Commercial Vehicle Package Policy - Enhanced Covers
UIN Number - IRDAN190RP0044V01100001
Policy Number :31280031260300008888
Period of cover 03/10/2026 10:00:00 AM to 02/10/2027 11:59:59 PM
VEHICLE DETAILS
Year of manufacture: 2025
Type of Commercial Vehicles: A - Goods Carrying
Sub Type: Other than 3 wheeler - Public Carrier
Chassis no./Engine no.: QWERTY123456789/AB12CD34567890
Type of fuel: CNG
Gross Vehicle Weight (GVW): 16200
Make/Model: ALPHA MOTORS/ROADMASTER 1618
Registration no.: MP-20
Name of registration authority: MADHYA PRADESH
INSURED DECLARED VALUE (Rs)
Vehicle Trailer Non-Elec Acc Electrical Acc Bi-fuel/CNG/LPG kit Total Value
2500000 0 0 0 0 2500000`,
  `SCHEDULE OF PREMIUM
Compulsory PA Premium for Owner Driver 275
Total OD Premium (Rs) 12000 Total TP Premium (Rs) 28000
Net Premium (Rs) 40000
GST (Rs) 5000
Total Payable (Rs) 45000`,
];
const sibling = run(freshSiblingPages);
assert.equal(field(sibling, "vehicle_make"), "ALPHA MOTORS");
assert.equal(field(sibling, "vehicle_model"), "ROADMASTER 1618");
assert.equal(field(sibling, "vehicle_chassis_number"), "QWERTY123456789");
assert.equal(field(sibling, "vehicle_engine_number"), "AB12CD34567890");
assert.equal(field(sibling, "vehicle_class"), "GCV");
assert.equal(field(sibling, "vehicle_capacity"), "16200");
assert.equal(field(sibling, "vehicle_rto_state"), "Madhya Pradesh");
assert.equal(field(sibling, "vehicle_registration_number"), undefined);
assert.equal(field(sibling, "od_premium"), "12000");
assert.equal(field(sibling, "tp_premium"), "28000");
assert.equal(field(sibling, "cpa_premium"), "275");

const unsafePages = [
  trainedPages[0],
  trainedPages[1].replace("Total TP Premium (Rs) 44667", "Total TP Premium (Rs) 44000"),
];
const unsafe = run(unsafePages, trainedTables.filter((table) => table.page !== 2));
assert.equal(field(unsafe, "tp_premium"), undefined, "non-reconciling printed TP must be withheld");
assert.match(unsafe.warnings.join(" "), /OD \+ printed Total TP did not reconcile/i);

const unrelatedPages = [
  `THE NEW INDIA ASSURANCE CO. LTD.
GOODS CARRYING VEHICLE PACKAGE POLICY-CERTIFICATE CUM POLICY SCHEDULE CUM RECEIPT
Policy No. 80000031250350127994`,
  `Net Own Damage Premium (A) 33984
Net Liability Premium (B) 44495
PA Cover For Owner Driver Of Rs. 1500000 325
Total Premium (A+B) 78479`,
];
const unrelatedBase = parsePolicyDocument(unrelatedPages);
const unrelatedText = refineNewIndiaCommercialPolicy(unrelatedPages, unrelatedBase);
const unrelatedAfter = refineNewIndiaEnhancedCoversPolicy(unrelatedPages, [], unrelatedText);
assert.deepEqual(unrelatedAfter, unrelatedText, "non-Enhanced-Covers New India layouts must stay untouched");

console.log("New India Enhanced Covers targeted regression passed.");
