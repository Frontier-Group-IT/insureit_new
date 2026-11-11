import assert from "node:assert/strict";
// @ts-expect-error direct TypeScript import in Node strip-types regression.
import { refineIcici3005Section02Evidence } from "../lib/policy-ocr-icici-3005-section02.ts";
// @ts-expect-error direct TypeScript import in Node strip-types regression.
import { buildPolicyOcrOnboardingUpdate } from "../lib/policy-ocr-onboarding-apply.ts";
import { readFileSync } from "node:fs";

const pages = [
  `Product Code: 3005 UIN: TEST
ICICI Lombard General Insurance Company Limited
Insured & Vehicle Details
Name of Insured                              SAMPLE INSURED
Period of Insurance - Own Damage             Nov 06, 2026 to Nov 05, 2027
Vehicle Make / Model                         CHETAK / C3001
RTO City                                     MADHYA PRADESH-JABALPUR
Vehicle Registration No.                     NEW
Vehicle Registration Date                    Nov 06, 2026
Engine No.                                   E20TEST41667
Chassis No.                                  TESTCHASSIS123456`,
  `CERTIFICATE OF INSURANCE CUM POLICY SCHEDULE
Bundled – Two Wheeler Policy
Product Code: 3005 UIN: TEST
Vehicle Registration      Make         Model             Type of Body       CC/KW          Mfg Yr          Seating       Chassis No.      Engine No.
No.                                                                                       Capacity
NEW                       CHETAK       C3001             Solo With Pillion     4.2            2026            2           TESTCHASSIS     E20TEST41667
Vehicle IDV                Side Car Additional Accessories  Total IDV
Basic OD Premium       1,758.00 Basic Third Party Liability 3,273.00
PA Cover for Owner Driver 575.00
Total Package Premium(A+B): 5,606.00`,
];
const protectedData = [
  ["vehicle_make", "CHETAK"],
  ["vehicle_model", "C3001"],
  ["vehicle_chassis_number", "TESTCHASSIS123456"],
  ["vehicle_engine_number", "E20TEST41667"],
  ["vehicle_capacity", "2"],
  ["policy_number", "SYNTHETIC-3005"],
  ["insurer_name", "ICICI Lombard General Insurance Company Limited"],
  ["policy_product", "Bundled"],
  ["idv", "114459"],
  ["od_premium", "1758"],
  ["tp_premium", "3273"],
  ["cpa_premium", "575"],
  ["policy_start_date", "2026-11-06"],
  ["policy_end_date", "2027-11-05"],
].map(([key, value]) => ({key, label: key, value, confidence: .99, page: 1, evidence: "protected baseline"}));
const parsed = { parserId: "icici_lombard_motor_v1", parserVersion: "icici_lombard_motor_v1.0.0", fields: [
  ...protectedData,
  { key: "vehicle_rto_name", label: "RTO name", value: "MADHYA PRADESH-JABALPUR", confidence: .99, page: 1, evidence: "source" },
], warnings: [] };
const field = (r, key) => r.fields.find((x) => x.key === key);
const value = (r, key) => field(r,key)?.value;
const result = refineIcici3005Section02Evidence(pages, parsed);
assert.equal(value(result, "vehicle_registration_status"), "registration_pending");
assert.equal(value(result, "vehicle_registration_number"), undefined);
assert.equal(value(result, "insured_name"), "SAMPLE INSURED");
assert.equal(value(result, "vehicle_class"), "TWP");
assert.equal(value(result, "vehicle_fuel_type"), "Electric");
assert.equal(value(result, "vehicle_manufacturing_year"), "2026");
assert.equal(value(result, "vehicle_rto_state"), "Madhya Pradesh");
assert.equal(value(result, "vehicle_rto_name"), "JABALPUR");
assert.equal(value(result, "vehicle_motor_power_kw"), "4.2");
assert.equal(value(result, "insured_phone"), undefined);
for (const original of protectedData) {
  assert.deepEqual(field(result,original.key),original, "working field changed: "+original.key);
}
assert.equal(value(result,"vehicle_capacity"),"2","seating evidence must not be rewritten in OCR");

// The generic parser returns Bundled at .82, below the review panel's
// .90 automatic-selection threshold. Explicit product-3005 heading must
// promote it without changing unrelated OCR fields or registration status.
const lowConfidence = {
  ...parsed,
  fields: parsed.fields.map((item) => item.key === "policy_product"
    ? { ...item, confidence: .82, evidence: "generic inferred product" }
    : item),
};
const promoted = refineIcici3005Section02Evidence(pages, lowConfidence);
assert.equal(value(promoted, "policy_product"), "Bundled");
assert.equal(field(promoted, "policy_product").confidence, .99);
assert.equal(field(promoted, "policy_product").page, 2);
assert.match(field(promoted, "policy_product").evidence, /Bundled\\s*[-–—]?\\s*Two\\s+Wheeler\\s+Policy/i);
assert.ok(field(promoted, "policy_product").confidence >= .9, "Must pass review panel auto-selection threshold");
assert.equal(value(promoted, "vehicle_registration_status"), "registration_pending");
assert.equal(value(promoted, "vehicle_registration_number"), undefined);

