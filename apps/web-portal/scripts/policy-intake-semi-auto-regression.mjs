import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkSemiAutoReadiness } from "../lib/policy-intake-semi-auto.ts";
import { policyIntakeBucket } from "../lib/policy-intake-status-buckets.ts";

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

assert.equal(policyIntakeBucket({ status: "ready_for_review", ocr_status: "completed" }, true), "duplicate",
  "Ready for Review rows with a registered-policy or earlier-Intake match are duplicates, not actionable");
assert.equal(policyIntakeBucket({ status: "in_review", ocr_status: "completed" }, true), "duplicate",
  "Assigned or In Review Intakes still become duplicates when a policy-number match is found");
assert.equal(policyIntakeBucket({ status: "in_review", ocr_status: "completed" }, false), "in_review",
  "Genuine, non-duplicate In Review Intakes remain visible");
assert.equal(policyIntakeBucket({ status: "processing", ocr_status: "pending" }, false), "processing",
  "Unfinished OCR rows should not become booking candidates");
const server = text("app/development/ai-policy-onboarding/actions.ts");
const client = text("components/development/semi-auto-policy-workspace.tsx");
const nav = text("components/claim-manager/app-navigation.tsx");
const page = text("app/development/ai-policy-onboarding/page.tsx");
assert(nav.includes("/development/ai-policy-onboarding"), "Development menu must link to the new workspace");
assert(page.includes('requireCapability("manage_system", "approve")'), "Route requires Development authority");
assert(page.includes("fetchAllPages<CandidateIntake"), "Candidate list must load all relevant rows before pagination");
assert(page.includes("loadPolicyIntakeDuplicateMatches(admin, list.data ?? [])"), "Shared authoritative duplicate detection must run for every candidate");
assert(page.includes("policyIntakeBucket(row, duplicates.matches.has(row.id))"), "Effective status must match the Policy Intake register");
assert(page.includes('bucket === "action_required" || bucket === "in_review"'), "Only the same actionable and in-review buckets should be offered");
assert(page.indexOf("const duplicates =") < page.indexOf(".slice((safePage - 1) * PAGE_SIZE"),
  "Pagination must take place only AFTER duplicate classification and queue filtering");
assert(page.includes("excludedDuplicateCount"), "Excluded duplicate count should be visible to the operator");
assert(page.includes("const safePage ="), "Pagination must not strand users on a now-empty page after duplicate removal");
assert(!page.includes('.range((page - 1) * PAGE_SIZE'), "Never page raw status rows before resolving duplicates");
assert(server.includes('requirePolicyIntakeFinalizer(id)') && server.includes('requirePolicyIntakeReviewer(id)'), "Each selected Intake requires reviewer and finalizer rights");
assert(server.includes("preparePolicyIntakeHandoff(id)"), "Booking must use the canonical Intake claim/draft workflow");
assert(server.includes("await onboardPolicy(bookingPayload)"), "Booking must use canonical policy onboarding, never a direct insert");
assert(!server.includes('.from("policies").insert('), "Semi-auto action must never directly write to policies");
assert(client.includes("await checkSemiAutoIntake(id)"), "Selecting a row must run read-only preflight");
assert(client.includes("window.confirm("), "Booking must require a deliberate final confirmation");
assert(client.includes("bookSemiAutoIntake(selectedId, true)"), "Booking path must be separate from checkbox selection");
assert(server.includes("assignmentConflict: { reviewerName: handoff.reviewerName }"),
  "Handoff must report the actual current reviewer to the UI rather than silently overwriting assignment");
assert(server.includes("preparePolicyIntakeHandoff(id, takeOver === true)"),
  "Assignment takeover must use the existing authorized and compare-and-set canonical handoff");
assert(client.includes("setTakeover({ intakeId: selectedId, reviewerName: response.assignmentConflict.reviewerName })"),
  "Assigned Intake correction must open an explicit reviewer takeover prompt");
assert(client.includes('role="alertdialog"') && client.includes("Take over &amp; open"),
  "Reviewer takeover requires a visible accessible confirmation dialog");
assert(client.includes("editSemiAutoIntake(intakeId, true)"),
  "Only the separate confirmation action can request reviewer takeover");
assert(client.includes("No policy will be booked."), "Takeover must clearly distinguish correction from booking");

// n8n is integrated into the existing workbench, never an alternate booking path.
const n8nServer = text("lib/policy-intake-semi-auto-n8n.ts");
assert(server.includes("previewSemiAutoN8nIntake"), "Development action must expose an authorized n8n preview");
assert(server.includes("await requireDevelopmentPolicyOperator(id)"), "Every n8n action must retain Development operator authorization");
assert(server.includes("applySemiAutoN8nIntake"), "Save must be a distinct explicit action");
assert(server.includes("confirmed !== true"), "No OCR recovery without explicit operator confirmation");
assert(client.includes("previewSemiAutoN8nIntake(selectedId)"), "The existing AI Booking Check panel must host n8n preview");
assert(client.includes("Apply reviewed fields to failed OCR"), "OCR recovery requires an explicit second button");
assert(client.includes("The recovered PDF fields changed after preview") || n8nServer.includes("The recovered PDF fields changed after preview"),
  "Fail closed when the recovered proposal differs from the reviewed hash");
assert(page.includes("semiAutoN8nEnabledForIntake(row.id)"), "Only allowlisted Intake rows may expose n8n preview");
assert(n8nServer.includes("INSUREIT_N8N_OCR_ALLOWED_INTAKE_IDS"), "n8n calls require an explicit Intake allowlist");
assert(n8nServer.includes("INSUREIT_N8N_OCR_ALLOW_REVIEW_APPLY"), "Live OCR apply must use a separate opt-in flag");
assert(n8nServer.includes('process.env.INSUREIT_N8N_OCR_MODE === "prefer"'),
  "Shadow mode must never apply n8n fields as authoritative OCR");
assert(n8nServer.includes('current.intake.ocr_status === "failed"') &&
  n8nServer.includes('.eq("status", "processing").eq("ocr_status", "failed")'),
  "Only failed processing OCR may be recovered through CAS");
assert(n8nServer.includes('loadPolicyIntakeDuplicateMatches(admin, [{'),
  "Apply must consult the canonical duplicate helper using proposed OCR");
assert(n8nServer.includes('policy_intake_onboarding_drafts'),
  "Existing saved drafts must not be overwritten by n8n");
assert(n8nServer.includes('requestN8nPolicyIntakeExtraction('),
  "n8n preview must use the validated server-side bridge, not client fetch");
assert(!n8nServer.includes('.from("policies").insert(') &&
  !n8nServer.includes('.from("customers").insert(') &&
  !n8nServer.includes('.from("vehicles").insert('),
  "n8n preview/apply must not create business entities");
assert(client.includes("bookSemiAutoIntake(selectedId, true)"),
  "Canonical booking path must remain untouched");

console.log("Semi-auto Motor onboarding regression checks passed.");
