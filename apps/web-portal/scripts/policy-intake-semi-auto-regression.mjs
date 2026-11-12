import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkSemiAutoReadiness } from "../lib/policy-intake-semi-auto.ts";

const text = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const draft = {
  registrationMode: "registered", issuanceDate: "2026-11-10", rmName: "Sales RM",
  intermediaryType: "POSP", leadSource: "Test Partner", intermediaryCode: "P123", businessLine: "Motor",
  registrationNo: "MP20AB1234", insuredName: "Test Policyholder", phoneNo: "9876543210",
  vehicleClass: "PCP", make: "Bajaj Auto", model: "Avenger",
  fuelType: "Petrol", manufacturingYear: "2024", capacity: "220", chassisNo: "MD2A1234567890AB",
  engineNo: "ENGINE1234567", rtoState: "MP", rtoName: "Jabalpur",
  policyProduct: "COMPREHENSIVE", idv: "80000", od: "1200", tp: "3500",
  cpaOpted: "No", cpa: "0", policyNo: "TEST-2026-ABC", insurerId: "insurer-id",
  validFrom: "2026-11-10", validUpto: "2027-11-09",
  payoutBasis: "NET", projectedOdPercent: "", projectedTpPercent: "", insurerScheme: "",
  payinBillNo: "", payinBilledAmount: "", payinBillDate: "", payinStatus: "Unbilled",
  retention: "", payoutOdPercent: "", payoutTpPercent: "", flatPayoutAmount: "",
  payoutStatus: "Pending", payoutDate: "", payoutVoucherNo: "", remarks: "",
};
const baseline = {
  status: "in_review", policyType: "motor", ocrStatus: "completed", hasCurrentCopy: true,
  ocrFields: [{ key: "policy_number", value: "TEST-2026-ABC", confidence: 0.96 }],
  draft, draftRevision: 2, dateDecision: "allowed",
};
const issues = overrides => checkSemiAutoReadiness({ ...baseline, ...overrides });
const containsField = (items, field) => items.some(item => item.field === field);
assert.equal(issues().length, 0, "Human-corrected complete non-bundled Motor draft must pass the pure preflight");
assert(containsField(issues({ draftRevision: 1 }), "Policy Issuance Date"), "Never trust today's default handoff issuance date");
assert(containsField(issues({ dateDecision: "otp_required" }), "Date approval"), "Email OTP policies must not auto-book");
assert(containsField(issues({ dateDecision: "future" }), "Policy Issuance Date"), "Future issuance date must fail");
assert(containsField(issues({ status: "completed" }), "Intake status"), "Completed intakes must be rejected");
assert(containsField(issues({ policyType: "life" }), "Business line"), "Life proposal intakes must not use the Motor booking path");
assert(containsField(issues({ ocrStatus: "failed" }), "Document reading"), "Failed OCR is not a ready-to-book document");
assert(containsField(issues({ hasCurrentCopy: false }), "Policy copy"), "Missing source copy must block booking");
assert(containsField(issues({ draft: { ...draft, insuredName: "" } }), "Insured Name"), "Missing legal insured identity must fail");
assert(containsField(issues({ draft: { ...draft, policyProduct: "BUNDLED" } }), "Bundled coverage"), "Bundled cover requires separate OD/TP/CPA verification");
assert(containsField(issues({ draft: { ...draft, vehicleClass: "GCV", cpa: "0", cpaOpted: "No" } }), "GCV CPA"), "GCV compulsory CPA must not be silently skipped");
assert(containsField(issues({ draft: { ...draft, cpa: "250", cpaOpted: "No" } }), "CPA Opted"), "CPA premium must reconcile with CPA Opted");
assert(containsField(issues({ ocrFields: [{ key: "policy_number", value: "TEST", confidence: 0.61 }], draftRevision: 1 }), "policy_number"), "Low-confidence unreviewed identity must block");
assert(containsField(issues({
  ocrFields: [{ key: "total_premium", value: "4000" }, { key: "tax_amount", value: "720" }, { key: "gross_premium", value: "5250" }],
}), "Printed totals"), "Premium reconciliation mismatch must block");

const server = text("app/development/ai-policy-onboarding/actions.ts");
const client = text("components/development/semi-auto-policy-workspace.tsx");
const nav = text("components/claim-manager/app-navigation.tsx");
const page = text("app/development/ai-policy-onboarding/page.tsx");
assert(nav.includes("/development/ai-policy-onboarding"), "Development menu must link to the new workspace");
assert(page.includes('requireCapability("manage_system", "approve")'), "Route requires Development authority");
assert(server.includes('requirePolicyIntakeFinalizer(id)') && server.includes('requirePolicyIntakeReviewer(id)'), "Each selected Intake requires reviewer and finalizer rights");
assert(server.includes("preparePolicyIntakeHandoff(id)"), "Booking must use the canonical Intake claim/draft workflow");
assert(server.includes("await onboardPolicy(bookingPayload)"), "Booking must use canonical policy onboarding, never a direct insert");
assert(!server.includes('.from("policies").insert('), "Semi-auto action must never directly write to policies");
assert(client.includes("await checkSemiAutoIntake(id)"), "Selecting a row must run read-only preflight");
assert(client.includes("window.confirm("), "Booking must require a deliberate final confirmation");
assert(client.includes("bookSemiAutoIntake(selectedId, true)"), "Booking path must be separate from checkbox selection");
console.log("Semi-auto Motor onboarding regression checks passed.");
