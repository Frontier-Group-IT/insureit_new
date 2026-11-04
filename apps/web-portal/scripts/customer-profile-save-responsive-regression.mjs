import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "components/customer-portal/customer-profile-editor.tsx"), "utf8");

assert.match(source, /mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end/, "Mobile buttons share equal-width columns; desktop stays right aligned");
assert.equal((source.match(/min-h-11 min-w-0 w-full items-center justify-center/g) ?? []).length, 2, "Save and Cancel must both have 44px touch targets and flexible widths");
assert.equal((source.match(/sm:w-auto sm:px-4/g) ?? []).length, 2, "Buttons return to compact desktop widths");
assert.match(source, /disabled=\{busy\} onClick=\{cancel\}/, "Cancel remains disabled during save");
assert.match(source, /disabled=\{busy\} aria-busy=\{busy\} onClick=\{\(\) => void save\(\)\}/, "Save preserves existing handler, disables repeat submission and announces progress");
assert.match(source, /busy \? "Saving\.\.\." : "Save Changes"/, "Save label indicates loading state");
assert.match(source, /if \(busy\) return;/, "Existing double-submit guard retained");
assert.match(source, /setDraft\(\{ name, phone, email, address \}\)/, "Cancel still resets form draft");
assert.match(source, /focus-visible:outline-2/, "Buttons have visible keyboard focus");
console.log("Customer Profile responsive Save Changes regression passed");
