import assert from "node:assert/strict";
import { normalizePolicyMoney, displayPolicyMoney } from "../lib/policy-money-precision.ts";

for (const [raw, expected] of [
  ["8179.549999999999", "8179.55"],
  ["2607.000000000001", "2607.00"],
  ["425", "425.00"],
  ["0.004", "0.00"],
  ["0.005", "0.01"],
  ["1.995", "2.00"],
  ["1,250.125", "1250.13"],
  ["0", "0.00"],
] as const) assert.equal(normalizePolicyMoney(raw), expected, `Money value ${raw} must normalize to ${expected}`);
assert.equal(normalizePolicyMoney(""), null);
assert.equal(displayPolicyMoney(""), "");
assert.equal(normalizePolicyMoney("abc"), null);
assert.equal(normalizePolicyMoney("-1.25"), "-1.25");
console.log("Policy money precision regression passed.");
