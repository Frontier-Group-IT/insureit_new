import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const page = read("app/customer/(protected)/vehicles/[id]/page.tsx");
const row = read("app/customer/(protected)/vehicles/[id]/vehicle-insurance-history-row.tsx");
const src = [
  "my_vehicles.png", "vehicle_and_policy.png", "vehicle_register.png",
  "brand_new_vehicle.png", "e_challan.png", "policy_related.png",
];
for (const name of src) {
  assert(existsSync(fileURLToPath(new URL("public/assets/customer-3d-icons/" + name, root))), "Missing existing 3D artwork: " + name);
  assert(page.includes("/assets/customer-3d-icons/" + name), "Vehicle UI must reuse the existing " + name);
}
for (const heading of ["Vehicle Details", "Vehicle Ownership", "Vehicle Specification", "Compliance & Permit", "Insurance History"]) {
  assert(page.includes(heading), "Missing heading: " + heading);
}
assert(!page.includes("ArrowLeft"), "Redundant back arrow should be removed; breadcrumb supplies navigation");
assert(!page.includes("SectionIcon"), "Old circular section icons should be removed");
assert(!page.includes('padStart(2, "0")'), "Section number circles should not be rendered");
assert(!page.includes('>13</span>'), "Hardcoded history count should be removed");
assert(!page.includes('bg-[#F0F0FF]'), "Lavender section headers should be replaced with navy accents");
assert(page.includes('bg-[#EAF1FA]') && page.includes('text-[#17365F]'), "Section headers should use light navy and navy text");
assert(page.includes('getStaticInsurerLogo(policy.insurer_name)'), "Insurer logo must resolve using the existing asset map");
assert(page.includes('["Policy No.", "Insurer", "Valid Until", "Source", "Status"]'), "History table must have five columns without Action");
assert(page.includes('source: policy.source') && page.includes('account: account.id'), "Policy navigation must retain source and account scope");
assert(page.includes('customerPolicyTone(policy.end_date)'), "Policy status must keep the original status rules");
assert(page.includes('loadCustomerVehicleDetail(account.id, id)'), "Vehicle loading must retain customer-account authorization");
assert(row.includes('"use client"') && row.includes('role="link"') && row.includes('tabIndex={0}'), "Policy rows must be keyboard accessible");
assert(row.includes('event.key === "Enter"') && row.includes('event.key === " "'), "Keyboard Enter and Space should open a policy");
assert(row.includes('onClick={openPolicy}') && row.includes("router.push(href)"), "Entire row must be clickable");
assert(row.includes('insurerLogo') && row.includes('alt={insurerName}'), "Use insurer logo instead of visible insurer names");
assert(!row.includes('>View →</'), "Old Action link must be removed");
console.log("Customer vehicle navy, 3D headings and clickable insurance history regression passed.");
