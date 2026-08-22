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

const magmaTables: StructuredPolicyTable[] = [{ page: 2, rows: [
  ["Registration No", "HR29SAFE9101"], ["Engine No", "ENGSAFE9101"], ["Chassis No", "CHSSAFE9101"],
  ["Make", "MARUTI SUZUKI"], ["Model", "WAGON R VXI CNG"], ["CC", "998"], ["Year of Manufacture", "2025"],
  ["Total Value", "598072"], ["Total Own Damage Premium", "9575"], ["CGST @ 9%", "861.75"], ["SGST @ 9%", "861.75"],
] }];
const magma = refineApprovedMotorPolicyLayout(
  ["MAGMA GENERAL INSURANCE LIMITED\nSTAND-ALONE OWN DAMAGE POLICY FOR PRIVATE CAR\nPolicy No P0099999999/9999/999999\nPeriod Of Insurance 21:23 Hrs of 27/06/2026 To Midnight of 26/06/2027"],
  magmaTables,
  parsed("universal_sompo_motor_v1", [
    { key: "insurer_name", label: "Insurance company", value: "Universal Sompo General Insurance Company Limited", confidence: .8, page: 1, evidence: "bad family" },
    { key: "policy_product", label: "Product", value: "Third Party", confidence: .8, page: 1, evidence: "bad product" },
  ]),
);
const magmaValues = values(magma);
assert.equal(magma.parserId, "magma_motor_v1");
assert.equal(magmaValues.insurer_name, "Magma General Insurance Limited");
assert.equal(magmaValues.policy_product, "SAOD");
assert.equal(magmaValues.policy_start_date, "2026-06-27");
assert.equal(magmaValues.policy_end_date, "2027-06-26");
assert.equal(magmaValues.idv, "598072");
assert.equal(magmaValues.od_premium, "9575");
assert.equal(magmaValues.tp_premium, "0");
assert.equal(magmaValues.cpa_opted, "No");
assert.equal(magmaValues.cpa_premium, "0");
assert.equal(magmaValues.total_premium, "9575");
assert.equal(magmaValues.tax_amount, "1723.5");
assert.equal(magmaValues.gross_premium, "11298.5");

const hdfcComprehensive = refineApprovedMotorPolicyLayout(
  ["HDFC ERGO General Insurance Company Limited\nPRIVATE CAR COMPREHENSIVE POLICY\nPolicy No. 2302 9999 8888 0600 000\nPeriod of Insurance\nFrom 19 Jun, 2026 00:01 hrs\nTo 18 Jun, 2027 23:59\nPremium Details\nNet Own Damage Premium (a) 9788\nNet Liability Premium (b) 3851\nPA Cover for Owner Driver of 1500000 325\nTotal Package Premium (a+b) 13639\nIntegrated Tax 18% 2455\nTotal Premium 16094"],
  [{ page: 1, rows: [["Total IDV", "300000"]] }],
  parsed("hdfc_ergo_motor_v1"),
);
const hdfcPackageValues = values(hdfcComprehensive);
assert.equal(hdfcPackageValues.policy_product, "Package");
assert.equal(hdfcPackageValues.idv, "300000");
assert.equal(hdfcPackageValues.od_premium, "9788");
assert.equal(hdfcPackageValues.tp_premium, "3526");
assert.equal(hdfcPackageValues.cpa_opted, "Yes");
assert.equal(hdfcPackageValues.cpa_premium, "325");
assert.equal(hdfcPackageValues.total_premium, "13639");
assert.equal(hdfcPackageValues.tax_amount, "2455");
assert.equal(hdfcPackageValues.gross_premium, "16094");

