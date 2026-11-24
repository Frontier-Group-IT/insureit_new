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

const profile = read("../app/customer/(protected)/profile/page.tsx");
const vaultControls = read("../components/customer-portal/customer-document-vault.tsx");
assert.match(profile, /aria-label="Customer profile"/, "Keep a minimal profile header");
assert.doesNotMatch(profile, /customer-profile-hero|optimized-128\/customers\.png|rotate-\[-25deg\]/, "Remove decorative profile card and art");
assert.match(profile, /<CustomerAvatar userId=\{user\.id\} size="profile"\s*\/>/, "Keep photo management");
assert.match(profile, /customer\.contact_name/, "Keep profile name");
assert.match(profile, /customer\.phone/, "Keep phone");
assert.match(profile, /customer\.email/, "Keep email");
assert.match(vault, /<CustomerDocumentVault key=\{customerId\} customerId=\{customerId\} documents=\{documents\} profileMode\s*\/>/, "Keep scoped document operations");
assert.match(vaultControls, /\{documents\.length\} files/, "Keep actual document count");
for (const category of ["Policy Documents", "ID Proofs", "Address Proofs", "Other Documents"]) assert.ok(vaultControls.includes(category), "Preserve category " + category);
assert.match(vaultControls, /documentGroup\(doc\.document_type\) === index/, "Group by stored document type");
assert.match(vaultControls, /aria-expanded=\{open\}/, "Independent accessible expansion");
assert.match(vaultControls, /dialogRef\.current\?\.showModal\(\)/, "Prominent upload opens dialog");
assert.match(vaultControls, /5 \* 1024 \* 1024/, "Keep upload limit");
assert.match(vaultControls, /fetch\("\/api\/customer\/documents"/, "Preserve upload and deletion APIs");
console.log("Customer Support and Profile visual-polish regression passed.");
