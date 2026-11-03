import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const globalEnhancements = read("../components/portal-route-enhancements.tsx");
const associatePage = read("../app/intermediaries/applications/[id]/associate-accounts/page.tsx");
const associateToast = read("../app/intermediaries/applications/[id]/associate-accounts/associate-account-result-toast.tsx");

assert.match(globalEnhancements, /hasPageSpecificAssociateError/, "Duplicate popup suppression must be route-scoped.");
assert.match(globalEnhancements, /\/intermediaries\\\/applications/, "Only the Associate Accounts route should be exempt.");
assert.match(globalEnhancements, /&& !hasPageSpecificAssociateError/, "Generic popup should be suppressed when the local error dialog handles it.");
assert.match(associatePage, /<AssociateAccountResultToast/, "Page-specific error feedback must remain visible.");
assert.match(associatePage, /associate_delete_dependencies/, "Deletion dependency error mapping must remain intact.");
assert.match(associateToast, /role="alertdialog"/, "Blocking errors must still show the actionable dialog.");
assert.match(associateToast, /params.delete\("error"\)/, "Dismissing the dialog must clear the error query parameter.");
console.log("Associate Accounts error popup isolation regression passed.");
