import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkSemiAutoReadiness } from "../lib/policy-intake-semi-auto.ts";
import { policyIntakeBucket } from "../lib/policy-intake-status-buckets.ts";
import { validateN8nPolicyIntakeResponse } from "../lib/policy-intake-n8n-validation.ts";

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
assert(page.includes('policyIntakeBucket(row, duplicateIds.has(row.id))'), "Effective status must match the Policy Intake register");
assert(page.includes('const workspaceRows = !unavailable && duplicates?.ok ? candidates : []'),
  "All open Motor Intakes, including duplicates and incomplete OCR, must remain in the n8n preview list");
assert(page.includes('is_duplicate: policyIntakeBucket(row, duplicateIds.has(row.id)) === "duplicate"'),
  "Derived duplicate status must be visible without modifying Intake status");
assert(page.includes('initialIntakeId={requestedId && pageRows.some(row => row.id === requestedId)'),
  "Direct Intake links must select only Intake IDs present in the authorized paginated server list");
assert(page.includes('const targetIndex = requestedId ? workspaceRows.findIndex'),
  "Direct Intake links must locate rows across pagination");
assert(page.indexOf("const duplicates =") < page.indexOf(".slice((safePage - 1) * PAGE_SIZE"),
  "Pagination must take place only AFTER duplicate classification and queue filtering");
assert(page.includes("duplicateCount"), "Visible duplicate count should be clear to the operator");
assert(!page.includes("excludedDuplicateCount"), "Duplicate Intakes must not be hidden from the n8n preview workspace");
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
assert(page.includes("semiAutoN8nEnabledForIntake(row.id)"), "Preview eligibility must come from the server, not the browser");
assert(n8nServer.includes('mode === "shadow" && process.env.INSUREIT_N8N_OCR_PREVIEW_ALL_MOTOR === "true"'),
  "Broad preview access must require the explicit read-only shadow-mode flag");
assert(n8nServer.includes("if (!UUID.test(intakeId)) return false"),
  "Broad preview must still validate the Intake identifier");
assert(client.includes('initialIntakeId ?? null'),
  "Direct links may initially select only the Intake authorized by server pagination");
assert(client.includes('row.is_duplicate ? "Duplicate · Preview only"'),
  "Duplicate preview rows must be visibly separated from bookable Intakes");
assert(client.includes('Boolean(selected?.is_duplicate)'),
  "Duplicate Intakes must have correction disabled in the UI");
assert(client.includes('&& !selected?.is_duplicate'),
  "Duplicate Intakes must never be eligible for client-side booking");
assert(n8nServer.includes("INSUREIT_N8N_OCR_ALLOWED_INTAKE_IDS"),
  "Original single-Intake allowlist must remain supported for staged pilots and apply mode");
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
assert(n8nServer.includes("extraction.warnings.length === 0"), "Warnings must prevent automatic failed-OCR recovery");
assert(n8nServer.includes("fingerprint(id, current.document.id, extraction.fields, extraction.warnings)"),
  "Reviewed preview fingerprint must bind both fields and warnings");
assert(n8nServer.includes("An onboarding draft was created while extraction was running"),
  "Apply must recheck draft creation immediately before the final OCR update");
assert(n8nServer.includes('requestN8nPolicyIntakeBySignedSource('),
  "n8n preview must use the validated server-side bridge, not client fetch");
assert(!n8nServer.includes('.from("policies").insert(') &&
  !n8nServer.includes('.from("customers").insert(') &&
  !n8nServer.includes('.from("vehicles").insert('),
  "n8n preview/apply must not create business entities");
assert(client.includes("bookSemiAutoIntake(selectedId, true)"),
  "Canonical booking path must remain untouched");


// n8n preview is ephemeral: distinguish exact field changes and show verified
// PDF premium components without enabling Intake writes or bookings.
const n8nValidator = text("lib/policy-intake-n8n-validation.ts");
assert(n8nValidator.includes("export type N8nVerifiedPremiumBreakdown"),
  "Validated premium breakdown must have a typed, bounded response contract");
assert(n8nValidator.includes("checksPassed: REQUIRED_CHECKS.size"),
  "Display a check count derived from the strict validator, not an untrusted n8n claim");
assert(n8nValidator.includes("const odAddons = premium.od_addons.map"),
  "Each individual OD add-on must be validated before reaching the preview");
assert(n8nServer.includes("const changedFields: SemiAutoN8nChangedField[]"),
  "Actual differences must be computed against the saved Intake OCR on the server");
