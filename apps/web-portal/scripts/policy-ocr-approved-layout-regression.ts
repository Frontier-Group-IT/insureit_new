// @ts-expect-error -- This regression runner executes TypeScript directly with Node --experimental-strip-types.
import { refineAdditionalMotorPolicy } from "../lib/policy-ocr-additional-motor-refiner.ts";
// @ts-expect-error -- Runtime import uses the explicit .ts suffix for Node's strip-types runner.
import { refineApprovedMotorPolicyLayout } from "../lib/policy-ocr-approved-layout-refiner.ts";
// @ts-expect-error -- Runtime import uses the explicit .ts suffix for Node's strip-types runner.
import { refineNewIndiaCommercialPolicy } from "../lib/policy-ocr-new-india-refiner.ts";
// @ts-expect-error -- Runtime import uses the explicit .ts suffix for Node's strip-types runner.
import { refineNewIndiaStructuredPolicy } from "../lib/policy-ocr-new-india-structured-refiner.ts";
// @ts-expect-error -- Runtime import uses the explicit .ts suffix for Node's strip-types runner.
import { parsePolicyDocument } from "../lib/policy-ocr-parsers.ts";
// @ts-expect-error -- Runtime import uses the explicit .ts suffix for Node's strip-types runner.
import { buildTrainingProposal, compareTrainingProposalToReference, type TrainingDatabaseReference } from "../lib/policy-ocr-training.ts";
import type { StructuredPolicyTable } from "../lib/policy-ocr-iffco-structured-refiner.ts";

type Case = {
  name: string;
  parserId: string;
  pages: string[];
  tables: StructuredPolicyTable[];
  reference: TrainingDatabaseReference;
};

const baseVehicle = {
  vehicle_registration_number: null,
  vehicle_rto_name: null,
  vehicle_rto_state: null,
} as const;