const hdfcSaod = refineApprovedMotorPolicyLayout(
  ["HDFC ERGO General Insurance Company Limited\nStandalone Motor Own Damage Cover - Two Wheeler\nPolicy No. 2301 9999 2337 0200 000\nPeriod of Insurance\nFrom 01 Jul, 2026 00:01 hrs\nTo 30 Jun, 2027 Midnight\nNet Own Damage Premium (a) 863 Total Premium (a+b) 863\nGST 18% : Central Tax 9% ( 77.5 ) + State Tax 9% ( 77.5) 155\nTotal Premium 1018\nActive TP Policy No: 6104601804"],
  [{ page: 1, rows: [["Total IDV", "70000"]] }],
  parsed("hdfc_ergo_motor_v1", [
    { key: "policy_number", label: "Policy number", value: "6104601804", confidence: .7, page: 1, evidence: "previous/active TP" },
    { key: "tp_premium", label: "TP", value: "598", confidence: .7, page: 1, evidence: "wrong column" },
  ]),
);
const hdfcSaodValues = values(hdfcSaod);
assert.equal(hdfcSaodValues.policy_product, "SAOD");
assert.equal(hdfcSaodValues.policy_number, "2301999923370200000");
assert.equal(hdfcSaodValues.idv, "70000");
assert.equal(hdfcSaodValues.od_premium, "863");
assert.equal(hdfcSaodValues.tp_premium, "0");
assert.equal(hdfcSaodValues.cpa_premium, "0");
assert.equal(hdfcSaodValues.tax_amount, "155");
assert.equal(hdfcSaodValues.gross_premium, "1018");

const uiicNoOwnerCpa = refineApprovedMotorPolicyLayout(
  ["UNITED INDIA INSURANCE COMPANY LIMITED\nGCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY\nPOLICY NO.:SAFE/UI/009104\nPERIOD OF INSURANCE\nFrom 23:00 Hrs of 23/06/2026\nTo Midnight of 22/06/2027\nCompulsory Personal Accident (CPA) cover is removed, since owner driver is not holding a valid driving license."],
  [{ page: 4, rows: [
    ["Total IDV", "652425"], ["Gross OD(A)", "7027"], ["B. Basic - TP", "13642"],
    ["LL to Paid Driver IMT 28", "100"], ["Liability to Workmen greater than 6", "100"], ["Gross TP(B)", "13842"],
    ["Premium (A+B)", "20869"], ["IGST-Others(18%)", "1301"], ["IGST-Basic TP(5%)", "682"], ["Total(Rounded Off)", "22852"],
  ] }],
  parsed("united_india_motor_v1"),
);
const uiicNoCpaValues = values(uiicNoOwnerCpa);
assert.equal(uiicNoCpaValues.cpa_opted, "No");
assert.equal(uiicNoCpaValues.cpa_premium, "200");
assert.equal(uiicNoCpaValues.od_premium, "7027");
assert.equal(uiicNoCpaValues.tp_premium, "13642");
assert.equal(uiicNoCpaValues.total_premium, "20869");
assert.equal(uiicNoCpaValues.tax_amount, "1983");
assert.equal(uiicNoCpaValues.gross_premium, "22852");

const newIndia = refineApprovedMotorPolicyLayout(
  ["THE NEW INDIA ASSURANCE CO. LTD.\nStandalone Motor Own Damage Policy for Private car - Enhanced Covers\nPolicy Number :900000000000009105\nPeriod of cover 14/08/2026 12:00:01 AM to 13/08/2027 11:59:59 PM"],
  [{ page: 1, rows: [["Total Value", "1055000"], ["Total OD Premium", "12831"], ["Net Premium", "12831"], ["GST in Rs", "2310"], ["Total Payable", "15141"]] }],
  parsed("generic_motor_v1", [
    { key: "policy_product", label: "Product", value: "Bundled", confidence: .7, page: 1, evidence: "wrong generic mapping" },
    { key: "idv", label: "IDV", value: "1006900", confidence: .7, page: 1, evidence: "vehicle component only" },
  ]),
);
const newIndiaValues = values(newIndia);
assert.equal(newIndia.parserId, "new_india_motor_v1");
assert.equal(newIndiaValues.policy_product, "SAOD");
assert.equal(newIndiaValues.idv, "1055000");
assert.equal(newIndiaValues.od_premium, "12831");
assert.equal(newIndiaValues.tp_premium, "0");
assert.equal(newIndiaValues.tax_amount, "2310");
assert.equal(newIndiaValues.gross_premium, "15141");

console.log("OCR insurer/layout v4 rerun refinement regression passed.");