assert(n8nServer.includes("previousValue: previous ?? null") && n8nServer.includes("extractedValue: field.value"),
  "Each difference must include old and new OCR values for reviewer comparison");
assert(n8nServer.includes("premium: extraction.premium"),
  "Only the independently validated n8n premium breakdown may reach the review UI");
assert(client.includes("Exact field differences from saved OCR"),
  "Expose the precise changed field list instead of a count alone");
assert(client.includes("PDF premium reconciliation") && client.includes("Individual OD add-ons"),
  "Expose the complete, reconciled premium breakdown, including add-ons");
assert(client.includes("This preview does not change the Intake, draft or booking state."),
  "Preview remains explicitly read-only");
assert(n8nServer.includes('semiAutoN8nApplyEnabled()'),
  "Keep a separate recovery gate for OCR application");


// Live source PDFs are private, so contract tests use fictional policy data.
// Premium is intentionally a Basic OD + add-on combination (2026 + 240).
const auditIds = {
  intakeId: "00000000-0000-4000-8000-000000000001",
  documentId: "00000000-0000-4000-8000-000000000002",
  requestId: "00000000-0000-4000-8000-000000000003",
};
const auditChecks = Object.fromEntries([
  "is_icici_3005", "insured_name_present", "policy_number_present",
  "vehicle_details_present", "dates_present", "od_liability_equal_net",
  "tp_cpa_equal_liability", "net_tax_equal_gross", "idv_present",
  "manufacturing_year_present", "basic_od_plus_addons_equals_printed_total",
  "basic_tp_equals_derived_tp", "exact_igst_rounds_to_tax",
].map(key => [key, true]));
const auditFields = Object.entries({
  policy_number: "3005/123456789/00/000",
  insurer_name: "ICICI Lombard General Insurance Company Limited",
  insured_name: "TEST POLICYHOLDER",
  policy_start_date: "2026-10-24", policy_end_date: "2027-10-23",
  third_party_start_date: "2026-10-24", third_party_end_date: "2031-10-23",
  vehicle_make: "TEST MAKE", vehicle_model: "TEST MODEL",
  vehicle_registration_status: "registration_pending",
  vehicle_engine_number: "TESTENG123", vehicle_chassis_number: "TESTCHASSIS1234567",
  vehicle_manufacturing_year: "2026", idv: "124113",
  od_premium: "2266", tp_premium: "3273", cpa_premium: "575",
}).map(([key,value]) => ({key,value,label:key,confidence:null,page:1,evidence:"Fictional PDF test"}));
const auditPayload = {
  contract_version:"1", intake_id:auditIds.intakeId,
  document_id:auditIds.documentId, request_id:auditIds.requestId,
  ok:true, review_required:true, auto_finalize_allowed:false,
  parser_id:"icici_3005_n8n_native_pdf", parser_version:"bridge-v1",
  extraction_method:"native_pdf_text",
  fields:auditFields,warnings:[],checks:auditChecks,
  premium_components:{
    basic_od_premium:2026, od_addons:[{name:"Fictional add-on",amount:240}],
    total_od_premium:2266,basic_tp_premium:3273,owner_driver_cpa:575,
    total_liability_premium:3848,net_premium:6114,
    igst_exact:1100.52,printed_total_tax:1101,gross_premium:7215,
  },
};
const audited = validateN8nPolicyIntakeResponse(auditPayload,auditIds);
assert.equal(audited.checksPassed,13,"Validator must prove all thirteen checks");
assert.equal(audited.premium.basicOd,2026,"Do not confuse Basic OD with Total OD");
assert.equal(audited.premium.odAddons[0].amount,240,"Preserve the exact PDF add-on");
assert.equal(audited.premium.totalOd,2266,"Use printed Total OD, not Basic OD");
assert.equal(audited.premium.net,6114);
assert.equal(audited.premium.tax,1101);
assert.equal(audited.premium.gross,7215);
assert.throws(() => validateN8nPolicyIntakeResponse({
  ...auditPayload,
  premium_components:{...auditPayload.premium_components,od_addons:[{name:"Fictional add-on",amount:241}]},
},auditIds),/n8n_premium_reconciliation_failed/,"A one-rupee add-on mismatch must fail closed");
assert.throws(() => validateN8nPolicyIntakeResponse({
  ...auditPayload,
  checks:{...auditChecks,exact_igst_rounds_to_tax:false},
},auditIds),/n8n_financial_validation_failed/,"Do not trust incomplete premium checks");

console.log("Semi-auto Motor onboarding regression checks passed.");