const cases: Case[] = [
  {
    name: "United India new goods carrier package",
    parserId: "united_india_motor_v1",
    pages: ["UNITED INDIA INSURANCE COMPANY LIMITED\nGOODS CARRYING VEHICLE PACKAGE POLICY\nPolicy No: SAFE/UI/000001\nPeriod of Insurance From 02/07/2026 To 01/07/2027"],
    tables: [{ page: 2, rows: [
      ["Registration No", "NEW-SAFE01"], ["Engine No", "ENGSAFE0001"], ["Chassis No", "CHSSAFE0001"],
      ["Make", "Tata Motors India Ltd"], ["Model", "ACE GOLD"], ["Fuel", "PETROL"], ["Year", "2026"], ["GVW", "1615"], ["Registration Authority", "MP20 Jabalpur"],
      ["Total IDV", "472269"], ["Gross OD (A)", "2930"], ["Basic TP Premium", "16049"], ["Compulsory PA for Owner Driver", "275"], ["LL to Paid Driver IMT 28", "100"], ["Gross TP (B)", "16424"],
      ["Premium (A + B)", "19354"], ["CGST", "595"], ["SGST", "802.35"], ["Total Payable Premium", "20751.35"],
    ] }],
    reference: reference({ vehicle_registration_status: "registration_pending", vehicle_class: "GCV", vehicle_make: "Tata", vehicle_model: "ACE GOLD", vehicle_fuel_type: "Petrol", vehicle_manufacturing_year: 2026, vehicle_capacity: 1615, vehicle_chassis_number: "CHSSAFE0001", vehicle_engine_number: "ENGSAFE0001", vehicle_rto_name: "MP20", vehicle_rto_state: "Madhya Pradesh", insurer_name: "United India Insurance Company Limited", policy_product: "Package", policy_number: "SAFE/UI/000001", valid_from: "2026-07-02", valid_upto: "2027-07-01", idv: 472269, od_premium: 2930, tp_premium: 16049, cpa_opted: true, cpa_premium: 375, printed_net_premium: 19354, printed_gst: 1397.35, printed_gross_premium: 20751.35 }),
  },
  {
    name: "HDFC ERGO two-wheeler liability",
    parserId: "hdfc_ergo_motor_v1",
    pages: ["HDFC ERGO GENERAL INSURANCE COMPANY LIMITED\nTWO WHEELER LIABILITY ONLY POLICY\nPolicy No: SAFE/HDFC/000002\nPeriod of Insurance From 03/07/2026 To 02/07/2027"],
    tables: [{ page: 1, rows: [
      ["Registration Number", "DL08SAFE0002"], ["Engine Number", "ENGSAFE0002"], ["Chassis Number", "CHSSAFE0002"],
      ["Make", "BMW"], ["Model-Variant", "F750 GS STANDARD"], ["Fuel Type", "PETROL"], ["Year of Manufacture", "2020"], ["Cubic Capacity CC", "853"], ["RTO", "Delhi"],
      ["Total IDV", "0"], ["Basic TP Premium", "2804"], ["Total Liability Premium", "2804"], ["Net Premium", "2804"], ["Total GST", "504.72"], ["Total Amount Payable", "3308.72"],
    ] }],
    reference: reference({ vehicle_registration_status: "registered", vehicle_registration_number: "DL8SAFE0002", vehicle_class: "TWP", vehicle_make: "BMW", vehicle_model: "F750 GS STANDARD", vehicle_fuel_type: "Petrol", vehicle_manufacturing_year: 2020, vehicle_capacity: 853, vehicle_chassis_number: "CHSSAFE0002", vehicle_engine_number: "ENGSAFE0002", vehicle_rto_name: "DL8", vehicle_rto_state: "Delhi", insurer_name: "HDFC ERGO General Insurance Company Limited", policy_product: "Third Party", policy_number: "SAFE/HDFC/000002", valid_from: "2026-07-03", valid_upto: "2027-07-02", idv: 0, od_premium: 0, tp_premium: 2804, cpa_opted: false, cpa_premium: 0, printed_net_premium: 2804, printed_gst: 504.72, printed_gross_premium: 3308.72 }),
  },
  {
    name: "New India private-car standalone OD",
    parserId: "new_india_motor_v1",
    pages: ["THE NEW INDIA ASSURANCE CO. LTD.\nPRIVATE CAR STANDALONE OWN DAMAGE POLICY\nPolicy No: 900000000000000003\nOwn Damage Period: 04/07/2026 To 03/07/2027"],
    tables: [{ page: 1, rows: [
      ["Registration No", "MP20SAFE0003"], ["Engine No", "ENGSAFE0003"], ["Chassis No", "CHSSAFE0003"], ["Make", "TATA"], ["Model", "NEXON"],
      ["Fuel", "DIESEL"], ["Year", "2024"], ["CC", "1498"], ["Registration Authority", "MP20 Jabalpur"], ["Total IDV", "1055000"],
      ["Total OD Premium", "12831"], ["Net Premium", "12831"], ["GST", "2309.58"], ["Total Payable", "15140.58"],
    ] }],
    reference: reference({ vehicle_registration_status: "registered", vehicle_registration_number: "MP20SAFE0003", vehicle_class: "PCP", vehicle_make: "Tata", vehicle_model: "NEXON", vehicle_fuel_type: "Diesel", vehicle_manufacturing_year: 2024, vehicle_capacity: 1498, vehicle_chassis_number: "CHSSAFE0003", vehicle_engine_number: "ENGSAFE0003", vehicle_rto_name: "MP20", vehicle_rto_state: "Madhya Pradesh", insurer_name: "The New India Assurance Company Limited", policy_product: "SAOD", policy_number: "900000000000000003", valid_from: "2026-07-04", valid_upto: "2027-07-03", idv: 1055000, od_premium: 12831, tp_premium: 0, cpa_opted: false, cpa_premium: 0, printed_net_premium: 12831, printed_gst: 2309.58, printed_gross_premium: 15140.58 }),
  },
  {
    name: "National new goods carrier package",
    parserId: "national_motor_v1",
    pages: ["NATIONAL INSURANCE COMPANY LIMITED\nGOODS CARRYING VEHICLE PACKAGE POLICY\nPolicy No: SAFE/NIC/000004\nPolicy Effective from 00:01 on 05/07/2026 to midnight of 04/07/2027"],
    tables: [{ page: 1, rows: [
      ["Registration No", "NEW-SAFE04"], ["Engine No", "ENGSAFE0004"], ["Chassis No", "CHSSAFE0004"], ["Make", "Tata Motors India Ltd"], ["Model", "1916 LPT"],
      ["Fuel", "DIESEL"], ["Year", "2026"], ["GVW", "18500"], ["Registration Authority", "Jabalpur"], ["Total IDV", "3240450"],
      ["Total Own Damage Premium", "17575"], ["Basic Liability Premium", "35313"], ["Legal Liability to Driver Cleaner Coolies", "100"], ["Total Liability Premium", "35413"], ["Net Premium", "52988"], ["IGST", "4947.15"], ["Gross Premium", "57935.15"],
    ] }],
    reference: reference({ vehicle_registration_status: "registration_pending", vehicle_class: "GCV", vehicle_make: "Tata", vehicle_model: "1916 LPT", vehicle_fuel_type: "Diesel", vehicle_manufacturing_year: 2026, vehicle_capacity: 18500, vehicle_chassis_number: "CHSSAFE0004", vehicle_engine_number: "ENGSAFE0004", vehicle_rto_name: "MP20", vehicle_rto_state: "Madhya Pradesh", insurer_name: "National Insurance Company Limited", policy_product: "Package", policy_number: "SAFE/NIC/000004", valid_from: "2026-07-05", valid_upto: "2027-07-04", idv: 3240450, od_premium: 17575, tp_premium: 35313, cpa_opted: null, cpa_premium: 100, printed_net_premium: 52988, printed_gst: 4947.15, printed_gross_premium: 57935.15 }),
  },
  {
    name: "United India second new goods carrier",
    parserId: "united_india_motor_v1",
    pages: ["UNITED INDIA INSURANCE COMPANY LIMITED\nGOODS CARRYING VEHICLE PACKAGE POLICY\nPolicy No: SAFE/UI/000005\nPeriod of Insurance From 06/07/2026 To 05/07/2027"],
    tables: [{ page: 1, rows: [
      ["Registration No", "NEW-SAFE05"], ["Engine No", "ENGSAFE0005"], ["Chassis No", "CHSSAFE0005"], ["Make", "Tata Motors"], ["Model", "ACE GOLD + DIESEL"],
      ["Fuel", "DIESEL"], ["Year", "2026"], ["GVW", "1815"], ["Registration Authority", "MP51 Mandla"], ["Total IDV", "610000"],
      ["Gross OD (A)", "4753"], ["Basic TP Premium", "16049"], ["Compulsory PA for Owner Driver", "275"], ["LL to Paid Driver IMT 28", "100"], ["Liability to Workmen greater than 6", "100"], ["Gross TP (B)", "16524"], ["Premium (A + B)", "21277"], ["Total GST", "1743.49"], ["Total Payable Premium", "23020.49"],
    ] }],
    reference: reference({ vehicle_registration_status: "registration_pending", vehicle_class: "GCV", vehicle_make: "Tata", vehicle_model: "ACE GOLD + DIESEL", vehicle_fuel_type: "Diesel", vehicle_manufacturing_year: 2026, vehicle_capacity: 1815, vehicle_chassis_number: "CHSSAFE0005", vehicle_engine_number: "ENGSAFE0005", vehicle_rto_name: "MP51", vehicle_rto_state: "Madhya Pradesh", insurer_name: "United India Insurance Company Limited", policy_product: "Package", policy_number: "SAFE/UI/000005", valid_from: "2026-07-06", valid_upto: "2027-07-05", idv: 610000, od_premium: 4753, tp_premium: 16049, cpa_opted: true, cpa_premium: 475, printed_net_premium: 21277, printed_gst: 1743.49, printed_gross_premium: 23020.49 }),
  },
  {
    name: "Royal Sundaram private-car liability",
    parserId: "royal_sundaram_motor_v1",
    pages: ["ROYAL SUNDARAM GENERAL INSURANCE CO. LIMITED\nPRIVATE CAR LIABILITY ONLY POLICY\nPolicy No: SAFE/RS/000006\nPeriod of Insurance From 07/07/2026 To 06/07/2027"],
    tables: [{ page: 2, rows: [
      ["Registration No", "HR29SAFE0006"], ["Engine No", "ENGSAFE0006"], ["Chassis No", "CHSSAFE0006"], ["Make", "KIA"], ["Model", "SONET HTX 1.5 AT"],
      ["Fuel", "DIESEL"], ["Year", "2022"], ["CC", "1493"], ["Registration Authority", "HR29 Ballabgarh"], ["Total IDV", "0"],
      ["Basic Liability Premium", "3416"], ["Paid Driver IMT 28", "50"], ["P.A. Cover for Owner Driver", "0"], ["Total Liability Premium", "3466"], ["Net Premium", "3466"], ["IGST", "623.88"], ["Total Amount Payable", "4089.88"],
    ] }],
    reference: reference({ vehicle_registration_status: "registered", vehicle_registration_number: "HR29SAFE0006", vehicle_class: "PCP", vehicle_make: "Kia", vehicle_model: "SONET HTX 1.5 AT", vehicle_fuel_type: "Diesel", vehicle_manufacturing_year: 2022, vehicle_capacity: 1493, vehicle_chassis_number: "CHSSAFE0006", vehicle_engine_number: "ENGSAFE0006", vehicle_rto_name: "HR29", vehicle_rto_state: "Haryana", insurer_name: "Royal Sundaram General Insurance Co. Limited", policy_product: "Third Party", policy_number: "SAFE/RS/000006", valid_from: "2026-07-07", valid_upto: "2027-07-06", idv: 0, od_premium: 0, tp_premium: 3416, cpa_opted: false, cpa_premium: 50, printed_net_premium: 3466, printed_gst: 623.88, printed_gross_premium: 4089.88 }),
  },
];

