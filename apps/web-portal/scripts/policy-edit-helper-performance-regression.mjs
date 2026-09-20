import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../components/policy-route-enhancements.tsx", import.meta.url), "utf8");
const editCopy = await readFile(new URL("../components/policy-edit-copy-footer-actions.tsx", import.meta.url), "utf8");
const editActions = await readFile(new URL("../app/policies/policy-edit-document-actions.ts", import.meta.url), "utf8");
const sizeMigration = await readFile(new URL("../../../supabase/migrations/20260920123000_policy_document_15mb_limit.sql", import.meta.url), "utf8");

assert.ok(
  source.includes("const policyEditRoutePattern ="),
  "Policy route enhancements should define an edit-route matcher.",
);
assert.ok(
  source.includes('policyEditRoutePattern.test(pathname) ? <PolicyEditCopyFooterActions /> : null'),
  "Policy edit document helper should only mount on policy edit routes.",
);
assert.ok(
  source.includes("<PolicySaveConfirmation />"),
  "Policy save confirmation must remain mounted throughout policy routes to preserve pending upload state.",
);
assert.ok(editCopy.includes("const maxPolicyCopyBytes = 15 * 1024 * 1024;"), "Policy Edit must reject policy copies above 15 MB before upload.");
assert.ok(editCopy.includes("Policy copy is too large") && editCopy.includes("Maximum allowed size is"), "Policy Edit must show a clear oversize-file popup.");
assert.ok(editActions.includes("const MAX_POLICY_COPY_BYTES = 15 * 1024 * 1024;"), "Policy Edit server action must enforce 15 MB.");
assert.ok(editActions.includes("Policy copy must be 15 MB or smaller."), "Policy Edit server rejection must state the 15 MB limit.");
assert.ok(sizeMigration.includes("file_size_limit = 15728640") && sizeMigration.includes("policy-documents"), "Storage bucket must also enforce 15 MB.");

console.log("Policy edit helper performance regression passed.");
