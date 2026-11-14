import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(resolve(root, "app/customer/(protected)/renewals/customer-renewals-register.tsx"), "utf8");
const art = readFileSync(resolve(root, "public/assets/customer-renewals/empty-state.svg"), "utf8");

assert.match(page, /const \[status,setStatus\]=useState\("all"\)/, "All Status must be the default");
assert.match(page, /categories\.find\(cat => cat\.due > 0\)\?\.key \?\? null/, "Expand only first category with due records");
assert.doesNotMatch(page, /categories\[0\]\?\.key \?\? \(items\.length \? "__other__" : null\)/, "Expired-only categories must remain collapsed by default");
assert.match(page, /status==="expired"\?item\.daysUntil<0:item\.daysUntil>=0&&item\.daysUntil<=45/, "Existing due/expired logic must remain");
assert.match(page, /onClick=\{\(\) => setActiveCategory\(selected \? null : cat\.key\)\}/, "Categories must remain interactive");
assert.match(page, /<option value="all">All Status<\/option><option value="due">Due<\/option><option value="expired">Expired<\/option>/, "Status choices must remain");
assert.match(page, /cat\.records\.length \? <div className="overflow-x-auto">/, "Show table only for populated categories");
assert.match(page, /: emptyState\}/, "Render illustrated empty category state");
assert.match(page, /!selectedGroup && !groups\.filtered\.length/, "Render global empty state when categories absent");
assert.match(page, /query\.trim\(\)\s*\? "No renewals match your search"/, "Search empty state must differ from zero pending");
assert.match(page, /You're all caught up!/, "Show friendly pending-empty headline");
assert.match(page, /src="\/assets\/customer-renewals\/empty-state\.svg"/, "Use local illustration");
assert.match(art, /<svg[^>]+viewBox="0 0 340 245"/);
assert.match(art, /Renewals complete/);
assert.match(page, /onClick=\{\(\) => setActiveCategory\(selected \? null : cat\.key\)\}/, "Manual category toggle preserved");
console.log("Customer Renewals All Status due-category auto-expand and empty-illustration regression passed");
