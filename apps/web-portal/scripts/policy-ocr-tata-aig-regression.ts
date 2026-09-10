import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineTataAigBundledTwoWheelerPolicy } from "../lib/policy-ocr-tata-aig-refiner.ts";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { guardTataAigPolicyNumber } from "../lib/policy-ocr-tata-aig-policy-number-guard.ts";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineTataAigVisibleFields } from "../lib/policy-ocr-tata-aig-visible-field-refiner.ts";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { buildPolicyOcrOnboardingUpdate } from "../lib/policy-ocr-onboarding-apply.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";

function base(): ParsedPolicyResult {
  return {
    parserId: "generic_motor_v1",
    parserVersion: "generic_motor_v1.2.0",
    fields: [],
    warnings: ["This insurer format is not fully supported yet. Verify every value manually."],
  };
}

function run(pages: string[]) {
  const tata = guardTataAigPolicyNumber(pages, refineTataAigBundledTwoWheelerPolicy(pages, base()));
  return refineTataAigVisibleFields(pages, tata);
}

function field(result: ParsedPolicyResult, key: string): string | undefined {
  return result.fields.find((entry) => entry.key === key)?.value;
}

const trainedShape = [
  `TATA AIG GENERAL INSURANCE COMPANY LIMITED
Bundled Auto Secure - Two Wheeler Policy (1 Year Term for Own Damage & 5 Years for Third Party)
Insured Details - Key Information for You
Name Mr. Example Rider
Address Sample Colony BARAN, RAJASTHAN, 325205
Contact No. +91 85**07**71
Policy No. 7000001234 00 00
Period of Insurance & Premium
Coverage Details Valid From Valid Till
Own Damage Cover 25/08/2026 (11:09 Hrs) 24/08/2027 (Midnight)
Third-Party Cover 25/08/2026 (11:09 Hrs) 24/08/2031 (Midnight)
Compulsory Personal Accident Cover for Owner-Driver 25/08/2026 (11:09 Hrs) 24/08/2027 (Midnight)
Premium Amount (Including GST) ₹ 8572`,
  `Certificate of Insurance Cum Policy Schedule
Vehicle Details
Policy No. 7000001234 00 00
Insured Name Mr. Example Rider
Registration No. NEW
Make / Model / Variant BAJAJ/CHETAK/C35 03
Fuel Type BATTERY
Engine No. /Motor No. (For EV)
E20SYN88775
Chassis No. MD2SYN20XTAE84481
Body Type SCOOTER
CC / KW 4
Mfg. Year 2026
RTO Location BARAN
Insured Declared Value (IDV) Details
Policy Year Vehicle IDV Electrical Accessories IDV Non-Electrical Accessories IDV Total IDV
1 117949 0 0 117949.00`,
  `Schedule of Premium
Section - I Loss Of Or Damage To The Vehicle Insured (A)
Basic Own Damage (OD)
Premium on Vehicle ₹ 1,976.83
Total Own Damage Premium (A) ₹ 1,976.83
Section - I Add On Covers
Add: Depreciation Allowance ₹ 589.75
Add : Return to Invoice ₹ 271.28
Add: Consumable Expenses ₹ 54.26
Add : Road Side Assistance ₹ 99.00
Add : Electric Surge Secure ₹ 424.62
Add : Tyre and Rim Secure ₹ 200.51
Total Add-On Premium (C) ₹ 1639.41
Section - II Liability to Third-Parties (B)
Basic TP Premium ₹ 3,273.00
Personal Accident (PA) Benefits
Compulsory Personal Accident Cover for Owner Driver
₹ 1,500,000
₹ 375.00
Total Liability Premium (B) ₹ 3,648.00
Net Premium (A+B+C) ₹ 7,264.00
SGST 9% ₹ 654.00
CGST 9% ₹ 654.00
Total Policy Premium ₹ 8,572.00`,
];

const trained = run(trainedShape);
assert.equal(trained.parserId, "tata_aig_motor_v1");
assert.match(trained.parserVersion, /tata_aig_tw_bundled_v1/);
assert.equal(field(trained, "insured_name"), "Mr. Example Rider");
assert.equal(field(trained, "insured_phone"), undefined, "masked customer mobile must never be guessed");
assert.equal(field(trained, "insurer_name"), "TATA AIG General Insurance Company Limited");
assert.equal(field(trained, "policy_product"), "Bundled");
assert.equal(field(trained, "policy_number"), "70000012340000");
assert.equal(field(trained, "policy_start_date"), "2026-08-25");
assert.equal(field(trained, "policy_end_date"), "2027-08-24");
assert.equal(field(trained, "vehicle_registration_status"), "registration_pending");
assert.equal(field(trained, "vehicle_registration_number"), undefined);
assert.equal(field(trained, "vehicle_make"), "BAJAJ");
assert.equal(field(trained, "vehicle_model"), "CHETAK");
assert.equal(field(trained, "vehicle_fuel_type"), "Electric");
assert.equal(field(trained, "vehicle_engine_number"), "E20SYN88775");
assert.equal(field(trained, "vehicle_chassis_number"), "MD2SYN20XTAE84481");
assert.equal(field(trained, "vehicle_class"), "Scooter");
assert.equal(field(trained, "vehicle_capacity"), "4");
assert.equal(field(trained, "vehicle_manufacturing_year"), "2026");
assert.equal(field(trained, "vehicle_rto_name"), "BARAN");
assert.equal(field(trained, "vehicle_rto_state"), "Rajasthan");
assert.equal(field(trained, "idv"), "117949");
assert.equal(field(trained, "od_premium"), "3616.24");
assert.equal(field(trained, "tp_premium"), "3273");
assert.equal(field(trained, "cpa_opted"), "Yes");
assert.equal(field(trained, "cpa_premium"), "375", "CPA must come from the owner-driver row, not an add-on value");
assert.equal(field(trained, "total_premium"), "7264");
assert.equal(field(trained, "tax_amount"), "1308");
assert.equal(field(trained, "gross_premium"), "8572");

