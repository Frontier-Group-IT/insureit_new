import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page = readFileSync("app/partner/policies/page.tsx", "utf8");
const columns = "grid-cols-[1.05fr_1.05fr_.9fr_1.05fr_.85fr_.62fr_.7fr_.82fr]";
assert.ok(page.includes("hidden " + columns), "Policy header must use the eight matching grid columns");
assert.ok(page.includes("xl:" + columns), "Policy rows must use the same eight columns as the header");
assert.doesNotMatch(page, /grid-cols-\[1\.05fr_1\.05fr_\.9fr_1\.05fr_\.85fr_\.62fr_\.7fr_\.82fr_42px\]/);
assert.doesNotMatch(page, /"Source",\s*"",/);
console.log("Partner Policy Register header and row alignment regression passed.");
