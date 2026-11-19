import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const page = readFileSync(new URL("../app/policies/life-health-cases/page.tsx", import.meta.url), "utf8");
const control = readFileSync(new URL("../components/life-health-line-filter.tsx", import.meta.url), "utf8");
assert.match(page, /lineFilter: BusinessLineFilter = params\?\.line === "life"/);
assert.match(page, /lineRows = lineFilter === "all" \? allRows/);
assert.match(page, /LifeHealthLineFilter line=\{lineFilter\} status=\{filter\}/);
assert.match(page, /lineRows\.map/);
assert.match(control, /<option value="all">All<\/option>/);
assert.match(control, /<option value="life">Life<\/option>/);
assert.match(control, /<option value="health">Health<\/option>/);
assert.match(control, /if \(status !== "pending"\) params\.set\("status", status\)/);
console.log("Life / Health register business-line filter contract passed");