const missingProduct = { ...parsed, fields: parsed.fields.filter((item) => item.key !== "policy_product") };
assert.equal(value(refineIcici3005Section02Evidence(pages, missingProduct), "policy_product"), "Bundled");
const genericMisclassification = {
  ...parsed, fields: parsed.fields.map((item) => item.key === "policy_product"
    ? { ...item, value: "Third Party", confidence: .82 } : item),
};
assert.equal(value(refineIcici3005Section02Evidence(pages, genericMisclassification), "policy_product"), "Bundled");

// A document without the exact heading must not have its product rewritten.
const noBundledHeading = [pages[0], pages[1].replace("Bundled – Two Wheeler Policy", "Two Wheeler Policy")];
assert.equal(refineIcici3005Section02Evidence(noBundledHeading, lowConfidence), lowConfidence);

const current = {
  registrationNo: "MP20AB1234", insuredName: "", phoneNo: "",
  vehicleClass: "", make: "", model: "", fuelType: "", manufacturingYear: "",
  capacity: "", chassisNo: "", engineNo: "", rtoState: "", rtoName: "",
  policyProduct: "", policyNo: "", insurerId: "", idv: "", od: "", tp: "", cpa: "",
  validFrom: "", validUpto: "",
};
const applied = buildPolicyOcrOnboardingUpdate({
  mode: "create", registrationMode: "registered", current, rcVerified: false,
  manufacturers: ["Bajaj Auto Limited", "Tata Motors"],
  insurers: [{value: "ins-icici",label: "ICICI Lombard General Insurance Company Limited"}],
  fields: result.fields,
});
assert.equal(applied.registrationMode, "unregistered");
assert.equal(applied.next.registrationNo, "");
assert.equal(applied.next.insuredName, "SAMPLE INSURED");
assert.equal(applied.next.phoneNo, "");
assert.equal(applied.next.vehicleClass, "TWP");
assert.equal(applied.next.make, "Bajaj Auto Limited");
assert.equal(applied.next.model, "C3001");
assert.equal(applied.next.fuelType, "Electric");
assert.equal(applied.next.manufacturingYear, "2026");
assert.equal(applied.next.rtoState, "Madhya Pradesh");
assert.equal(applied.next.rtoName, "JABALPUR");
assert.equal(applied.next.capacity, "4.2", "2 seats must not become 2 kW");
assert.equal(applied.next.policyProduct, "Bundled");
assert.equal(applied.next.idv, "114459");
assert.equal(applied.next.od, "1758");
assert.equal(applied.next.tp, "3273");
assert.equal(applied.next.cpa, "575");
assert.equal(applied.next.validFrom, "2026-11-06");
assert.equal(applied.next.validUpto, "2027-11-05");

// Existing vehicle/edit mode must never overwrite protected section-02 data.
const rcProtected = buildPolicyOcrOnboardingUpdate({
  mode: "create", registrationMode: "registered",
  current: { ...current, make:"Tata Motors", model:"SAFE", insuredName:"EXISTING", registrationNo:"MP20XY4321" },
  rcVerified:true, manufacturers:["Bajaj Auto Limited","Tata Motors"],
  insurers:[], fields:result.fields,
});
assert.equal(rcProtected.registrationMode,"registered");
assert.equal(rcProtected.next.make,"Tata Motors");
assert.equal(rcProtected.next.model,"SAFE");
assert.equal(rcProtected.next.insuredName,"EXISTING");
assert.equal(rcProtected.next.registrationNo,"MP20XY4321");

// Registered policy must not be auto-switched to unregistered.
const registered = refineIcici3005Section02Evidence(
  [pages[0].replace("Vehicle Registration No.                     NEW",
    "Vehicle Registration No.                     MP20AB1234"), pages[1]],
  parsed
);
assert.equal(value(registered,"vehicle_registration_status"),undefined);

// Missing native schedule row must not invent year or motor kW.
const absentTable = refineIcici3005Section02Evidence([pages[0],pages[1].replace(/NEW\s+CHETAK\s+C3001\s+Solo With Pillion\s+4\.2\s+2026\s+2/,"UNKNOWN ROW")],parsed);
assert.equal(value(absentTable,"vehicle_manufacturing_year"),undefined);
assert.equal(value(absentTable,"vehicle_motor_power_kw"),undefined);

// Non-matching policies must be unchanged (same object, not just same values).
assert.equal(refineIcici3005Section02Evidence([pages[0].replace("3005","3003"),pages[1]],parsed),parsed);
assert.equal(refineIcici3005Section02Evidence([pages[0].replace("ICICI Lombard","IFFCO Tokio"),pages[1]],parsed),parsed);
const differentParser = {...parsed,parserId:"generic_motor_v1"};
assert.equal(refineIcici3005Section02Evidence(pages,differentParser),differentParser);

// Enforce that the review panel offers motor-power evidence and that
// both OCR pathways include native-PDF identity recovery.
const review = readFileSync(new URL("../components/policy-ocr-import-panel.tsx",import.meta.url),"utf8");
const main = readFileSync(new URL("../app/policies/policy-ocr-actions.ts",import.meta.url),"utf8");
const intake = readFileSync(new URL("../lib/policy-intake-ocr-service.ts",import.meta.url),"utf8");
assert.ok(review.includes('"vehicle_motor_power_kw"'));
assert.ok(main.includes("refineIcici3005Section02Evidence("));
assert.ok(intake.includes("refineIcici3005Section02Evidence("));
assert.ok(intake.includes(String.raw`/ICICI\s+LOMBARD/i`),"Policy Intake needs valid ICICI native PDF guard");
console.log("ICICI 3005 section02 and section03 OCR-only mapping and non-regression passed");
