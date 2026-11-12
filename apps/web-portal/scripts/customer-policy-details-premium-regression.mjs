import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/customer/(protected)/policies/[id]/page.tsx");
const styles = read("../app/customer/(protected)/policies/[id]/policy-details.css");

assert.match(page, /resolveCustomerWebScope\(query\.account\)/, "Customer account scope must remain checked");
assert.match(page, /loadCustomerPolicyDetail\(account\.id, id, query\.source\)/, "External and internal policy source resolution remains intact");
assert.doesNotMatch(page, /Back to policies|<ArrowLeft/, "Do not add a redundant Back link above the hero");
assert.match(page, /<section aria-labelledby="policy-detail-title"/, "Policy header must be the first visible content");
assert.doesNotMatch(page, /<nav aria-label="Policy details sections"/, "Remove the lower section navigator entirely");
assert.doesNotMatch(page, /href="#policy-(vehicle|coverage|premium|source)"/, "No duplicate section jump links below the header");
assert.equal((page.match(/<StatusPill tone=\{status\.tone\}/g) ?? []).length, 1, "Only the hero should show the dynamic policy status");
assert.doesNotMatch(page, /rounded-full border border-white\/30 bg-white\/95/, "Remove the outer white status badge background from the hero");
assert.match(page, /<StatusPill tone=\{status\.tone\}>\{statusLabel\}<\/StatusPill>/, "Keep the dynamic Active/Due/Expired status label visible in the hero");

assert.match(page, /getStaticInsurerLogo\(policy\.insurer_name\)/, "Use existing insurer logo mapping");
assert.doesNotMatch(page, /CopyPolicyNumber/, "Policy hero must not offer a copy action");
const hero = page.slice(page.indexOf('<section aria-labelledby="policy-detail-title"'), page.indexOf('</section>', page.indexOf('<section aria-labelledby="policy-detail-title"')));
assert.match(hero, /id="policy-detail-title"[^>]*>\{policy\.policy_no\}<\/h1>/, "Keep policy number prominently visible");
assert.doesNotMatch(hero, /sourceName|policy\.policy_type|policy\.insurer_name/, "Hero excludes source, policy type and insurer subtitle");
assert.match(hero, /<StatusPill tone=\{status\.tone\}>\{statusLabel\}<\/StatusPill>/, "Keep policy status visible");
assert.match(page, /<CustomerAccountTabs accounts=\{accounts\} selectedId=\{account\.id\}/, "Preserve account tabs and scope");
assert.match(page, /policy\.vehicle_id \?/, "Only show linked vehicle navigation when a vehicle exists");
assert.match(page, /query: \{ account: account\.id \}/, "Linked vehicle navigation must retain customer account scope");
for (const target of ["policy-vehicle", "policy-coverage", "policy-premium", "policy-source"]) {
  assert.ok(page.includes('id="' + target + '"'), "Missing section " + target);
}
assert.match(page, /<details id="policy-source"/, "Secondary technical information is collapsible");
const data = read("../lib/customer-web-data.ts");
assert.match(page, /loadCustomerWebVehicles\(account\.id\)/, "Read linked vehicle through authorized customer account scope");
assert.match(page, /vehicle\.id === policy\.vehicle_id/, "Do not use a vehicle other than the policy-linked vehicle");
assert.match(data, /\.eq\("customer_id", customerId\)/, "Vehicle query remains customer-scoped");
assert.match(page, /<Detail label="Vehicle class" value=\{linkedVehicle\?\.vehicle_type\}/, "Display recorded vehicle class");
assert.match(page, /<Detail label="Manufacturing year" value=\{linkedVehicle\?\.year == null \? null : String\(linkedVehicle\.year\)\}/, "Display recorded manufacturing year");
assert.match(page, /<Detail label="Registration date" value=\{linkedVehicle\?\.registration_date \? formatCustomerDate\(linkedVehicle\.registration_date\) : null\}/, "Display recorded vehicle registration date without conflating policy issuance");
assert.match(page, /<Detail label="Chassis number" value=\{linkedVehicle\?\.chassis_no\}/, "Display recorded chassis number");
assert.match(page, /<Detail label="Engine number" value=\{linkedVehicle\?\.engine_no\}/, "Display recorded engine number");
for (const label of ["Vehicle class", "Manufacturing year", "Chassis number", "Engine number"]) {
  assert.doesNotMatch(page, new RegExp('<Detail label="' + label + '" value="—"'), "Remove hardcoded missing value for " + label);
}
assert.match(page, /<Detail label="Policy issuance date" value="—"/, "Do not treat vehicle registration date as policy issuance");
assert.match(page, /<Detail label="Product" value=\{policy\.policy_product \|\| policy\.business_line\}/, "Product stays sourced only from recorded policy fields");
assert.match(page, /policy\.premium_amount == null \? "—"/, "Absent premiums must not be fabricated");
assert.match(page, /policy\.insured_declared_value == null \? "—"/, "Absent IDV must not be fabricated");
assert.doesNotMatch(page, /formatCustomerMoney\(policy\.premium_amount\)\s*\*\s*1\.18/, "No invented GST computation");
assert.match(styles, /prefers-reduced-motion: reduce/, "Respect reduced-motion preference");
assert.match(styles, /@keyframes customerPolicyDetailReveal/, "Subtle entry animation exists");
assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)/, "Hover effects only for hover-capable devices");
console.log("Customer policy premium detail page regression passed.");
