import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../components/policy-route-enhancements.tsx", import.meta.url), "utf8");

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

console.log("Policy edit helper performance regression passed.");
