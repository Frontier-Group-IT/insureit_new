import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPolicyOcrOnboardingUpdate } from "../lib/policy-ocr-onboarding-apply.ts";

// Clear-form regression intentionally verifies parent-owned reset behavior.
const here = path.dirname(fileURLToPath(import.meta.url));
const panel = fs.readFileSync(path.join(here, "../components/policy-ocr-import-panel.tsx"), "utf8");
const form = fs.readFileSync(path.join(here, "../components/policy-unified-form.tsx"), "utf8");
const mapper = fs.readFileSync(path.join(here, "../lib/policy-ocr-onboarding-apply.ts"), "utf8");

const regexChecks = [
  ["Section 02 field contract is exported", panel, /export const SECTION_02_OCR_FIELDS = \[[\s\S]*vehicle_registration_number[\s\S]*vehicle_chassis_number[\s\S]*vehicle_engine_number/],
  ["Section 03 field contract is exported", panel, /export const SECTION_03_OCR_FIELDS = \[[\s\S]*policy_product[\s\S]*idv[\s\S]*od_premium[\s\S]*tp_premium[\s\S]*policy_end_date/],
  ["CPA opted remains verification-only", panel, /const VERIFICATION_FIELDS = new Set\(\["cpa_opted"/],
  ["Current-vs-extracted review remains", panel, /Current<\/span>[\s\S]*Extracted<\/span>[\s\S]*Status<\/span>/],
  ["Panel delegates application to parent", panel, /const outcome = await onApply\(chosen\)/],
  ["Importer receives current form context", form, /context=\{ocrImportContext\}[\s\S]*onApply=\{applyPolicyOcrFields\}/],
  ["Shared importer moved to onboarding header", form, /variant="header" context=\{ocrImportContext\}/],
  ["RC verified Section 02 is explicitly protected", form, /protectedKeys:appliedRc\?\[\.\.\.SECTION_02_OCR_FIELDS\]:\[\]/],
  ["Edit or RC state protects Section 02 in mapper", mapper, /section02Protected = input\.mode === "edit" \|\| input\.rcVerified/],
  ["Class dependency updates are atomic", mapper, /if \(changed && !byKey\.has\("vehicle_capacity"\)\) next\.capacity = "";[\s\S]*if \(changed && !byKey\.has\("policy_product"\)\) next\.policyProduct = "";/],
  ["CPA amount does not set owner-driver opted state", mapper, /cpa_premium can include paid-driver\/workmen liability additions[\s\S]*next\.cpa = value/],
  ["Clear form is delegated to parent", panel, /onClearForm\?: \(\) => void[\s\S]*onClearForm\?\.\(\)/],
  ["OCR panel no longer owns onboarding draft storage", panel, /PolicyOcrImportPanel/],
  ["Parent owns complete create-form reset", form, /function clearPolicyForm\(\)\{[\s\S]*sessionStorage\.removeItem\(POLICY_DRAFT_KEY\)[\s\S]*setForm\((?:stateFrom\(initialValues\)|\{\.\.\.stateFrom\(initialValues\),businessLine:"Motor"\})\)[\s\S]*setVehicleRegistrationMode\("registered"\)[\s\S]*setAppliedRc\(null\)[\s\S]*setPendingPayload\(null\)/],
  ["Fresh create reset keeps Motor as default", form, /setForm\(\{\.\.\.stateFrom\(initialValues\),businessLine:"Motor"\}\)/],
  ["Header wires parent reset callback", form, /onClearForm=\{clearPolicyForm\}/],
  ["Payin-Payout is integrated into summary rail", form, /function LiveSummary\([\s\S]*Payin–Payout[\s\S]*Insurer Pay-in[\s\S]*Partner Payout/],
  ["Summary rail restored to wider desktop width", form, /xl:grid-cols-\[minmax\(0,1fr\)_336px\]/],
  ["Compact policy title row", form, /min-h-\[52px\][\s\S]*text-\[15px\][\s\S]*\{headerTitle\}/],
  ["Compact section navigation", form, /aria-label="Policy sections"[\s\S]*min-h-\[36px\][\s\S]*aria-current=\{active\?"step":undefined\}/],
  ["Section navigation removes visible remaining counters", form, /String\(index\+1\)\.padStart\(2,"0"\)/],
];

for (const [name, source, pattern] of regexChecks) {
  if (!pattern.test(source)) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}

if (!form.includes("const result=buildPolicyOcrOnboardingUpdate({")) throw new Error("FAIL: parent must use pure onboarding mapper");
if (!form.includes("setForm(current=>({...current,...result.next}));")) throw new Error("FAIL: parent must commit mapper output in one React state update");
console.log("PASS: parent uses pure mapper and one atomic React state commit");

for (const forbidden of ["findControl(", "setNativeValue(", "control.disabled = false", "document.querySelector("]) {
  if (panel.includes(forbidden)) throw new Error(`FAIL: panel must not mutate onboarding controls via DOM (${forbidden})`);
}
console.log("PASS: popup contains no DOM-based form mutation path");

if (panel.includes('insureit:policy-onboarding:draft:v1')) throw new Error("FAIL: OCR panel must not own an obsolete onboarding draft key");
if (panel.includes('window.location.reload()')) throw new Error("FAIL: clear form must not rely on full-page reload");
console.log("PASS: clear form reset is parent-owned and reload-free");

if (form.includes("function CommercialCard")) throw new Error("FAIL: legacy full-width Commercials card must not remain");
if (form.includes(">Commercials<")) throw new Error("FAIL: user-facing Commercials label must be replaced by Payin-Payout");
console.log("PASS: Payin-Payout controls live only in the compact summary rail");

if (form.includes('left</span>')) throw new Error("FAIL: visible remaining-field counters must not remain in compact section navigation");
if (form.includes('min-h-[88px]')) throw new Error("FAIL: oversized policy header height must not remain");
console.log("PASS: policy header and section navigation are compact and progress-noise free");


const blank = {
  registrationNo: "",
  vehicleClass: "",
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
};

const field = (key, value, label = key) => ({ key, value, label });
const manufacturers = ["TATA", "KIA", "BMW"];
const insurers = [
  { value: "ins-newindia", label: "The New India Assurance Company Limited" },
  { value: "ins-national", label: "National Insurance Company Limited" },
];

const newVehicle = buildPolicyOcrOnboardingUpdate({
  mode: "create",
  registrationMode: "registered",
  current: { ...blank, registrationNo: "MP20AA1234" },
  manufacturers,
  insurers,
  rcVerified: false,
  fields: [
    field("vehicle_registration_status", "registration_pending", "Registration status"),
    field("vehicle_registration_number", "VEHICLE", "Registration number"),
    field("vehicle_class", "Goods Carrying Vehicle", "Class"),
    field("vehicle_make", "TATA MOTORS", "Make"),
    field("vehicle_model", "ACE GOLD", "Model"),
    field("vehicle_fuel_type", "DIESEL", "Fuel"),
    field("vehicle_manufacturing_year", "2026", "Year"),
    field("vehicle_capacity", "1815 KG", "Capacity"),
    field("vehicle_chassis_number", "SYNCHASSIS001", "Chassis"),
    field("vehicle_engine_number", "SYNENGINE001", "Engine"),
    field("policy_product", "Package Policy", "Product"),
    field("policy_number", "SYN-POLICY-001", "Policy number"),
    field("insurer_name", "New India Assurance", "Insurer"),
    field("idv", "610000", "IDV"),
    field("policy_start_date", "21/08/2026", "Valid from"),
    field("policy_end_date", "20/08/2027", "Valid upto"),
  ],
});
if (newVehicle.registrationMode !== "unregistered" || newVehicle.next.registrationNo !== "") throw new Error("FAIL: registration-pending OCR must switch to unregistered and clear permanent registration");
if (newVehicle.next.vehicleClass !== "GCV" || newVehicle.next.capacity !== "1815" || newVehicle.next.policyProduct !== "Package") throw new Error("FAIL: class, capacity and policy product must survive one atomic update");
if (newVehicle.next.make !== "TATA" || newVehicle.next.chassisNo !== "SYNCHASSIS001" || newVehicle.next.engineNo !== "SYNENGINE001") throw new Error("FAIL: sanitized Section 02 values were not normalized into form state");
if (newVehicle.next.insurerId !== "ins-newindia" || newVehicle.next.policyNo !== "SYN-POLICY-001" || newVehicle.next.idv !== "610000") throw new Error("FAIL: Section 03 policy identity values were not mapped");
if (newVehicle.next.validFrom !== "2026-08-21" || newVehicle.next.validUpto !== "2027-08-20") throw new Error("FAIL: policy validity dates were not normalized");
console.log("PASS: registration-pending OCR updates vehicle + policy atomically");

const existingRc = buildPolicyOcrOnboardingUpdate({
  mode: "create",
  registrationMode: "registered",
  current: { ...blank, registrationNo: "MP20AA1234", vehicleClass: "GCV", make: "TATA", model: "ACE" },
  manufacturers,
  insurers,
  rcVerified: true,
  fields: [
    field("vehicle_registration_number", "MP20ZZ9999"),
    field("vehicle_make", "BMW"),
    field("vehicle_model", "X5"),
    field("policy_product", "Third Party"),
    field("policy_number", "SYN-POLICY-002"),
    field("insurer_name", "National Insurance"),
    field("tp_premium", "15400"),
  ],
});
if (existingRc.next.registrationNo !== undefined || existingRc.next.make !== undefined || existingRc.next.model !== undefined) throw new Error("FAIL: verified RC Section 02 must be protected from OCR overwrite");
if (existingRc.next.policyProduct !== "Third Party" || existingRc.next.policyNo !== "SYN-POLICY-002" || existingRc.next.insurerId !== "ins-national" || existingRc.next.tp !== "15400") throw new Error("FAIL: Section 03 must remain applicable when RC is verified");
console.log("PASS: verified RC protects Section 02 while Section 03 stays importable");

const edited = buildPolicyOcrOnboardingUpdate({
  mode: "edit",
  registrationMode: "registered",
  current: { ...blank, registrationNo: "MP20AA1234", vehicleClass: "GCV", make: "TATA", model: "ACE", capacity: "1815", chassisNo: "EXISTCHASSIS", engineNo: "EXISTENGINE" },
  manufacturers,
  insurers,
  rcVerified: false,
  fields: [
    field("vehicle_registration_status", "registration_pending"),
    field("vehicle_registration_number", "VEHICLE"),
    field("vehicle_class", "Private Car"),
    field("vehicle_make", "BMW"),
    field("vehicle_capacity", "1998 CC"),
    field("vehicle_chassis_number", "NEWCHASSIS"),
    field("vehicle_engine_number", "NEWENGINE"),
    field("policy_product", "Package"),
    field("policy_number", "SYN-POLICY-003"),
    field("od_premium", "12000"),
  ],
});
if (edited.registrationMode !== "registered") throw new Error("FAIL: edit OCR must not change registration mode");
for (const key of ["registrationNo", "vehicleClass", "make", "capacity", "chassisNo", "engineNo"]) {
  if (edited.next[key] !== undefined) throw new Error(`FAIL: edit OCR must protect Section 02 field ${key}`);
}
if (edited.next.policyProduct !== "Package" || edited.next.policyNo !== "SYN-POLICY-003" || edited.next.od !== "12000") throw new Error("FAIL: edit OCR must still allow Section 03 updates");
console.log("PASS: edit-mode OCR cannot mutate linked vehicle identity");

const cpaReference = buildPolicyOcrOnboardingUpdate({
  mode: "create",
  registrationMode: "registered",
  current: { ...blank, vehicleClass: "GCV" },
  manufacturers,
  insurers,
  rcVerified: false,
  fields: [
    field("cpa_opted", "No", "CPA opted"),
    field("cpa_premium", "75", "CPA / IMT premium"),
  ],
});
if (cpaReference.next.cpa !== "75") throw new Error("FAIL: CPA amount should remain importable as a Section 03 reference");
if ("cpaOpted" in cpaReference.next) throw new Error("FAIL: CPA opted must not be written from policy PDF OCR");
console.log("PASS: CPA amount imports without changing owner-driver opted state");

console.log("Policy onboarding OCR import regression passed.");
