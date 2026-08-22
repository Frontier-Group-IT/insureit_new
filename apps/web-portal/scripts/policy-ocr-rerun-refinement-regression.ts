import assert from "node:assert/strict";
// @ts-expect-error -- This regression runner executes TypeScript directly with Node --experimental-strip-types.
import { refineApprovedMotorPolicyLayout } from "../lib/policy-ocr-approved-layout-refiner.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";
import type { StructuredPolicyTable } from "../lib/policy-ocr-iffco-structured-refiner.ts";

function parsed(parserId: string, parserVersion: string, fields: ParsedPolicyResult["fields"] = []): ParsedPolicyResult {
  return { parserId, parserVersion, fields, warnings: [] };
}

function values(result: ParsedPolicyResult) {
  return Object.fromEntries(result.fields.map((field) => [field.key, field.value]));
}

const newIndiaTables: StructuredPolicyTable[] = [{ page: 1, rows: [
  ["Registration No", "MP20SAFE9001"],
  ["Engine No", "SYNENGINE9001"],
  ["Chassis No", "SYNCHASSIS9001"],
  ["Make / Model", "TATA / NEXON"],
  ["Fuel", "DIESEL"],
  ["Year", "2024"],
  ["CC", "1498"],
  ["Vehicle IDV", "1006900"],
  ["Non Electrical Accessories", "48100"],
  ["Total OD Premium", "12831", "NCB", "25"],
  ["Net Premium", "12831"],
  ["GST", "2309.58"],
  ["Total Payable", "15140.58"],
] }];
const newIndia = refineApprovedMotorPolicyLayout(
  ["NEW INDIA ASSURANCE CO. LTD.\nPRIVATE CAR STANDALONE OWN DAMAGE POLICY\nPolicy No: 900000000000009001\nOwn Damage Period: 14/08/2026 To 13/08/2027"],
  newIndiaTables,
  parsed("generic_motor_v1", "generic_motor_v1.2.0", [
    { key: "idv", label: "IDV", value: "1006900", confidence: .9, page: 1, evidence: "component IDV" },
    { key: "od_premium", label: "OD", value: "25", confidence: .9, page: 1, evidence: "NCB" },
    { key: "tax_amount", label: "GST", value: "7437", confidence: .9, page: 1, evidence: "wrong table association" },
    { key: "vehicle_capacity", label: "Capacity", value: "48100", confidence: .9, page: 1, evidence: "accessory value" },
    { key: "policy_product", label: "Product", value: "Bundled", confidence: .8, page: 1, evidence: "wrong product" },
  ]),
);
const newIndiaValues = values(newIndia);
assert.equal(newIndia.parserId, "new_india_motor_v1");
assert.equal(newIndiaValues.policy_product, "SAOD");
assert.equal(newIndiaValues.policy_number, "900000000000009001");
assert.equal(newIndiaValues.policy_start_date, "2026-08-14");
assert.equal(newIndiaValues.policy_end_date, "2027-08-13");
assert.equal(newIndiaValues.idv, "1055000");
assert.equal(newIndiaValues.od_premium, "12831");
assert.equal(newIndiaValues.tp_premium, "0");
assert.equal(newIndiaValues.cpa_opted, "No");
assert.equal(newIndiaValues.cpa_premium, "0");
assert.equal(newIndiaValues.total_premium, "12831");
assert.equal(newIndiaValues.tax_amount, "2309.58");
assert.equal(newIndiaValues.gross_premium, "15140.58");
assert.equal(newIndiaValues.vehicle_capacity, "1498");

const hdfc = refineApprovedMotorPolicyLayout(
  ["HDFC ERGO GENERAL INSURANCE COMPANY LIMITED\nTWO WHEELER LIABILITY ONLY POLICY"],
  [{ page: 1, rows: [
    ["Registration Number", "DL08SAFE9002"], ["Make", "BMW"], ["Model-Variant", "F750 GS STANDARD"], ["CC", "853"],
    ["Basic TP Premium", "2804"], ["CGST", "252.36"], ["SGST", "252.36"], ["Total Amount Payable", "3308.72"],
  ] }],
  parsed("hdfc_ergo_motor_v1", "hdfc_ergo_motor_v1.1.0", [
    { key: "total_premium", label: "Net", value: "3308.72", confidence: .9, page: 1, evidence: "gross misread as net" },
    { key: "tax_amount", label: "GST", value: "252.36", confidence: .9, page: 1, evidence: "one GST half" },
  ]),
);
const hdfcValues = values(hdfc);
assert.equal(hdfcValues.idv, "0");
assert.equal(hdfcValues.od_premium, "0");
assert.equal(hdfcValues.tp_premium, "2804");
assert.equal(hdfcValues.cpa_opted, "No");
assert.equal(hdfcValues.cpa_premium, "0");
assert.equal(hdfcValues.total_premium, "2804");
assert.equal(hdfcValues.tax_amount, "504.72");
assert.equal(hdfcValues.gross_premium, "3308.72");