const liveDocumentAiShape = [
  `TATA AIG GENERAL INSURANCE COMPANY LIMITED
Bundled Auto Secure - Two Wheeler Policy (1 Year Term for Own Damage & 5 Years for Third Party)
Name Mr. Example Rider
Address
Sample Colony
BARAN, RAJASTHAN, 325205
Contact No.
+91 85**07**71
Agent / POSP Contact No. 7340662133
Policy No. 7000001234 00 00
Own Damage Cover
25/08/2026 (11:09 Hrs)
24/08/2027 (Midnight)`,
  `Certificate of Insurance Cum Policy Schedule
Vehicle Details
Registration No.
NEW
Make / Model / Variant
BAJAJ/CHETAK/C35 03
Fuel Type
BATTERY
Engine No. / Motor No. (For EV)
E20SYN88775
Chassis No.
Vehicle identifiers
MD2SYN20XTAE84481
Body Type SCOOTER
CC / KW 4
Mfg. Year 2026
RTO Location
BARAN
Seating Capacity (Including Driver)
2
Total IDV
1
117949
0
0
117949.00`,
  `Schedule of Premium
Section - I Loss Of Or Damage To The Vehicle Insured (A)
Total Own Damage Premium (A)
₹ 1,976.83
Section - I Add On Covers
TA 16 Depreciation Allowance
₹ 589.75
TA 17 Return to Invoice
₹ 271.28
TA 18 Consumable Expenses
₹ 54.26
Total Add-On Premium (C)
₹ 1639.41
Section - II Liability to Third-Parties (B)
Basic TP Premium
₹ 3,273.00
Personal Accident (PA) Benefits
Compulsory Personal Accident Cover for Owner Driver
CSI
₹ 1,500,000
Premium
₹ 375.00
Total Liability Premium (B)
₹ 3,648.00
Net Premium (A+B+C)
₹ 7,264.00
SGST 9% ₹ 654.00
CGST 9% ₹ 654.00
Total Policy Premium ₹ 8,572.00`,
];

const live = run(liveDocumentAiShape);
assert.equal(field(live, "insured_phone"), undefined, "POSP contact must not leak into insured phone when customer number is masked");
assert.equal(field(live, "vehicle_rto_name"), "BARAN");
assert.equal(field(live, "vehicle_rto_state"), "Rajasthan");
assert.equal(field(live, "vehicle_chassis_number"), "MD2SYN20XTAE84481");
assert.equal(field(live, "cpa_premium"), "375", "TA 16 must never become CPA amount");
assert.equal(field(live, "od_premium"), "3616.24");
assert.equal(field(live, "tp_premium"), "3273");
assert.equal(field(live, "policy_start_date"), "2026-08-25");
assert.equal(field(live, "policy_end_date"), "2027-08-24");

const contaminated: ParsedPolicyResult = {
  ...base(),
  parserId: "tata_aig_motor_v1",
  fields: [
    { key: "insured_phone", label: "Phone number", value: "7340662133", confidence: .8, page: 2, evidence: "POSP Contact" },
    { key: "vehicle_rto_state", label: "RTO state", value: "Seating Capacity", confidence: .8, page: 2, evidence: "generic spill" },
    { key: "cpa_premium", label: "CPA amount", value: "16", confidence: .8, page: 3, evidence: "TA 16" },
  ],
};
const cleaned = refineTataAigVisibleFields(liveDocumentAiShape, contaminated);
assert.equal(field(cleaned, "insured_phone"), undefined);
assert.equal(field(cleaned, "vehicle_rto_state"), "Rajasthan");
assert.equal(field(cleaned, "cpa_premium"), "375");

