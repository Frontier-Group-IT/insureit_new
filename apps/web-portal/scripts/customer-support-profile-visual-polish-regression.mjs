import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = relative => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const support = read("../app/customer/(protected)/support/page.tsx");
const editor = read("../components/customer-portal/customer-profile-editor.tsx");
const vault = read("../components/customer-portal/customer-profile-documents.tsx");

assert.match(support, /lg:grid-cols-3/, "Quick Help should have three desktop columns");
for (const category of ["Policy Related", "Claims", "Vehicle & Policy"]) {
  assert.match(support, new RegExp('label:"' + category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"'), "Required quick-help card missing");
}
assert.doesNotMatch(support, /label:"Payments"|label:"Other Queries"/, "Removed quick-help cards must not return");
assert.match(support, /e_challan/, "Challan tickets should use e-challan icon");
assert.match(support, /insurance_quote/, "Insurance quote tickets should use insurance quote icon");
assert.match(support, /item\.subject\+" "\+item\.service_type/, "Ticket icon should be based on real ticket topics");
assert.match(support, /support-activity" className="space-y-3 rounded-2xl border border-\[#C8D8F3\]/, "Highlight support summary wrapper");
assert.match(support, /loadCustomerServiceActivity\(account\.id\)/, "Keep authorized support request data");
assert.match(support, /CustomerSupportTicketPanel/, "Keep support ticket controls");
assert.match(support, /pathname:`\/customer\/support\/\$\{item\.id\}`/, "Preserve ticket links");

assert.match(editor, /aria-label="Edit profile details"/, "Icon-only edit action needs accessible label");
assert.match(editor, /title="Edit profile details"/, "Icon-only edit needs a tooltip");
assert.match(editor, /<Pencil className="h-4 w-4" aria-hidden="true"\s*\/>/, "Keep pencil icon");
assert.match(editor, /bg-transparent text-\[#6742BB\].*hover:bg-\[#F4EEFF\]/, "Edit background only on hover");
assert.doesNotMatch(editor, /<Pencil className="h-3\.5 w-3\.5" \/> Edit/, "Remove Edit text");
assert.match(editor, /setEditing\(true\)/, "Edit button still opens the modal");
assert.match(editor, /router\.refresh\(\)/, "Profile saving still refreshes");

assert.match(vault, /\{documents\.length\} files/, "Keep actual document count");
assert.match(vault, /bg-transparent px-3 py-2.*hover:bg-\[#F4EEFF\]/, "File-count default must remain transparent");
assert.match(vault, /grid w-full grid-cols-2 gap-2 lg:grid-cols-4/, "Four vault categories must fill the desktop row");
assert.match(vault, /customer-profile-category flex min-w-0 w-full/, "Category tiles should fill each grid cell");
for (const category of ["Policy Documents", "ID Proofs", "Address Proofs", "Other Documents"]) assert.ok(vault.includes(category), "Preserve vault category " + category);
assert.doesNotMatch(vault, /bottom-\[-25px\]|-right-24 -top-28/, "Decorative placeholder art must be absent");
assert.match(vault, /<CustomerDocumentVault customerId=\{customerId\} documents=\{documents\}\s*\/>/, "Preserve document vault operations");
assert.match(vault, /aria-controls="customer-profile-vault-content"/, "Preserve expansion control");

console.log("Customer Support and Profile visual-polish regression passed.");
