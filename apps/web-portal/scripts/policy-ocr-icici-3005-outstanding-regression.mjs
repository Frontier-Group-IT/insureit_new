import assert from "node:assert/strict";
// @ts-expect-error -- direct Node TypeScript regression with strip-types.
import { refineIcici3005OutstandingFields } from "../lib/policy-ocr-icici-3005-outstanding-fields.ts";

const pages = [
  `ICICI Lombard General Insurance Company Limited
Product Code: 3005 UIN: TEST-3005
Insured & Vehicle Details
Name of Insured                          SAMPLE CUSTOMER
Period of Insurance - Own Damage         Nov 06, 2026 to Nov 05, 2027
Period of Insurance - Third Party        Nov 06, 2026 to Nov 05, 2031
Vehicle Make / Model                     CHETAK / C3001
RTO City                                 MADHYA PRADESH-JABALPUR
Vehicle Registration No.                 NEW
Engine No.                               E20TEST41667
Chassis No.                              TESTVIN12ABC34567
The commencement of coverage depends on payment.`,
  `CERTIFICATE OF INSURANCE CUM POLICY SCHEDULE
Bundled – Two Wheeler Policy
Product Code: 3005
Premium Details
Basic OD Premium                 1,758.00 Basic Third Party Liability     3,273.00
PA Cover for Owner Driver          575.00
Total Own Damage Premium(A)      1,758.00 Total Liability Premium(B)     3,848.00
Total Package Premium(A+B):     5,606.00
IGST 18.00 1009.08
Total Tax Payable in ₹           1,009.00
Total Premium Payable In ₹       6,615.00`,
];
const fields = [
  ["vehicle_make", "CHETAK"],
  ["vehicle_model", "C3001"],
  ["vehicle_engine_number", "E20TEST41667"],
  ["vehicle_chassis_number", "TESTVIN12ABC34567"],
  ["vehicle_capacity", "2"],
  ["idv", "114459"],
  ["od_premium", "1758"],
  ["cpa_premium", "575"],
  ["policy_number", "TEST/3005/000"],
  ["policy_product", "Bundled"],
  ["insurer_name", "ICICI Lombard General Insurance Company Limited"],
  ["vehicle_rto_name", "City"],
  ["tax_amount", "1"],
  ["gross_premium", "22"],
].map(([key, value]) => ({ key, label: key, value, confidence: .99, page: 1, evidence: "baseline" }));
const before = {
  parserId: "icici_lombard_motor_v1",
  parserVersion: "icici_lombard_motor_v1.0.0",
  fields,
  warnings: [
    "Review required. Missing or uncertain fields: tp_premium, policy_start_date, policy_end_date.",
    "Review required. Other unrelated field needs checking.",
  ],
};
const value = (parsed, key) => parsed.fields.find((field) => field.key === key)?.value;
const after = refineIcici3005OutstandingFields(pages, before);
assert.equal(value(after, "vehicle_rto_name"), "MADHYA PRADESH-JABALPUR");
assert.equal(value(after, "tp_premium"), "3273");
assert.equal(value(after, "policy_start_date"), "2026-11-06");
assert.equal(value(after, "policy_end_date"), "2027-11-05");
assert.equal(value(after, "total_premium"), "5606");
assert.equal(value(after, "tax_amount"), "1009");
assert.equal(value(after, "gross_premium"), "6615");
assert.ok(!after.warnings.some((w) => w.includes("Missing or uncertain fields")));
assert.ok(after.warnings.some((w) => w.includes("Other unrelated")));

// Previously correct production fields must remain byte-for-byte identical.
for (const key of [
  "vehicle_make", "vehicle_model", "vehicle_engine_number",
  "vehicle_chassis_number", "vehicle_capacity", "idv", "od_premium",
  "cpa_premium", "policy_number", "policy_product", "insurer_name",
]) {
  assert.deepEqual(after.fields.find((field) => field.key === key), before.fields.find((field) => field.key === key), key);
}

// An already-correct RTO or money amount is preserved instead of re-created.
const verified = {
  ...before,
  fields: before.fields.map((field) => field.key === "vehicle_rto_name"
    ? { ...field, value: "Jabalpur" } : field.key === "gross_premium"
    ? { ...field, value: "6615" } : field),
};
const preserved = refineIcici3005OutstandingFields(pages, verified);
assert.equal(value(preserved, "vehicle_rto_name"), "Jabalpur");
assert.deepEqual(preserved.fields.find((field) => field.key === "gross_premium"), verified.fields.find((field) => field.key === "gross_premium"));

// Do not misread policy end date as the five-year TP end date.
assert.notEqual(value(after, "policy_end_date"), "2031-11-05");

// Never guess non-reconciled TP premium or amounts.
const mismatched = refineIcici3005OutstandingFields(
  [pages[0], pages[1].replace("3,848.00", "9,848.00").replace("5,606.00", "9,606.00").replace("6,615.00", "9,615.00")],
  before
);
assert.equal(value(mismatched, "tp_premium"), undefined);
assert.equal(value(mismatched, "gross_premium"), "22");
assert.equal(value(mismatched, "tax_amount"), "1");

// Product 3003 and other insurers stay entirely unchanged.
assert.equal(refineIcici3005OutstandingFields([pages[0].replace("3005", "3003"), pages[1]], before), before);
assert.equal(refineIcici3005OutstandingFields([pages[0].replaceAll("ICICI Lombard", "Go Digit"), pages[1]], before), before);

// If values are absent we keep existing (even review-flagged) data intact,
// rather than removing fields as the prior correction did.
const missing = refineIcici3005OutstandingFields(
  [pages[0].replace(/RTO City[^\n]*/, "RTO City").replace(/Period of Insurance - Own Damage[^\n]*/, "Period of Insurance - Own Damage"), pages[1].replace(/Basic Third Party Liability[^\n]*/, "Third party covered")],
  before
);
assert.equal(value(missing, "vehicle_rto_name"), "City");
assert.equal(value(missing, "policy_start_date"), undefined);
console.log("ICICI bundled 3005 missing-fields non-regression passed.");
