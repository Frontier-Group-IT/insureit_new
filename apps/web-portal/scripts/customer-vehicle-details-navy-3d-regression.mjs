import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const page = read("app/customer/(protected)/vehicles/[id]/page.tsx");
const row = read("app/customer/(protected)/vehicles/[id]/vehicle-insurance-history-row.tsx");
const src = [
  "my_vehicles.png", "vehicle_register.png",
  "brand_new_vehicle.png", "e_challan.png", "policy_related.png",
];
for (const name of src) {
  assert(existsSync(fileURLToPath(new URL("public/assets/customer-3d-icons/" + name, root))), "Missing existing 3D artwork: " + name);
  assert(page.includes("/assets/customer-3d-icons/" + name), "Vehicle UI must reuse the existing " + name);
}
for (const heading of ["Vehicle Details", "Vehicle Ownership", "Vehicle Specification", "Compliance & Permit", "Insurance History"]) {
  assert(page.includes(heading), "Missing heading: " + heading);
}
assert(!page.includes("vehicle_and_policy.png"), "Right-side header vehicle illustration should be removed");
assert(!page.includes("ChevronDown") && !page.includes("section.icons") && !page.includes("<Icon "), "Read-only vehicle details must not show leading icons or dropdown chevrons");
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

// Customer Vehicle Register: 8 distinct columns, accessible logos, aligned policy rows.
const register = read("app/customer/(protected)/vehicles/customer-vehicles-register.tsx");
const vehiclesPage = read("app/customer/(protected)/vehicles/page.tsx");
assert.match(register, /\["Vehicle", "Make", "Model", "Type", "Chassis No\.", "Engine No\.", "Policy No\.", "Insurer"\]/, "Separate Make/Model and Policy Number/Insurer columns");
assert.doesNotMatch(register, /"Make \/ Model"|"Policy"\]\.map\(heading/, "Old combined headings must not return");
assert.match(register, /<td colSpan=\{8\}/, "Empty state spans all eight columns");
assert.match(register, /<ManufacturerMark make=\{v\.make\}\/>/, "Make cell shows only the existing manufacturer mark");
assert.match(register, /<td className="px-3 py-3 text-left"><strong className="block truncate whitespace-nowrap/, "Model must be left-aligned, single-line and truncated");
assert.match(register, /title=\{v\.model \|\| undefined\}/, "Long model retains its complete hover title");
assert.match(register, /<td className="px-3 py-2 text-left text-\[12px\]/, "Policy numbers must be left-aligned");
assert.match(register, /<span className="whitespace-nowrap" title=\{p\.number\}>\{p\.number\}<\/span>/, "Full policy numbers remain on one line");
assert.match(register, /v\.policies\.map\(\(p,index\) =>/g, "Multiple policies have matching row order across number and icon cells");
assert.match(register, /getInsurerLogo\(p\.insurerName\)/, "Insurer column only displays existing insurer logo");
assert.match(register, /alt=\{\x60\$\{p\.insurerName \|\| "Unknown insurer"\} logo\x60\}/, "Insurer logo remains accessible");
assert.match(register, /const pageSize = 6;/, "Pagination size remains unchanged");
assert.match(register, /setStatusFilter\(e\.target\.value\)/, "Vehicle status filter remains unchanged");
assert.match(register, /onClick=\{\(\) => openVehicle\(v\.id\)\}/, "Clicking a register row still navigates to vehicle details");
assert.match(vehiclesPage, /loadCustomerWebVehicles\(account\.id\)/, "Vehicle data remains scoped to selected customer");
console.log("Customer vehicle navy, 3D headings and clickable insurance history regression passed.");
