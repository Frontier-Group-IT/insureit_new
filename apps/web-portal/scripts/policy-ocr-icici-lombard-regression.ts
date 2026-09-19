import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineIciciLombardMotorPolicy } from "../lib/policy-ocr-icici-lombard-refiner.ts";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { parsePolicyDocument } from "../lib/policy-ocr-parsers.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";
import type { StructuredPolicyTable } from "../lib/policy-ocr-iffco-structured-refiner.ts";

function field(result: ParsedPolicyResult, key: string) {
  return result.fields.find((entry) => entry.key === key)?.value;
}

const pages = [
  `ICICI Lombard General Insurance Company Limited
Product Code: 3003 UIN: IRDAN115RP0013V01200203
Reference No.: TEST-REF-001
SYNTHETIC TRANSPORT COMPANY
Sub: Risk Assumption Letter
Please find enclosed Policy No. 3003/999999999/00/000
Insured & Vehicle Details
Name of the Insured
Period of Insurance
Vehicle Make / Model
RTO City
Vehicle Registration No.
Vehicle Registration Date
Engine No.
Chassis No.
Current Year NCB(%)
Vehicle Usage
SYNTHETIC TRANSPORT COMPANY
Oct 01, 2026 to Sep 30, 2027
ALPHAMOTORS / 7000 HAULER
MADHYA PRADESH-INDORE
MP20AB1234
Sep 30, 2024
EN12AB34567890
MA1TESTCHASSIS123
25%
GOODS TRANSPORTATION
Previous Policy Details
Previous Policy No.
106020/00/00/000000
The Compulsory Personal Accident cover has not been opted in this policy on account that, the vehicle to be insured is not owned by an individual.`,
  `CERTIFICATE OF INSURANCE CUM POLICY SCHEDULE
Goods Carrying Vehicles Package Policy
Name of the Insured : SYNTHETIC TRANSPORT COMPANY Policy No. : 3003/999999999/00/000
Period of Insurance : Oct 01, 2026 00:00 to Midnight of Sep 30, 2027
RTO Location : MADHYA PRADESH-INDORE
Vehicle Class : Public Carrier
Vehicle Registration No. Make Vehicle SubClass Model Model Build Type of Body GVW Mfg Yr Carrying Capacity Chassis No. Engine No. Trailer Chassis No.
MP20AB1234 ALPHAMO TORS TRAILERS 7000HAULER PARTIALLY BUILT Open 55000 2024 2 MA1TESTCHASSIS123 EN12AB34567890 0
Trailer Registration No. Body IDV (₹) Chassis IDV (₹) Trailer (₹) Electrical / Electronic Accessories (₹) Non Electrical Accessories (₹) CNG / LPG Unit (₹) Total IDV (₹)
10,00,000.00 35,67,890.00 0.00 0.00 0.00 0.00 45,67,890.00
Premium Details
OWN DAMAGE(A) (₹) LIABILITY(B) (₹)
Total Own Damage Premium(A) Total Liability Premium(B)
50,000.00 40,000.00
Total Package Premium (A+B) 90,000.00
Total Tax Payable in ₹ 15,000.00
Total Premium Payable in ₹ 1,05,000.00
Limits of Liability: PA Cover for Owner-Driver under Section III: CSI 0.00/-.`,
];

const tables: StructuredPolicyTable[] = [
  {
    page: 2,
    rows: [
      ["Vehicle Registration No.", "Make", "Vehicle SubClass", "Model", "Mfg Yr", "Chassis No.", "Engine No."],
      ["MP20AB1234", "ALPHAMO TORS", "TRAILERS", "7000HAULER", "2024", "CURRENTYEARNCB", "CHASSISNO"],
      ["Total Own Damage Premium(A)", "Total Liability Premium(B)"],
      ["50,000.00", "40,000.00"],
      ["Total Package Premium (A+B)", "90,000.00"],
      ["Total Tax Payable in ₹", "15,000.00"],
      ["Total Premium Payable in ₹", "1,05,000.00"],
    ],
  },
];

