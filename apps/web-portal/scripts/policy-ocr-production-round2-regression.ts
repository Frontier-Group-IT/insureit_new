import assert from "node:assert/strict";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineProductionRound2Policy } from "../lib/policy-ocr-production-round2-refiner.ts";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { refineApprovedMotorPolicyLayout } from "../lib/policy-ocr-approved-layout-refiner.ts";
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
  assert.equal(v.tp_premium, "7317");
  assert.equal(v.cpa_opted, "No");
  assert.equal(v.cpa_premium, "0");
  assert.equal(v.od_premium, "5045");
  assert.equal(v.vehicle_make, "JCB");
  assert.equal(v.vehicle_model, "3DX PLUS");
}

{
  const pages = ["IFFCO-TOKIO General Insurance Company Limited\nCOMMERCIAL VEHICLE PACKAGE POLICY\nJCB BACKHOE LOADER\nPolicy schedule"];
  const tables: StructuredPolicyTable[] = [{ page: 1, rows: [
    ["Make of Vehicle", "Model of Vehicle", "Fuel Type", "Year of Manufacture", "Engine No"],
    ["JCB", "3DX", "PETROL", "2026", "SYNENGINE001"],
    ["Basic TP Premium", "7267"],
    ["P.A. Owner-Driver", "380"],
  ] }];
  const result = refineProductionRound2Policy(
    pages,
    tables,
    parsed("iffco_tokio_commercial_motor_v2", "iffco_tokio_commercial_motor_v2.3.0", [
      field("total_premium", "12401"),
      field("od_premium", "4754"),
      field("tp_premium", "7317"),
      field("cpa_opted", "No"),
      field("cpa_premium", "0"),
    ]),
  );
  const v = values(result);
  assert.equal(v.tp_premium, "7267");
  assert.equal(v.cpa_opted, "Yes");
  assert.equal(v.cpa_premium, "380");
  assert.equal(v.od_premium, "4754");
  assert.equal(v.vehicle_make, "JCB");
  assert.equal(v.vehicle_model, "3DX");
  assert.equal(v.vehicle_fuel_type, "Petrol");
  assert.equal(v.vehicle_manufacturing_year, "2026");
  assert.equal(v.vehicle_engine_number, "SYNENGINE001");
}

{
  const pages = ["IFFCO-TOKIO General Insurance Company Limited\nCOMMERCIAL VEHICLE PACKAGE POLICY\nJCB BACKHOE LOADER\nBasic TP Premium 8420.00\nCompulsory PA Premium for Owner Driver 275.00"];
  const tables: StructuredPolicyTable[] = [{ page: 1, rows: [
    ["Make of Vehicle", "Model of Vehicle", "Fuel Type", "Year of Manufacture", "Chassis Number", "Engine Number"],
    ["JCB", "3DX PLUS", "DIESEL", "2026", "SYNCHASSISIFFCO002", "SYNENGINEIFFCO002"],
    ["Basic TP Premium", "8420.00"],
    ["Compulsory PA Premium for Owner Driver", "275.00"],
    ["Taxable Value (Rs.)", "18795.00"],
    ["GST Amount (Rs.)", "3383.10"],
    ["Gross Premium Payable (Rs.)", "22178.10"],
  ] }];
  const result = refineApprovedMotorPolicyLayout(
    pages,
    tables,
    parsed("iffco_tokio_commercial_motor_v1", "iffco_tokio_commercial_motor_v1.2.0", [
      field("total_premium", "18795"),
      field("tax_amount", "3383.10"),
      field("gross_premium", "22178.10"),
    ]),
  );
  const v = values(result);
  assert.equal(v.vehicle_class, "MISD");
  assert.equal(v.vehicle_make, "JCB");
  assert.equal(v.vehicle_model, "3DX PLUS");
  assert.equal(v.vehicle_fuel_type, "Diesel");
  assert.equal(v.vehicle_manufacturing_year, "2026");
  assert.equal(v.vehicle_chassis_number, "SYNCHASSISIFFCO002");
  assert.equal(v.vehicle_engine_number, "SYNENGINEIFFCO002");
  assert.equal(v.tp_premium, "8420");
  assert.equal(v.cpa_premium, "275");
  assert.equal(v.cpa_opted, "Yes");
  assert.equal(v.od_premium, "10100");
  assert.equal(v.total_premium, "18795");
  assert.equal(v.tax_amount, "3383.1");
  assert.equal(v.gross_premium, "22178.1");
}

