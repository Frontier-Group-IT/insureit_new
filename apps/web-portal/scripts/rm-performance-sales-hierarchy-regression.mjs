import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "lib/rm-performance.ts"), "utf8");
const summary = readFileSync(resolve(process.cwd(), "app/rm-performance/rm-hierarchy-summary.tsx"), "utf8");
const match = source.match(/const isSalesHead = (\/.*?\/[a-z]*)\.test\(person\.designation \?\? ""\)/);
assert.ok(match, "Verified sales hierarchy ancestor guard must exist");
const designation = new RegExp(match[1].slice(1, match[1].lastIndexOf("/")), match[1].slice(match[1].lastIndexOf("/")+1));
for (const title of ["Regional Head", "ZONAL HEAD", "HEAD MOTORS", "Agency Manager", "Cluster Manager", "Relationship Manager", "Sales Head"]) {
  assert.ok(designation.test(title), title + " must remain in the sales reporting tree");
}
for (const title of ["CEO", "DIRECTOR", "Accounts"]) {
  assert.ok(!designation.test(title), title + " must not be introduced as an automatic sales ancestor");
}
assert.ok(source.includes("parentId = person.reporting_manager_id"), "Ancestor lookup must continue recursively");
assert.ok(summary.includes("childrenByManager.set(row.managerId"), "Display must use verified manager IDs");
assert.ok(summary.includes("const roots=rows.filter"), "Outer layer must contain only roots");
console.log("RM Performance sales hierarchy regression passed");
