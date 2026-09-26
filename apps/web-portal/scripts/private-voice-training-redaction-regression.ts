import assert from "node:assert/strict";

import { redactTrainingText } from "../lib/private-voice/training-redaction.ts";

const identity = {
  customer_name: "Shrankhala Mishra",
  mobile: "9876543210",
  registration_no: "MP20AB1234",
};

assert.equal(
  redactTrainingText("The customer, Shrankhala, asked for a callback.", identity),
  "The customer, [CUSTOMER], asked for a callback.",
);
assert.equal(
  redactTrainingText("shrankhala mishra asked about renewal.", identity),
  "[CUSTOMER] asked about renewal.",
);
assert.equal(
  redactTrainingText("Call 9876543210 for MP20AB1234.", identity),
  "Call [MOBILE] for [RC].",
);
assert.equal(
  redactTrainingText("Alternate +91 9876543210 and RC MP-20-AB-1234.", identity),
  "Alternate [MOBILE] and RC [RC].",
);
assert.equal(
  redactTrainingText("Reference 123456789012345 should not remain.", identity),
  "Reference [LONG_ID] should not remain.",
);

const result = redactTrainingText(
  "Shrankhala requested renewal support for her Suzuki Access. Mishra will call later.",
  identity,
);
assert.equal(result.includes("Shrankhala"), false);
assert.equal(result.includes("Mishra"), false);
assert.equal(result.includes("Suzuki Access"), true);

const mismatchedIdentity = {
  customer_name: "Different Customer",
  mobile: null,
  registration_no: null,
};
assert.equal(
  redactTrainingText("The customer, Ananya, requested a callback tomorrow.", mismatchedIdentity),
  "The customer, [CUSTOMER], requested a callback tomorrow.",
  "provider narrative names must be redacted even when they do not match the opportunity identity",
);
assert.equal(
  redactTrainingText("Customer Vikram expressed interest in renewal.", mismatchedIdentity),
  "Customer [CUSTOMER] expressed interest in renewal.",
);
assert.equal(
  redactTrainingText("The insured named Priya Singh requested assistance.", mismatchedIdentity),
  "The insured named [CUSTOMER] requested assistance.",
);
assert.equal(
  redactTrainingText("Mr. Vikram Rao confirmed the details.", mismatchedIdentity),
  "[CUSTOMER] confirmed the details.",
);

console.log("Private voice training redaction regression passed.");