const contaminated: ParsedPolicyResult = {
  parserId: "icici_lombard_motor_v1",
  parserVersion: "icici_lombard_motor_v1.0.0",
  fields: [
    { key: "insurer_name", label: "Insurance company", value: "ICICI Lombard General Insurance Company Limited", confidence: .99, page: 1, evidence: "header" },
    { key: "vehicle_registration_status", label: "Registration status", value: "registration_pending", confidence: .9, page: 2, evidence: "bad generic inference" },
    { key: "vehicle_registration_number", label: "Registration number", value: "MP20AB1234", confidence: .8, page: 1, evidence: "unreviewed" },
    { key: "vehicle_engine_number", label: "Engine number", value: "CHASSISNO", confidence: .9, page: 1, evidence: "label contamination" },
    { key: "vehicle_chassis_number", label: "Chassis number", value: "CURRENTYEARNCB", confidence: .9, page: 1, evidence: "label contamination" },
    { key: "vehicle_make", label: "Vehicle make", value: "ALPHAMO TORS", confidence: .9, page: 2, evidence: "split cell" },
    { key: "vehicle_model", label: "Vehicle model", value: "7000HAULER", confidence: .9, page: 2, evidence: "collapsed cell" },
    { key: "vehicle_rto_name", label: "RTO name", value: "Hypothecated To", confidence: .9, page: 2, evidence: "adjacent heading contamination" },
    { key: "gross_premium", label: "Printed gross premium", value: "1", confidence: .9, page: 2, evidence: "Indian grouped amount misread" },
  ],
  warnings: [],
};

const baseRoute = parsePolicyDocument(pages);
assert.equal(baseRoute.parserId, "icici_lombard_motor_v1");
assert.equal(field(baseRoute, "insurer_name"), "ICICI Lombard General Insurance Company Limited");

const result = refineIciciLombardMotorPolicy(pages, tables, contaminated);

assert.equal(result.parserId, "icici_lombard_motor_v1");
assert.equal(result.parserVersion, "icici_lombard_motor_v1.6.0+gcv-live-replay-v7");
assert.equal(field(result, "policy_number"), "3003/999999999/00/000");
assert.equal(field(result, "insured_name"), "SYNTHETIC TRANSPORT COMPANY");
assert.equal(field(result, "policy_product"), "Package");
assert.equal(field(result, "policy_start_date"), "2026-10-01");
assert.equal(field(result, "policy_end_date"), "2027-09-30");
assert.equal(field(result, "vehicle_registration_status"), "registered");
assert.equal(field(result, "vehicle_registration_number"), "MP20AB1234");
assert.equal(field(result, "vehicle_class"), "GCV");
assert.equal(field(result, "vehicle_make"), "ALPHAMOTORS");
assert.equal(field(result, "vehicle_model"), "7000 HAULER");
assert.equal(field(result, "vehicle_manufacturing_year"), "2024");
assert.equal(field(result, "vehicle_capacity"), "55000");
assert.equal(field(result, "vehicle_chassis_number"), "MA1TESTCHASSIS123");
assert.equal(field(result, "vehicle_engine_number"), "EN12AB34567890");
assert.equal(field(result, "vehicle_rto_name"), "MADHYA PRADESH-INDORE");
assert.equal(field(result, "vehicle_rto_state"), "Madhya Pradesh");
assert.equal(field(result, "idv"), "4567890");
assert.equal(field(result, "od_premium"), "50000");
assert.equal(field(result, "tp_premium"), "40000");
assert.equal(field(result, "total_premium"), "90000");
assert.equal(field(result, "tax_amount"), "15000");
assert.equal(field(result, "gross_premium"), "105000");
assert.equal(field(result, "cpa_premium"), "0");
assert.equal(field(result, "cpa_opted"), "No");

const loosePageOne = pages[0]
  .replace("Insured & Vehicle Details", "INSURED & VEHICLE DETAILS :")
  .replace("Engine No.\nChassis No.\nCurrent Year NCB(%)\nVehicle Usage", "Engine No. / Chassis No. / Current Year NCB(%) / Vehicle Usage");
