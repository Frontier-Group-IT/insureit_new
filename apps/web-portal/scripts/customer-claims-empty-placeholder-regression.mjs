import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const page = read("../app/customer/(protected)/claims/page.tsx");
const illustration = read("../public/assets/customer-claims/empty-state.svg");

assert.match(page, /rows\.length \? \(/, "Existing claim cards must remain the populated state.");
assert.match(page, /claims-motion-empty/, "Empty results must display the illustrated placeholder.");
assert.match(page, /src="\/assets\/customer-claims\/empty-state\.svg"/, "Use the new local empty-state illustration.");
assert.match(page, /claims\.length === 0 \? "No claims yet" : "No matching claims"/, "Distinguish no claims from a search/filter with no matches.");
assert.match(page, /Try another search or status filter\./, "Keep filter guidance for nonmatching searches.");
assert.match(page, /Showing \{filtered\.length/, "Keep pagination results and counts unchanged.");
assert.match(page, /<CustomerClaimsSearch/, "Preserve search controls.");
assert.match(page, /filterOptions\.map/, "Preserve status filtering.");
assert.match(page, /Start a New Claim/, "Preserve create-claim action.");
assert.match(page, /aria-hidden="true"/, "Illustration must remain decorative to screen readers.");
assert.match(illustration, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, "Local placeholder must be a valid SVG asset.");
assert.match(illustration, /No claims found/, "Illustration must describe claims.");
console.log("Customer Claims empty-state placeholder regression passed.");
