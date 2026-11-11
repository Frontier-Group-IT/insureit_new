import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const layout = read("../app/customer/(protected)/layout.tsx");
const css = read("../app/customer/(protected)/customer-full-height.css");
const claims = read("../app/customer/(protected)/claims/page.tsx");
const vehicles = read("../app/customer/(protected)/vehicles/customer-vehicles-register.tsx");
const vehiclePage = read("../app/customer/(protected)/vehicles/page.tsx");
const policies = read("../app/customer/(protected)/policies/page.tsx");
const pages = [
  "../app/customer/(protected)/home/page.tsx",
  "../app/customer/(protected)/vehicles/page.tsx",
  "../app/customer/(protected)/policies/page.tsx",
  "../app/customer/(protected)/renewals/page.tsx",
  "../app/customer/(protected)/claims/page.tsx",
  "../app/customer/(protected)/exchange/page.tsx",
  "../app/customer/(protected)/insurance-quote/page.tsx",
  "../app/customer/(protected)/e-challan/page.tsx",
  "../app/customer/(protected)/support/page.tsx",
  "../app/customer/(protected)/profile/page.tsx",
  "../app/customer/(protected)/settings/page.tsx",
  "../app/customer/(protected)/claims/[id]/page.tsx",
  "../app/customer/(protected)/vehicles/[id]/page.tsx",
  "../app/customer/(protected)/policies/[id]/page.tsx",
];
for (const path of pages) assert.ok(read(path).length > 0, `Missing Customer Portal page ${path}`);
assert.match(layout, /import "\.\/customer-full-height\.css"/, "Shared page height stylesheet must load for all protected Customer routes");
assert.match(layout, /customer-viewport-main/, "Customer main must fill viewport");
assert.match(layout, /customer-viewport-content/, "Customer page container must stretch");
assert.match(css, /min-height:\s*calc\(100dvh - 66px\)/, "Dynamic viewport height should account for shared header");
assert.match(css, /\.customer-viewport-content > \*/, "All customer pages should share viewport-height behavior");
assert.doesNotMatch(css, /height:\s*(?:100vh|100dvh)/, "Never fix page height: long pages must grow and scroll");
assert.doesNotMatch(css, /overflow:\s*hidden/, "Shared layout must not clip lengthy pages");
for (const [name, source, marker] of [
  ["Claims", claims, "customer-claims-page"],
  ["Vehicles", vehicles, "customer-vehicles-page"],
  ["Policies", policies, "customer-policies-page"],
]) assert.ok(source.includes(marker), `${name} register is missing full-height styling hook`);
assert.match(css, /\.customer-claims-page \.claims-motion-pagination\s*\{\s*margin-top:\s*auto/, "Claims pagination must sit at panel bottom");
assert.match(css, /\.customer-vehicles-page > \.customer-register-panel > footer/, "Vehicle pagination must sit at panel bottom");
assert.match(css, /\.customer-policies-page > \.customer-register-panel > p:last-child/, "Policy summary footer must sit at panel bottom");
assert.match(claims, /filtered\.slice\(\(page - 1\) \* PAGE_SIZE, page \* PAGE_SIZE\)/, "Claim pagination data must remain unchanged");
assert.match(vehiclePage, /flex min-h-0 flex-1 flex-col gap-3/, "Vehicle page wrapper must stretch its register to available viewport height");
assert.match(vehicles, /border-collapse text-center/, "Vehicle columns must be centered");
assert.match(vehicles, /items-center justify-center gap-2 py-1\.5/, "Policy logo and number must be inline and centered");
assert.doesNotMatch(vehicles, /p\.status ===|Insurer not specified/, "Vehicle register must not render policy status or insurer names");
assert.match(vehicles, /Showing \{rows\.length/, "Vehicle pagination data must remain unchanged");
assert.match(policies, /Showing \{sourceFilteredRows\.length\}/, "Policy record counts must remain unchanged");
console.log("Customer Portal full-height layout regression passed.");