const loose = refineIciciLombardMotorPolicy(
  [loosePageOne, pages[1]],
  tables,
  contaminated,
);
assert.equal(field(loose, "vehicle_registration_status"), "registered");
assert.equal(field(loose, "vehicle_registration_number"), "MP20AB1234");
assert.equal(field(loose, "vehicle_engine_number"), "EN12AB34567890");
assert.equal(field(loose, "vehicle_chassis_number"), "MA1TESTCHASSIS123");
assert.equal(field(loose, "vehicle_rto_name"), "MADHYA PRADESH-INDORE");

const pageOneWithoutVehicleIds = pages[0]
  .replace("MADHYA PRADESH-INDORE\nMP20AB1234\nSep 30, 2024\nEN12AB34567890\nMA1TESTCHASSIS123",
           "MP20AB1234\nSep 30, 2024")
  .replace("Engine No.\nChassis No.\nCurrent Year NCB(%)\nVehicle Usage",
           "Engine / Chassis / NCB / Vehicle Usage");
const scheduleFallback = refineIciciLombardMotorPolicy(
  [pageOneWithoutVehicleIds, pages[1]],
  tables,
  contaminated,
);
assert.equal(field(scheduleFallback, "vehicle_registration_status"), "registered");
assert.equal(field(scheduleFallback, "vehicle_registration_number"), "MP20AB1234");
assert.equal(field(scheduleFallback, "vehicle_chassis_number"), "MA1TESTCHASSIS123");
assert.equal(field(scheduleFallback, "vehicle_engine_number"), "EN12AB34567890");
assert.equal(field(scheduleFallback, "vehicle_rto_name"), "MADHYA PRADESH-INDORE");

const multilineSchedulePage = pages[1]
  .replace(
    "RTO Location : MADHYA PRADESH-INDORE",
    "RTO Location\nMADHYA PRADESH-INDORE",
  )
  .replace(
    "Vehicle Class : Public Carrier",
    "Vehicle Class\nPublic Carrier",
  )
  .replace(
    "MP20AB1234 ALPHAMO TORS TRAILERS 7000HAULER PARTIALLY BUILT Open 55000 2024 2 MA1TESTCHASSIS123 EN12AB34567890 0",
    "MP20AB1234 ALPHAMO TORS TRAILERS 7000HAULER PARTIALLY BUILT Open 55000\n2024 2\nMA1TESTCHASSIS123\nEN12AB34567890\n0",
  );
const multilineSchedule = refineIciciLombardMotorPolicy(
  [pageOneWithoutVehicleIds, multilineSchedulePage],
  tables,
  contaminated,
);
assert.equal(field(multilineSchedule, "vehicle_class"), "GCV");
assert.equal(field(multilineSchedule, "vehicle_capacity"), "55000");
assert.equal(field(multilineSchedule, "vehicle_chassis_number"), "MA1TESTCHASSIS123");
assert.equal(field(multilineSchedule, "vehicle_engine_number"), "EN12AB34567890");
assert.equal(field(multilineSchedule, "vehicle_rto_name"), "MADHYA PRADESH-INDORE");
assert.equal(field(multilineSchedule, "vehicle_rto_state"), "Madhya Pradesh");

const unsafe = refineIciciLombardMotorPolicy(
  [pages[0], pages[1].replace("40,000.00", "35,000.00")],
  tables.map((table) => ({
    ...table,
    rows: table.rows.map((row) => row.map((cell) => cell === "40,000.00" ? "35,000.00" : cell)),
  })),
  contaminated,
);
assert.equal(field(unsafe, "od_premium"), undefined);
assert.equal(field(unsafe, "tp_premium"), undefined);
assert.match(unsafe.warnings.join(" "), /did not reconcile/i);

const unrelated: ParsedPolicyResult = {
  parserId: "generic_motor_v1",
  parserVersion: "generic_motor_v1.0.0",
  fields: [],
  warnings: [],
};
assert.deepEqual(
  refineIciciLombardMotorPolicy(["SOME OTHER INSURER\nGoods Carrying Vehicles Package Policy"], [], unrelated),
  unrelated,
);

console.log("ICICI Lombard GCV OCR regression passed.");
