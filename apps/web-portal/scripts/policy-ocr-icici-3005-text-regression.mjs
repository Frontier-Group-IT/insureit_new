import assert from "node:assert/strict";
// @ts-expect-error -- direct Node TypeScript regression with strip-types.
import { refineIciciBundledTwoWheelerText } from "../lib/policy-ocr-icici-3005-text-refiner.ts";

const pages = [
  `ICICI Lombard General Insurance Company Limited
Product Code: 3005 UIN: TEST-UIN
Insured & Vehicle Details
Name of Insured                           SAMPLE CUSTOMER\nMobile No.                                9876543210
Vehicle Make / Model                     CHETAK / C3001
RTO City                                 MADHYA PRADESH-JABALPUR
Vehicle Registration No.                 NEW
Engine No.                               E20TEST41667
Chassis No.                              SAMPLECHASSIS123456
The commencement of coverage of risk depends on payment.`,
  `CERTIFICATE OF INSURANCE CUM POLICY SCHEDULE
Bundled – Two Wheeler Policy
Product Code: 3005
Premium Details
Basic OD Premium                          1,758.00
Basic Third Party Liability               3,273.00
PA Cover for Owner Driver                   575.00
Sub-Total                                    575.00
Total Own Damage Premium(A)                1,758.00
Total Liability Premium(B)                 3,848.00
Total Package Premium(A+B)                 5,606.00
Total Premium Payable                      6,615.00`,
];

const contaminated = {
  parserId: "icici_lombard_motor_v1",
  parserVersion: "icici_lombard_motor_v1.0.0",
  fields: [
    { key: "vehicle_make", label: "Vehicle make", value: "/ Model", confidence: .9, page: 1, evidence: "bad" },
    { key: "vehicle_model", label: "Vehicle model", value: "RTOCity", confidence: .9, page: 1, evidence: "bad" },
    { key: "vehicle_engine_number", label: "Engine number", value: "SAMPLE CUSTOMER", confidence: .9, page: 1, evidence: "bad" },
    { key: "cpa_premium", label: "CPA amount", value: "1758", confidence: .9, page: 2, evidence: "bad" },
    { key: "policy_number", label: "Policy number", value: "TEST-POLICY", confidence: .99, page: 2, evidence: "keep" },
  ],
  warnings: [],
};
const value = (result, key) => result.fields.find((entry) => entry.key === key)?.value;
const result = refineIciciBundledTwoWheelerText(pages, contaminated);
assert.equal(value(result, "insured_name"), "SAMPLE CUSTOMER");
assert.equal(value(result, "insured_phone"), "9876543210");
assert.equal(value(result, "vehicle_make"), "CHETAK");
assert.equal(value(result, "vehicle_model"), "C3001");
assert.equal(value(result, "vehicle_engine_number"), "E20TEST41667");
assert.equal(value(result, "cpa_premium"), "575");
assert.equal(value(result, "cpa_opted"), "Yes");
assert.equal(value(result, "policy_number"), "TEST-POLICY");
assert.match(result.parserVersion, /icici-3005-text-v1/);

// Native PDF pages often preserve whitespace, page decorations, and tables.
// This shape mirrors the supplied three-page ICICI product-3005 PDF without PII.
const nativePages = [
  `ICICI Lombard General Insurance Company Limited
Product Code: 3005 UIN: TEST-UIN
  Insured & Vehicle Details
  Name of Insured                          SAMPLE CUSTOMER
  Period of Insurance - Own Damage         Nov 06, 2026 to Nov 05, 2027
  Vehicle Make / Model                     CHETAK / C3001
  RTO City                                 MADHYA PRADESH-JABALPUR
  Vehicle Registration No.                 NEW
  Engine No.                               E20TEST41667
  Chassis No.                              SAMPLECHASSIS123456

  The commencement of coverage of risk depends on payment.`,
  `CERTIFICATE OF INSURANCE CUM POLICY SCHEDULE
  Bundled – Two Wheeler Policy              0            1
  Product Code: 3005 UIN: TEST-UIN
  Premium Details
  OWN DAMAGE(A)                             LIABILITY(B)
  Basic OD Premium                  1,758.00   Basic Third Party Liability 3,273.00
                                               PA Cover for Owner Driver 575.00
  Total Own Damage Premium(A)       1,758.00   Total Liability Premium(B) 3,848.00`,
];
const nativeResult = refineIciciBundledTwoWheelerText(nativePages, contaminated);
assert.equal(value(nativeResult, "insured_name"), "SAMPLE CUSTOMER");
assert.equal(value(nativeResult, "vehicle_make"), "CHETAK");
assert.equal(value(nativeResult, "vehicle_model"), "C3001");
assert.equal(value(nativeResult, "vehicle_engine_number"), "E20TEST41667");
assert.equal(value(nativeResult, "cpa_premium"), "575");

// Masked phone values are never inferred or imported.
const masked = refineIciciBundledTwoWheelerText(
  [pages[0].replace("9876543210", "98******10"), pages[1]], contaminated,
);
assert.equal(value(masked, "insured_phone"), undefined);
const absentIdentity = refineIciciBundledTwoWheelerText(
  [pages[0].replace(/Name of Insured[^\\n]*/, "Name of Insured").replace(/Mobile No\\.[^\\n]*/, "Mobile No."), pages[1]], contaminated,
);
assert.equal(value(absentIdentity, "insured_name"), undefined);
assert.equal(value(absentIdentity, "insured_phone"), undefined);

// A missing labelled source must not leave a false extracted value selected.
const missing = refineIciciBundledTwoWheelerText(
  [pages[0].replace(/Engine No\.[^\n]*/, "Engine No."), pages[1].replace(/PA Cover for Owner Driver[^\n]*/, "Owner driver cover")],
  contaminated
);
assert.equal(value(missing, "vehicle_engine_number"), undefined);
assert.equal(value(missing, "cpa_premium"), undefined);
assert.match(missing.warnings.join(" "), /Review required/);

// Do not change any other insurer or ICICI goods carrier product 3003.
assert.equal(refineIciciBundledTwoWheelerText([pages[0].replace("3005", "3003"), pages[1]], contaminated), contaminated);
assert.equal(refineIciciBundledTwoWheelerText([pages[0].replace(/ICICI Lombard/, "Go Digit"), pages[1]], contaminated), contaminated);
console.log("ICICI bundled two-wheeler OCR-only correction regression passed.");