{
  const pages = ["IFFCO-TOKIO General Insurance Company Limited\nCOMMERCIAL VEHICLE PACKAGE POLICY\nJCB BACKHOE LOADER\nBasic OD Premium 4058.00 Basic TP Premium (Including TPPD) 7267.00\nBi Fuel Kit (IMT 25) 0.00 Geographical Area Extension (IMT 1)\nPA Owner Driver CSI Rs 1500000\nFiber Glass Fuel Tank 0.00 Legal Liability to Driver (IMT 28) 50.00\nNet (A) 4667.00 Net (B) 7647.00"];
  const tables: StructuredPolicyTable[] = [{ page: 1, rows: [
    ["Make of Vehicle", "Model of Vehicle", "Fuel Type", "Year of Manufacture", "CC"],
    ["JCB", "3DX PLUS BACKHOE LOADER", "DIESEL", "2026", "4765"],
    ["Basic TP Premium (Including TPPD)", "7267.00"],
    ["Bi Fuel Kit (IMT 25)", "0.00", "Geographical Area Extension (IMT 1)", ""],
    ["PA Owner Driver CSI Rs 1500000", ""],
    ["Legal Liability to Driver (IMT 28)", "50.00"],
    ["Net (A)", "4667.00", "Net (B)", "7647.00"],
    ["Premium/Taxable Value RS.", "12314.00"],
    ["GST Amount(Rs.)", "2216.52"],
    ["Gross Premium Payable Rs.", "14530.52"],
  ] }];
  const result = refineApprovedMotorPolicyLayout(
    pages,
    tables,
    parsed("iffco_tokio_commercial_motor_v1", "iffco_tokio_commercial_motor_v1.2.0", [
      field("total_premium", "12314"),
      field("tax_amount", "2216.52"),
      field("gross_premium", "14530.52"),
      field("cpa_opted", "No"),
      field("cpa_premium", "0"),
    ]),
  );
  const v = values(result);
  assert.equal(v.tp_premium, "7317");
  assert.equal(v.cpa_premium, "330");
  assert.equal(v.cpa_opted, "Yes");
  assert.equal(v.od_premium, "4667");
  assert.equal(v.total_premium, "12314");
  assert.equal(v.tax_amount, "2216.52");
  assert.equal(v.gross_premium, "14530.52");
}

{
  const pages = ["IFFCO-TOKIO General Insurance Company Limited\nCOMMERCIAL VEHICLE PACKAGE POLICY\nSPECIAL TYPE VEHICLE\nBasic TP Premium 8120.00\nPersonal Accident Premium for Owner Driver 275.00\nLegal Liability to Paid Driver 75.00"];
  const tables: StructuredPolicyTable[] = [{ page: 1, rows: [
    ["Make of Vehicle", "Model of Vehicle", "Fuel Type", "Year of Manufacture", "CC"],
    ["JCB", "4DX SYNTHETIC", "DIESEL", "2025", "4390"],
    ["Basic TP Premium", "8120.00"],
    ["Personal Accident Premium for Owner Driver", "275.00"],
    ["Legal Liability to Paid Driver", "75.00"],
    ["Premium/Taxable Value RS.", "14470.00"],
    ["GST Amount(Rs.)", "2604.60"],
    ["Gross Premium Payable Rs.", "17074.60"],
  ] }];
  const result = refineApprovedMotorPolicyLayout(
    pages,
    tables,
    parsed("iffco_tokio_commercial_motor_v1", "iffco_tokio_commercial_motor_v1.2.0", [
      field("total_premium", "14470"),
      field("tax_amount", "2604.60"),
      field("gross_premium", "17074.60"),
    ]),
  );
  const v = values(result);
  assert.equal(v.tp_premium, "8195");
  assert.equal(v.cpa_premium, "275");
  assert.equal(v.cpa_opted, "Yes");
  assert.equal(v.od_premium, "6000");
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
