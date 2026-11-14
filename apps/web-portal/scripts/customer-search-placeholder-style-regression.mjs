import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => readFileSync(resolve(root, path), "utf8");

const animated = read("components/customer-portal/customer-animated-search-input.tsx");
assert.match(animated, /pointer-events-none absolute inset-0 z-0 flex items-center overflow-hidden text-\[11px\] font-normal text-\[#9BA9C0\]/, "Animated hint layer must use Renewals 11px regular and #9BA9C0");
assert.match(animated, /value=\{text\}/, "Typed input value remains controlled");
assert.match(animated, /onChange=\{event =>/, "Search interaction remains unchanged");
assert.match(animated, /prefers-reduced-motion: reduce/, "Reduced-motion support remains");

assert.match(animated, /type="text"/, "Shared Customer search uses text input to suppress native browser clear controls");
assert.match(animated, /inputMode="search"/, "Keep the search keyboard on mobile");
assert.match(animated, /input:focus, input:focus-visible/, "Inner field focus styling remains suppressed");
assert.doesNotMatch(animated, /type="search"/, "Browser-native search clear icon must not render");
const autocomplete = read("components/customer-portal/customer-search-autocomplete.tsx");
assert.ok(!autocomplete.includes('aria-label="Clear search"') && !autocomplete.includes('<X ') && !autocomplete.includes('import { X }'), "No manual clear button in shared Customer autocomplete");
assert.ok(autocomplete.includes("onChange(event.target.value)"), "Typed search and filtering remain connected");

const renewals = read("app/customer/(protected)/renewals/customer-renewals-register.tsx");
assert.match(renewals, /placeholder:text-\[11px\] placeholder:font-normal placeholder:text-\[#9BA9C0\]/, "Native Renewals input must match the reference exactly");

const consumers = [
  "app/customer/(protected)/policies/customer-policy-animated-search.tsx",
  "app/customer/(protected)/vehicles/customer-vehicles-register.tsx",
  "app/customer/(protected)/claims/customer-claims-search.tsx",
  "app/customer/(protected)/exchange/page.tsx",
  "app/customer/(protected)/support/page.tsx",
  "components/customer-portal/customer-exchange-sell-workspace.tsx",
];
for (const path of consumers) {
  assert.match(read(path), /CustomerAnimatedSearchInput/, `${path} must use shared placeholder typography`);
}
console.log("Customer Portal search placeholder typography regression passed");
