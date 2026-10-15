import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const component = readFileSync(fileURLToPath(new URL("../components/life-health-case-detail.tsx", import.meta.url)), "utf8");
const action = readFileSync(fileURLToPath(new URL("../app/policies/life-health-case-edit-actions.ts", import.meta.url)), "utf8");
assert.ok(component.includes("paymentMode:normalizeCasePaymentMode(caseData.paymentMode)"));
assert.ok(component.includes('<option value="" disabled>Select payment mode</option>'));
assert.ok(action.includes('paymentMode = normalizePaymentMode(clean(formData.get("paymentMode")))'));
assert.ok(action.includes("PAYMENT_MODES.has(paymentMode)"));
console.log("Life/Health payment mode validation contract passed");
