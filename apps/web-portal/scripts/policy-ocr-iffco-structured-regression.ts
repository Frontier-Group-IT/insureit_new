// @ts-expect-error -- direct Node strip-types execution requires the explicit .ts suffix at runtime.
import { refineIffcoStructuredFinancials } from "../lib/policy-ocr-iffco-structured-refiner.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers";

const base: ParsedPolicyResult = {
  parserId: "iffco_tokio_commercial_motor_v2",
  parserVersion: "iffco_tokio_commercial_motor_v2.3.0",
  warnings: [],
  fields: [
    { key: "insurer_name", label: "Insurance company", value: "IFFCO-TOKIO General Insurance Company Limited", confidence: .99, page: 1, evidence: "IFFCO" },
    { key: "policy_product", label: "Policy product", value: "Package", confidence: .99, page: 1, evidence: "Package" },
    { key: "policy_number", label: "Policy number", value: "N8109328", confidence: .99, page: 1, evidence: "P400 Policy # N8109328" },
    { key: "idv", label: "IDV / Sum insured", value: "1600000", confidence: .99, page: 1, evidence: "Package 1600000" },
    { key: "policy_start_date", label: "Valid from", value: "2026-07-24", confidence: .99, page: 1, evidence: "24/07/2026" },
    { key: "policy_end_date", label: "Valid upto", value: "2027-07-23", confidence: .99, page: 1, evidence: "23/07/2027" },
    { key: "total_premium", label: "Printed net premium", value: "22739", confidence: .99, page: 1, evidence: "Premium/Taxable Value 22739" },
    { key: "od_premium", label: "OD premium", value: "1", confidence: .99, page: 1, evidence: "bad flattened OCR candidate" },
    { key: "tp_premium", label: "Third party premium", value: "22409", confidence: .99, page: 1, evidence: "bad reconciliation" },
    { key: "cpa_premium", label: "CPA amount", value: "330", confidence: .72, page: 1, evidence: "flattened CPA" },
  ],
};

const structuredTables = [{
  page: 1,
  rows: [
    ["Description", "IMT", "Premium"],
    ["Basic TP Premium", "", "7,267.00"],
    ["P.A. Owner Driver", "IMT 15", "15,00,000", "330.00"],
    ["Legal Liability to Driver", "IMT 28", "100.00"],
    ["SAC", "997134"],
  ],
}];

const fixed = refineIffcoStructuredFinancials(structuredTables, base);
assertField(fixed, "od_premium", "15042");
assertField(fixed, "tp_premium", "7367");
assertField(fixed, "cpa_premium", "330");
console.log("PASS: structured IFFCO rows repair flattened premium misread");

const withoutFlattenedNet: ParsedPolicyResult = {
  ...base,
  fields: base.fields.filter((field) => field.key !== "total_premium"),
};

const withBifurcation = refineIffcoStructuredFinancials([{
  page: 1,
  rows: [
    ...structuredTables[0].rows,
    ["Premium Bifurcation", "8,819.00", "13,920.00", "22,739.00"],
  ],
}], withoutFlattenedNet);
assertField(withBifurcation, "total_premium", "22739");
assertField(withBifurcation, "od_premium", "15042");
assertField(withBifurcation, "tp_premium", "7367");
assertField(withBifurcation, "cpa_premium", "330");
console.log("PASS: structured IFFCO Premium Bifurcation independently recovers printed net");

const withTaxTotals = refineIffcoStructuredFinancials([{
  page: 1,
  rows: [
    ...structuredTables[0].rows,
    ["CGST @ 9%", "2,046.51"],
    ["SGST @ 9%", "2,046.51"],
    ["Gross Premium", "26,832.02"],
  ],
}], withoutFlattenedNet);
assertField(withTaxTotals, "total_premium", "22739");
assertField(withTaxTotals, "od_premium", "15042");
assertField(withTaxTotals, "tp_premium", "7367");
assertField(withTaxTotals, "cpa_premium", "330");
console.log("PASS: structured gross less GST independently recovers printed net");

// Sanitized from the actual Google Layout Parser JSON uploaded from production testing.
// Google emits the GST table as a header row followed by data rows; labels and values are not in one flattened row.
const realLayoutShape = refineIffcoStructuredFinancials([
  {
    page: 1,
    rows: [
      ["Basic TP Premium Basic Trailers TP Premium", "B. Third Party (Rs.)", "7267.00 0.00"],
      ["Bi Fuel Kit (IMT 25)", "", "0.00"],
      ["Add:", "", ""],
      ["Geographical Area Extension (IMT 1)", "", "0.00"],
      ["PA Owner Driver CSI Rs 1500000", "", "330.00"],
      ["Legal Liability to Driver (IMT 28)", "", "100.00"],
      ["Net (B)", "", "7697.00"],
    ],
  },
  {
    page: 1,
    rows: [
      ["Insurance Cover", "SAC", "Taxable Value(Rs.)", "CGST", "GST Rate(%) SGST/UTGST", "IGST", "CGST", "GST Amount (Rs.) SGST/UTGST IGST", "Gross Premium Payable (Rs.)"],
      ["GST Details", "997134", "22739.00", "", "", "18.00", "", "4093.02", "26832.02"],
      ["Total", "", "22739.00", "", "", "", "", "4093.02", "26832.02"],
    ],
  },
  {
    page: 2,
    rows: [
      ["Section 1 (Rs.)", "Section 2 (Rs.)", "RPI Premium", "Premium/Taxable Value(Rs.)", "Total GST", "Net Premium (Rs.)"],
      ["8819.00", "13920.00", "", "22739.00", "4093.02", "26832.02"],
    ],
  },
], withoutFlattenedNet);
assertField(realLayoutShape, "total_premium", "22739");
assertField(realLayoutShape, "od_premium", "15042");
assertField(realLayoutShape, "tp_premium", "7367");
assertField(realLayoutShape, "cpa_premium", "330");
console.log("PASS: actual Google Layout Parser header/body table shape recovers IFFCO financials");

const incomplete = refineIffcoStructuredFinancials([{
  page: 1,
  rows: [
    ["Basic TP Premium", "7,267.00"],
    ["Legal Liability to Driver", "100.00"],
  ],
}], base);

for (const key of ["od_premium", "tp_premium", "cpa_premium"]) {
  if (incomplete.fields.some((field) => field.key === key)) {
    throw new Error(`FAIL: ${key} should be withheld when structured CPA evidence is missing`);
  }
}
console.log("PASS: incomplete structured evidence withholds unsafe financial fields");
console.log("IFFCO structured regression: 5/5 cases passed.");

function assertField(result: ParsedPolicyResult, key: string, expected: string) {
  const value = result.fields.find((field) => field.key === key)?.value;
  if (value !== expected) throw new Error(`FAIL: ${key} expected ${expected}, got ${value ?? "missing"}`);
}
