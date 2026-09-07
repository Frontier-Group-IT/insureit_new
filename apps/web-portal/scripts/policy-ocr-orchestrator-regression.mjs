import assert from "node:assert/strict";
import { allocateFairSamples, acceptanceGate, selectTopInsurers, sanitizeCandidatePatch } from "../lib/policy-ocr-orchestrator.ts";

assert.deepEqual(selectTopInsurers({ A: 5, B: 20, C: 10, D: 1 }, 3), ["B", "C", "A"]);
const samples = ["a1", "a2", "b1", "c1"].map((id, index) => ({ id, insurer: index < 2 ? "A" : id.startsWith("b") ? "B" : "C", product: "motor", layout: "standard", createdAt: `2026-01-0${index + 1}` }));
assert.deepEqual(allocateFairSamples(samples, 3).map((sample) => sample.id), ["a1", "b1", "c1"]);
assert.equal(acceptanceGate({ fieldAccuracy: 0.95, wrongFinancialValues: 0, freshSiblingCounts: { A: 3 }, holdoutFailures: 0, budgetExhausted: false }).accepted, true);
assert.equal(acceptanceGate({ fieldAccuracy: 0.99, wrongFinancialValues: 1, freshSiblingCounts: { A: 3 }, holdoutFailures: 0, budgetExhausted: false }).reason, "wrong_financial_value");
assert.match(sanitizeCandidatePatch({ insurer: "A", product: "motor", layout: "x", rule: "remove 9876543210123456" }).rule, /redacted/);
console.log("Policy OCR orchestrator regression passed.");