let failures = 0;
for (const testCase of cases) {
  const base = parsePolicyDocument(testCase.pages);
  let parsed = base.parserId === "new_india_motor_v1"
    ? refineNewIndiaCommercialPolicy(testCase.pages, base)
    : refineAdditionalMotorPolicy(testCase.pages, base);
  if (base.parserId === "new_india_motor_v1") parsed = refineNewIndiaStructuredPolicy(testCase.tables, parsed);
  parsed = refineApprovedMotorPolicyLayout(testCase.pages, testCase.tables, parsed);
  const comparison = compareTrainingProposalToReference(buildTrainingProposal({ ok: true, fields: parsed.fields, warnings: parsed.warnings }), testCase.reference);
  if (parsed.parserId !== testCase.parserId || !comparison.exactMatch) {
    failures += 1;
    const failedFields = Object.entries(comparison.fields).filter(([, status]) => status !== "match" && status !== "reference_missing");
    const relevant = Object.fromEntries(parsed.fields.filter((field) => ["od_premium", "tp_premium", "cpa_premium", "cpa_opted", "total_premium"].includes(field.key)).map((field) => [field.key, field.value]));
    console.error(`${testCase.name}: parser=${parsed.parserId}; failed=${JSON.stringify(failedFields)}; financials=${JSON.stringify(relevant)}`);
  } else {
    console.log(`${testCase.name}: ${comparison.matchedFields}/${comparison.comparableFields} fields matched`);
  }
}

if (failures) throw new Error(`${failures} approved-layout regression case(s) failed.`);
console.log("Approved-layout OCR regression passed for all six sanitized policy shapes.");

function reference(values: Partial<TrainingDatabaseReference>): TrainingDatabaseReference {
  return {
    ...baseVehicle,
    vehicle_registration_status: null,
    vehicle_class: null,
    vehicle_make: null,
    vehicle_model: null,
    vehicle_fuel_type: null,
    vehicle_manufacturing_year: null,
    vehicle_capacity: null,
    vehicle_chassis_number: null,
    vehicle_engine_number: null,
    insurer_name: null,
    policy_product: null,
    policy_number: null,
    valid_from: null,
    valid_upto: null,
    idv: null,
    od_premium: null,
    tp_premium: null,
    cpa_opted: null,
    cpa_premium: null,
    printed_net_premium: null,
    printed_gst: null,
    printed_gross_premium: null,
    ...values,
  };
}
