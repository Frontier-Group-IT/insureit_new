import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../components/policy-unified-form.tsx", import.meta.url)), "utf8");
const begin = source.indexOf("  function runCreate(");
const end = source.indexOf("  function submitPolicy", begin);
assert.ok(begin >= 0 && end > begin, "Policy creation flow exists");
const creation = source.slice(begin, end);
assert.match(creation, /try \{/);
assert.match(creation, /await onboardPolicy\(finalPayload\)/);
assert.match(creation, /catch \(error\)/);
assert.match(creation, /setSubmitError\("The policy save response could not be confirmed/);
assert.match(creation, /Check the Policy Register/);
assert.match(creation, /UnrecognizedActionError/, "Detect stale deployed Server Action references");
assert.match(creation, /sessionStorage\.setItem\(POLICY_DRAFT_KEY/, "Preserve form draft on stale-action errors");
assert.match(creation, /reload the page/, "Provide explicit refresh instruction");
assert.doesNotMatch(creation, /catch \(error\)[\s\S]*runCreate\(/, "Do not automatically retry uncertain writes");
console.log("Policy onboarding unexpected server-action failure is handled without rerunning save");
