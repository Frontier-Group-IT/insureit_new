import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync("app/customer/(protected)/claims/page.tsx", "utf8");
assert.match(source, /from\("customers"\)\.select\("id,phone"\)\.eq\("id", account\.id\)/, "Customer contact must be scoped to the selected authorized account and use phone");
assert.match(source, /customerContact\?\.phone/, "Customer mobile column must display the phone field");
assert.doesNotMatch(source, /customerContact\?\.mobile|customerContact\.mobile|select\("id,mobile"\)/, "Legacy nonexistent mobile column must not be referenced");
assert.match(source, /claim\.insurer_claim_no \|\| "Pending insurer claim number"/, "Missing insurer-issued claim numbers must have a clear label");
assert.match(source, /claim\.claim_no \|\| "—"/, "Internal control number must remain unchanged");
console.log("Customer Claims phone and missing insurer claim number regression passed");