const siblingShape = [
  `TATA AIG General Insurance Company Limited
Bundled Auto Secure - Two Wheeler Policy (1 Year Term for Own Damage & 5 Years for Third Party)
Name Ms. Sample Owner
Address Example Road JAIPUR, RAJASTHAN, 302001
Contact No. +91 98765 43210
Policy No. 8111222333 11 22
Period of Insurance & Premium
Own Damage Cover 03/09/2026 (09:30 Hrs) 02/09/2027 (Midnight)
Third-Party Cover 03/09/2026 (09:30 Hrs) 02/09/2031 (Midnight)
Premium Amount (Including GST) ₹ 8437`,
  `Vehicle Details
Registration No. NEW
Make / Model / Variant EXAMPLE/EVRIDE/X2
Fuel Type BATTERY
Engine No. /Motor No. (For EV)
EVSYN20002
Chassis No. SYNC35EVCHASSIS2002
Body Type SCOOTER
CC / KW 5
Mfg. Year 2026
RTO Location JAIPUR
Total IDV (₹)
145000.00`,
  `Schedule of Premium
Total Own Damage Premium (A) ₹ 2,100.00
Total Add-On Premium (C) ₹ 1,250.00
Basic TP Premium ₹ 3,400.00
Compulsory Personal Accident Cover for Owner Driver
₹ 1,500,000
₹ 400.00
Total Liability Premium (B) ₹ 3,800.00
Net Premium (A+B+C) ₹ 7,150.00
SGST 9% ₹ 643.50
CGST 9% ₹ 643.50
Total Policy Premium ₹ 8,437.00`,
];

const sibling = run(siblingShape);
assert.equal(field(sibling, "insured_name"), "Ms. Sample Owner");
assert.equal(field(sibling, "insured_phone"), "9876543210");
assert.equal(field(sibling, "policy_number"), "81112223331122");
assert.equal(field(sibling, "policy_end_date"), "2027-09-02");
assert.equal(field(sibling, "vehicle_make"), "EXAMPLE");
assert.equal(field(sibling, "vehicle_model"), "EVRIDE");
assert.equal(field(sibling, "vehicle_fuel_type"), "Electric");
assert.equal(field(sibling, "vehicle_engine_number"), "EVSYN20002");
assert.equal(field(sibling, "vehicle_rto_state"), "Rajasthan");
assert.equal(field(sibling, "idv"), "145000");
assert.equal(field(sibling, "od_premium"), "3350");
assert.equal(field(sibling, "tp_premium"), "3400");
assert.equal(field(sibling, "cpa_premium"), "400");
assert.equal(field(sibling, "total_premium"), "7150");
assert.equal(field(sibling, "tax_amount"), "1287");
assert.equal(field(sibling, "gross_premium"), "8437");

const onboarding = buildPolicyOcrOnboardingUpdate({
  mode: "create",
  registrationMode: "registered",
  current: {
    registrationNo: "",
    insuredName: "",
    phoneNo: "",
    vehicleClass: "TWP",
    make: "",
    model: "",
    fuelType: "",
    manufacturingYear: "",
    capacity: "",
    chassisNo: "",
    engineNo: "",
    rtoState: "",
    rtoName: "",
    policyProduct: "",
    idv: "",
    od: "",
    tp: "",
    cpa: "",
    policyNo: "",
    insurerId: "",
    validFrom: "",
    validUpto: "",
  },
  fields: sibling.fields.map(({ key, label, value }) => ({ key, label, value })),
  manufacturers: ["EXAMPLE"],
  insurers: [{ value: "tata-aig", label: "TATA AIG General Insurance Company Limited" }],
  rcVerified: false,
});
assert.equal(onboarding.registrationMode, "unregistered");
assert.equal(onboarding.next.insuredName, "Ms. Sample Owner");
assert.equal(onboarding.next.phoneNo, "9876543210");
assert.equal(onboarding.next.fuelType, "Electric");
assert.equal(onboarding.next.rtoState, "Rajasthan");
assert.equal(onboarding.next.rtoName, "JAIPUR");
assert.equal(onboarding.next.od, "3350");
assert.equal(onboarding.next.tp, "3400");
assert.equal(onboarding.next.cpa, "400");
assert.equal(onboarding.next.validFrom, "2026-09-03");
assert.equal(onboarding.next.validUpto, "2027-09-02");

const mismatchShape = [...trainedShape];
mismatchShape[2] = mismatchShape[2].replace("Net Premium (A+B+C) ₹ 7,264.00", "Net Premium (A+B+C) ₹ 7,999.00");
const mismatch = run(mismatchShape);
assert.equal(field(mismatch, "od_premium"), undefined);
assert.equal(field(mismatch, "tp_premium"), undefined);
assert.match(mismatch.warnings.join(" "), /did not reconcile|withheld/i);

const unrelatedPages = [
  "EXAMPLE GENERAL INSURANCE COMPANY\nBundled Auto Secure - Two Wheeler Policy",
];
const unrelated = run(unrelatedPages);
assert.equal(unrelated.parserId, "generic_motor_v1");
assert.equal(unrelated.fields.length, 0);

console.log("TATA AIG bundled two-wheeler OCR regression: live-shape contamination, visible fields, identity safety, premiums, validity and onboarding mapping passed.");