const royal = refineApprovedMotorPolicyLayout(
  ["ROYAL SUNDARAM GENERAL INSURANCE CO. LIMITED\nPRIVATE CAR LIABILITY ONLY POLICY"],
  [{ page: 2, rows: [
    ["Registration No", "HR29SAFE9003"], ["Make", "KIA"], ["Model", "SONET HTX"], ["CC", "1493"],
    ["Basic Liability Premium", "3416"], ["Paid Driver IMT 28", "50"], ["P.A. Cover for Owner Driver", "0"],
    ["IGST", "623.88"], ["Total Amount Payable", "4089.88"],
  ] }],
  parsed("royal_sundaram_motor_v1", "royal_sundaram_motor_v1.1.0", [
    { key: "idv", label: "IDV", value: "595493", confidence: .9, page: 2, evidence: "engine fragment" },
    { key: "total_premium", label: "Net", value: "4089.88", confidence: .9, page: 2, evidence: "gross misread as net" },
  ]),
);
const royalValues = values(royal);
assert.equal(royalValues.idv, "0");
assert.equal(royalValues.od_premium, "0");
assert.equal(royalValues.tp_premium, "3416");
assert.equal(royalValues.cpa_opted, "No");
assert.equal(royalValues.cpa_premium, "50");
assert.equal(royalValues.total_premium, "3466");
assert.equal(royalValues.tax_amount, "623.88");
assert.equal(royalValues.gross_premium, "4089.88");

const national = refineApprovedMotorPolicyLayout(
  ["NATIONAL INSURANCE COMPANY LIMITED\nGOODS CARRYING VEHICLE PACKAGE POLICY"],
  [{ page: 1, rows: [
    ["Registration No", "NEW-SAFE9004"], ["Make", "Tata Motors"], ["Model", "1916 LPT"], ["GVW", "18500"],
    ["Total IDV", "3240450"], ["Total Own Damage Premium", "17575"], ["Basic Liability Premium", "35313"],
    ["Legal Liability to Driver Cleaner Coolies", "100"], ["IGST", "4947.15"], ["Gross Premium", "57935.15"],
  ] }],
  parsed("national_motor_v1", "national_motor_v1.1.0"),
);
const nationalValues = values(national);
assert.equal(nationalValues.od_premium, "17575");
assert.equal(nationalValues.tp_premium, "35313");
assert.equal(nationalValues.cpa_premium, "100");
assert.equal(nationalValues.cpa_opted, undefined);
assert.equal(nationalValues.total_premium, "52988");
assert.equal(nationalValues.tax_amount, "4947.15");
assert.equal(nationalValues.gross_premium, "57935.15");

const garbageRejected = refineApprovedMotorPolicyLayout(
  ["UNITED INDIA INSURANCE COMPANY LIMITED\nGOODS CARRYING VEHICLE PACKAGE POLICY"],
  [{ page: 1, rows: [
    ["Make", "Type of Body"], ["Model", "Description"], ["Engine No", "MAKEMODEL"], ["Chassis No", "VEHICLE"],
    ["GVW", "1815"], ["Total IDV", "610000"], ["Gross OD", "4753"], ["Basic TP Premium", "16049"],
    ["Compulsory PA for Owner Driver", "275"], ["Gross TP", "16524"], ["Premium (A + B)", "21277"], ["Total GST", "1743.49"], ["Total Payable Premium", "23020.49"],
  ] }],
  parsed("united_india_motor_v1", "united_india_motor_v1.1.0", [
    { key: "vehicle_make", label: "Make", value: "Type of Body", confidence: .9, page: 1, evidence: "header" },
    { key: "vehicle_model", label: "Model", value: "Description", confidence: .9, page: 1, evidence: "header" },
    { key: "vehicle_engine_number", label: "Engine", value: "MAKEMODEL", confidence: .9, page: 1, evidence: "header" },
    { key: "vehicle_chassis_number", label: "Chassis", value: "VEHICLE", confidence: .9, page: 1, evidence: "header" },
  ]),
);
const garbageValues = values(garbageRejected);
assert.equal(garbageValues.vehicle_make, undefined);
assert.equal(garbageValues.vehicle_model, undefined);
assert.equal(garbageValues.vehicle_engine_number, undefined);
assert.equal(garbageValues.vehicle_chassis_number, undefined);

console.log("OCR production-rerun refinement regression passed.");
