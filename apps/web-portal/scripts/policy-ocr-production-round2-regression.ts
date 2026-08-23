import assert from "node:assert/strict";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineProductionRound2Policy } from "../lib/policy-ocr-production-round2-refiner.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";
import type { StructuredPolicyTable } from "../lib/policy-ocr-iffco-structured-refiner.ts";

function parsed(parserId: string, parserVersion: string, fields: ParsedPolicyResult["fields"] = []): ParsedPolicyResult {
  return { parserId, parserVersion, fields, warnings: [] };
}
function field(key: string, value: string): ParsedPolicyResult["fields"][number] { return { key, label: key, value, confidence: .8, page: 1, evidence: "sanitized" }; }
function values(result: ParsedPolicyResult) { return Object.fromEntries(result.fields.map((item) => [item.key, item.value])); }

{
  const pages = ["Go Digit General Insurance Limited\nCOMMERCIAL VEHICLE PACKAGE POLICY - CASH VAN\nGST 18%"];
  const tables: StructuredPolicyTable[] = [{ page: 1, rows: [
    ["Vehicle Make","Vehicle Model / Vehicle Variant","Fuel Type","Year of Manufacture","GVW","Chassis No","Engine No"],
    ["MAHINDRA","BOLERO CAMPER / CASH VAN","DIESEL","2019","2880","SYNCHASSIS01","SYNENGINE01"],
    ["Total OD Premium","710.41","Total TP Premium","7907"],
  ] }];
  const result = refineProductionRound2Policy(pages, tables, parsed("digit_commercial_motor_v1", "digit_commercial_motor_v1.8.0+prod-r1-digit_misd", [field("cpa_opted","Yes"), field("cpa_premium","50")]));
  const v = values(result);
  assert.equal(v.cpa_opted, "No");
  assert.equal(v.cpa_premium, "0");
  assert.equal(v.od_premium, "710.41");
  assert.equal(v.tp_premium, "7907");
  assert.equal(v.total_premium, "8617.41");
  assert.equal(v.vehicle_make, "Mahindra");
  assert.equal(v.vehicle_manufacturing_year, "2019");
  assert.equal(v.vehicle_capacity, "2880KG");
}

{
  const pages = ["IFFCO-TOKIO General Insurance Company Limited\nCOMMERCIAL VEHICLE PACKAGE POLICY\nJCB BACKHOE LOADER"];
  const tables: StructuredPolicyTable[] = [{ page: 1, rows: [
    ["Make of Vehicle","Model of Vehicle","Fuel Type","Year of Manufacture","Seating Capacity"],
    ["JCB","3DX PLUS","DIESEL","2026","2"],
    ["Basic TP Premium","7267"],
    ["Legal Liability to Paid Driver","50"],
    ["P.A. Owner-Driver","0"],
  ] }];
  const result = refineProductionRound2Policy(pages, tables, parsed("iffco_tokio_commercial_motor_v2", "iffco_tokio_commercial_motor_v2.3.0+prod-r1-iffco_misd", [field("total_premium","12362"), field("tp_premium","7317"), field("cpa_opted","Yes"), field("cpa_premium","1"), field("vehicle_make","Non Elect. Acc.")]));
  const v = values(result);
  assert.equal(v.tp_premium, "7267");
  assert.equal(v.cpa_opted, "No");
  assert.equal(v.cpa_premium, "0");
  assert.equal(v.od_premium, "5095");
  assert.equal(v.vehicle_make, "JCB");
  assert.equal(v.vehicle_model, "3DX PLUS");
}

{
  const pages = ["NATIONAL INSURANCE COMPANY LIMITED\nMOTOR CYCLE PACKAGE POLICY\nNEW VEHICLE\nGST 18%\nOwner Driver PA cover not opted"];
  const tables: StructuredPolicyTable[] = [{ page: 1, rows: [
    ["Make","Model","Fuel Type","Year of Manufacture","Chassis No","Engine No"],
    ["HERO","SUPER SPLENDOR","PETROL","2026","SYNCHASSIS02","SYNENGINE02"],
    ["Legal Liability Cover","3851"],
    ["Net Premium","4188"],
  ] }];
  const result = refineProductionRound2Policy(pages, tables, parsed("oriental_motor_v1", "oriental_motor_v1.1.0", [field("insurer_name","The Oriental Insurance Company Limited"), field("policy_product","Bundled")]));
  const v = values(result);
  assert.equal(v.insurer_name, "National Insurance Company Limited");
  assert.equal(v.policy_product, "Package");
  assert.equal(v.vehicle_class, "TWP");
  assert.equal(v.tp_premium, "3851");
  assert.equal(v.od_premium, "337");
  assert.equal(v.total_premium, "4188");
  assert.equal(v.cpa_opted, "No");
}

console.log("Production OCR round 2 regression: Digit, IFFCO and National structural corrections passed.");
