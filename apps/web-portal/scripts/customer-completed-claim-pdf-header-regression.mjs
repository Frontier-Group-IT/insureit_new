import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../components/customer-portal/customer-claim-stage-strip.tsx", import.meta.url), "utf8");

assert.match(source, /const allNineCompleted = INTERNAL_JOURNEY_STAGES\.every\(stage => completedKeys\.includes\(stage\.key\)\)/,
  "Only completion of all nine stages should reveal PDF actions and hide Back.");
assert.match(source, /\{allNineCompleted \? <>[\s\S]*?Open PDF[\s\S]*?Download PDF[\s\S]*?<\/\> : null\}/,
  "Completed journey retains both PDF buttons.");
assert.match(source, /\{!allNineCompleted \? <Link href=\{\{ pathname: "\/customer\/claims", query: \{ account: accountId \} \}\}[^\n]*>Back<\/Link> : null\}/,
  "Back must be hidden only while completed-claim PDF controls are shown.");
assert.match(source, /aria-label="Back to claims"/,
  "The incomplete journey must retain its accessible back navigation.");
console.log("Customer completed claim PDF header without Back regression passed.");
