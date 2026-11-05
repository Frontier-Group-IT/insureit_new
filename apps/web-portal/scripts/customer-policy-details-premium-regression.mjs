import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/customer/(protected)/policies/[id]/page.tsx");
const copy = read("../app/customer/(protected)/policies/[id]/copy-policy-number.tsx");
const styles = read("../app/customer/(protected)/policies/[id]/policy-details.css");

assert.match(page, /resolveCustomerWebScope\(query\.account\)/, "Customer account scope must remain checked");
assert.match(page, /loadCustomerPolicyDetail\(account\.id, id, query\.source\)/, "External and internal policy source resolution remains intact");
assert.doesNotMatch(page, /Back to policies|<ArrowLeft/, "Do not add a redundant Back link above the hero");
assert.match(page, /<section aria-labelledby="policy-detail-title"/, "Policy header must be the first visible content");
assert.match(page, /getStaticInsurerLogo\(policy\.insurer_name\)/, "Use existing insurer logo mapping");
assert.match(page, /<CopyPolicyNumber value=\{policy\.policy_no\}/, "Policy number has a copy action");
assert.match(copy, /navigator\.clipboard\.writeText\(value\)/, "Copy action must write the actual number");
assert.match(copy, /catch \{[\s\S]*?setCopied\(false\)/, "Never claim copied if clipboard fails");
assert.match(page, /<CustomerAccountTabs accounts=\{accounts\} selectedId=\{account\.id\}/, "Preserve account tabs and scope");
assert.match(page, /policy\.vehicle_id \?/, "Only show linked vehicle navigation when a vehicle exists");
assert.match(page, /query: \{ account: account\.id \}/, "Linked vehicle navigation must retain customer account scope");
for (const target of ["policy-vehicle", "policy-coverage", "policy-premium", "policy-source"]) {
  assert.ok(page.includes('id="' + target + '"'), "Missing section " + target);
}
assert.match(page, /<details id="policy-source"/, "Secondary technical information is collapsible");
assert.match(page, /policy\.premium_amount == null \? "—"/, "Absent premiums must not be fabricated");
assert.match(page, /policy\.insured_declared_value == null \? "—"/, "Absent IDV must not be fabricated");
assert.doesNotMatch(page, /formatCustomerMoney\(policy\.premium_amount\)\s*\*\s*1\.18/, "No invented GST computation");
assert.match(styles, /prefers-reduced-motion: reduce/, "Respect reduced-motion preference");
assert.match(styles, /@keyframes customerPolicyDetailReveal/, "Subtle entry animation exists");
assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)/, "Hover effects only for hover-capable devices");
console.log("Customer policy premium detail page regression passed.");
