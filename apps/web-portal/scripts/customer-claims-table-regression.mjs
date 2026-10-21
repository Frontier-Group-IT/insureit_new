import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../app/customer/(protected)/claims/page.tsx", import.meta.url)), "utf8");
assert.match(source, /<table\s/, "Claims register should use a semantic table");
assert.match(source, /<thead/, "Table must have a heading row");
assert.match(source, /<tbody/, "Table must have rows");
assert.match(source, /after:absolute after:inset-0/, "Entire claim row should be clickable");
assert.match(source, /pathname: `\/customer\/claims\/\$\{claim\.id\}`/, "Keep existing claim detail route");
assert.match(source, /query: \{ account: account\.id \}/, "Preserve account-scoped navigation");
assert.match(source, /getStaticInsurerLogo\(claim\.insurer_name\)/, "Preserve insurer logo mapping");
assert.doesNotMatch(source, /\{claim\.insurer_name \|\| "—"\}/, "Do not show insurer name in register");
assert.doesNotMatch(source, />View claim\s*</, "No view-claim button");
assert.doesNotMatch(source, />Claim journey</, "No claim-journey section in register");
for (const token of ["CustomerClaimsSearch", "CustomerClaimsStageFilter", "Start a new claim", "Previous", "Next"]) assert.ok(source.includes(token), `Preserve ${token}`);
console.log("Customer Claims table layout checks passed");
