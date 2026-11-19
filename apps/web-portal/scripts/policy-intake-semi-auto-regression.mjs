import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkSemiAutoReadiness } from "../lib/policy-intake-semi-auto.ts";
import { policyIntakeBucket, policyIntakeStatusCounts } from "../lib/policy-intake-status-buckets.ts";
import { validateN8nPolicyIntakeResponse } from "../lib/policy-intake-n8n-validation.ts";
import { mapVerifiedN8nMotorPremium } from "../lib/policy-n8n-onboarding-premium.ts";
import { filterVerifiedN8nOnboardingFields } from "../lib/policy-n8n-onboarding-fields.ts";
import { enrichVerifiedN8nOnboardingFields, splitN8nRtoStateAndCity } from "../lib/policy-n8n-onboarding-enrichment.ts";
import { selectVerifiedN8nInsuredDraftIdentity, sameInsuredIdentity } from "../lib/policy-n8n-onboarding-insured.ts";
import { buildPolicyOcrOnboardingUpdate, normalizeVerifiedMotorPowerKw } from "../lib/policy-ocr-onboarding-apply.ts";
import { assessAiPolicyIntake } from "../lib/ai-policy-onboarding-eligibility.ts";

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
assert(page.includes('const requestedRow = requestedId ? workspaceRows.find') &&
  page.includes('const targetIndex = requestedId ? statusRows.findIndex'),
  "Direct Intake links must choose their canonical status tab, then locate the authorized row across filtered pagination");
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
assert(client.includes('row.is_duplicate ? "Duplicate · Review only"'),
  "Derived duplicate rows must be visibly separated from eligible Intakes and remain review-only");
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
assert(n8nServer.includes("fingerprint(id, current.document.id, extraction.fields, extraction.warnings, extraction.premium)"),
  "Reviewed preview fingerprint must bind the document, fields, warnings and independently checked premium breakdown");
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
assert(n8nValidator.includes("checksPassed: requiredChecks.size") && n8nValidator.includes("const requiredChecks = isOd ? REQUIRED_OD_CHECKS : REQUIRED_CHECKS"),
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
  policy_issuance_date: "2026-10-22", // Independently printed; not cover start or today.
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
assert.equal(audited.fields.find(field=>field.key==="policy_issuance_date")?.value,"2026-10-22",
  "Current verified PDF issue date must pass through the web bridge distinctly from cover start");
assert.throws(()=>validateN8nPolicyIntakeResponse({
  ...auditPayload,
  fields:auditFields.map(field=>field.key==="policy_issuance_date"?{...field,value:"2026-02-30"}:field),
},auditIds),/n8n_issuance_date_invalid/,"A fabricated or impossible issue date must never prefill onboarding");
assert.doesNotThrow(()=>validateN8nPolicyIntakeResponse({
  ...auditPayload,
  fields:auditFields.filter(field=>field.key!=="policy_issuance_date"),
},auditIds),"A PDF with no separately verified issue date remains reviewable, but no date may be guessed");
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


// All-Type n8n primary workbench is a separate opt-in review mode. It must
// never call legacy Google OCR, auto-apply n8n fields or book a policy.
const signedSource = text("lib/policy-intake-n8n-signed-source.ts");
const actions = text("app/development/ai-policy-onboarding/actions.ts");
assert(page.includes("const primaryN8n = isN8nWorkbenchPrimary()"),
  "All policy-type routing is enabled only by the server-side n8n primary flag");
assert(page.includes('let scoped = primaryN8n ? current : current.eq("policy_type", "motor")')
  && page.includes("getPartnerEmployeeIntakeReadScope"),
  "Primary workbench must show all authorized open Intake types, retain legacy Motor-only mode and preserve Register scope");
assert(page.includes("primaryN8n={primaryN8n}"),
  "The server must pass primary mode to the authenticated client, never trust a browser query param");
assert(n8nServer.includes('INSUREIT_N8N_WORKBENCH_PRIMARY'),
  "Primary workbench must be explicitly opt-in");
assert(n8nServer.includes('process.env.INSUREIT_N8N_OCR_MODE === "shadow"'),
  "Primary workbench must stay within review-only shadow mode");
assert(n8nServer.includes('"non_motor", "life", "health"'),
  "Current-document checks must permit supported Intake categories for n8n review");
assert(signedSource.includes('const SUPPORTED_INTAKE_TYPES = new Set(["motor", "non_motor", "life", "health"])'),
  "Non-Motor and other known types must use the same scoped private PDF download");
assert(signedSource.includes("intake.policy_type !== null"),
  "Unclassified legacy Intakes must be considered for review without inventing a type");
assert(n8nServer.includes('reason: "untrained_or_unverified"'),
  "Unsupported insurer layouts must have an explicit, non-successful review-needed result");
assert(n8nServer.includes('snapshot.intake.policy_type !== null && snapshot.intake.policy_type !== "motor"'),
  "A validated ICICI Motor parser result must not authorize a Non-Motor, Life or Health Intake");
assert(n8nServer.includes('No old OCR fallback, Intake update or booking'),
  "Unsupported policies must fail closed rather than falling back to Google OCR");
assert(client.includes("const extracted = await previewSemiAutoN8nIntake(id)"),
  "Selection must start n8n extraction in primary mode");
assert(client.includes('const available = !primaryN8n'),
  "Primary n8n extraction must not make legacy booking appear ready");
assert(client.includes('{!primaryN8n ? <><div'),
  "Primary n8n UI must not show legacy correction or Confirm & Book actions");
assert(actions.includes('if (isN8nWorkbenchPrimary()) return { ok: false, ready: false'),
  "The legacy booking server action must fail closed while n8n is primary");
assert(actions.includes('if (isN8nWorkbenchPrimary()) return { ok: false,'),
  "OCR apply action must fail closed while n8n is primary");
assert(n8nServer.includes('current.intake.policy_type === "motor"'),
  "Legacy failed-OCR recovery must stay Motor-only");
assert(page.includes('!unavailable && duplicates?.ok ? candidates'),
  "Duplicates and untrained Intake types must remain selectable for n8n review");


// Verifiable n8n -> canonical Motor Policy Onboarding handoff. The client must
// never supply its own extracted fields, and no booking happens on forwarding.
const handoff = text("app/policy-intakes/handoff-actions.ts");
const policyNew = text("app/policies/new/page.tsx");
assert(handoff.includes("export async function prepareVerifiedN8nIntakeHandoff("),
  "Keep an explicit verified n8n handoff with a server-owned reviewed fingerprint");
assert(handoff.includes('await requireCapability("manage_system","approve")')
  && handoff.includes("await requirePolicyCreator()"),
  "The directly callable n8n handoff server action must recheck Development and Policy Creator rights");
assert(handoff.includes("const parsed=await previewSemiAutoN8nExtraction(id)"),
  "The handoff must re-extract the current private PDF server-side, not accept browser OCR fields");
assert(handoff.includes("parsed.preview.fingerprint!==expectedFingerprint"),
  "A changed extraction must block a previously reviewed handoff");
assert(n8nServer.includes("JSON.stringify({ intakeId: id, documentId, fields, warnings, premium,")
  && n8nServer.includes("extraction.warnings, extraction.premium"),
  "The reviewed fingerprint must include verified financial components, not only OCR field text");
assert(handoff.includes("parsed.preview.documentId!==expectedDocumentId"),
  "A replaced PDF must not be forwarded under the prior review");
assert(handoff.includes("parsed.preview.checksPassed!==(isTata?18:13)")
  && handoff.includes("const blockingWarnings = parsed.preview.warnings.filter")
  && handoff.includes("!isTata || !informationalTataWarnings.has(warning)"),
  "ICICI must remain warning-free at 13 checks; Tata AIG needs 18 checks with only allowlisted review warnings");
assert(handoff.includes('intake.policy_type!=="motor"'),
  "The first n8n handoff must be Motor-only until other business lines are trained");
assert(handoff.includes("loadPolicyIntakeDuplicateMatches(admin,[{...intake,ocr_fields:verified.fields}])"),
  "The final n8n policy number must be duplicate checked, not only the legacy OCR");
assert(handoff.includes('if(existingDraft?.draft_payload)'),
  "Existing saved drafts must never be overwritten by the n8n handoff");
assert(handoff.includes("lastDoc.id!==verified.documentId"),
  "The exact current PDF must be rechecked after reviewer claim");
assert(handoff.includes("enrichVerifiedN8nOnboardingFields(verified.fields)"),
  "n8n vehicle and policy draft fields remain strictly allowlisted");
assert(handoff.includes("resolveMasterIntakeIdentity(admin,intake.matched_customer_id,intake.customer_mobile)"),
  "Approved linked master identity must still be checked against the intake mobile");
assert(handoff.includes('if(existingDraft?.draft_payload && !(verified?.fillEmptyFields))')
  && handoff.includes('.eq("intake_id",id).eq("revision",existingDraft.revision)'),
  "Existing drafts must not be overwritten; explicit blank-only refresh requires revision CAS");
assert(handoff.includes("selectVerifiedN8nInsuredDraftIdentity(verified.fields,masterIdentity)")
  && handoff.includes("const customerName=verifiedIdentity?.name")
  && handoff.includes("verifiedIdentity?.matchedCustomerId??null"),
  "Reviewable ICICI 3005 PDF insured name may prefill, but must not auto-link a customer");
assert(handoff.includes("const identityName=verified"),
  "Existing drafts in n8n handoff must never fall back to old OCR customer identity");
assert(handoff.includes("mapVerifiedN8nMotorPremium(verified.premium)"),
  "Handoff must derive basic OD / add-ons from the independently validated breakdown");
assert(handoff.includes("tpValidUpto:tpExpiry"),
  "Carry the separately extracted TP expiry into the canonical form");
assert(actions.includes("continueVerifiedN8nIntakeToOnboarding(")
  && actions.includes("await requireDevelopmentPolicyOperator(id)")
  && actions.includes("await requirePolicyCreator()"),
  "Handoff must independently enforce Development and Policy Creator permissions");
assert(actions.includes('editUrl:"/policies/new?intake_id="'),
  "Continue must reuse canonical Intake linked Policy Onboarding rather than invent a booking endpoint");
assert(client.includes("Continue to Policy Onboarding"),
  "Expose the actual Next/Continue action after a successful n8n extraction");
assert(client.includes('setHandoffDialog({') && client.includes('role="alertdialog"')
  && client.includes('kind: "takeover"') && client.includes("confirmN8nHandoff()"),
  "n8n continuation and takeover must use the custom accessible confirmation dialog");
const forwardStart=client.indexOf("function forwardN8nToOnboarding()");
const forwardEnd=client.indexOf("async function book()",forwardStart);
assert(forwardStart>=0&&forwardEnd>forwardStart
  && !client.slice(forwardStart,forwardEnd).includes("window.confirm(")
  && !client.slice(forwardStart,forwardEnd).includes("window.alert("),
  "No native browser confirmation or alert in the n8n onboarding handoff");
assert(client.includes('selected.policy_type !== "motor"')
  && client.includes("selected.is_duplicate"),
  "The n8n handoff button must be disabled for untrained/duplicate policy Intakes");
assert(policyNew.includes("n8n-verified Policy Intake · Manual onboarding review"),
  "Display a clear n8n prefill review warning on the canonical Policy Onboarding page");

// General vehicle/policy mapping never accepts personal identity; the separate
// explicit ICICI 3005 handoff proposes only a reviewable Insured Name with no
// automatic customer linking or final booking.
const sanitizedN8nFields = filterVerifiedN8nOnboardingFields([
  { key: "insured_name", value: "Fictional PDF Holder" },
  { key: "insured_phone", value: "9999999999" },
  { key: "customer_address", value: "Synthetic address" },
  { key: "customer_pan", value: "AAAAA1111A" },
  { key: "policy_number", value: "3005/123456789/26/001" },
  { key: "vehicle_chassis_number", value: "SYNTHETIC123" },
  { key: "idv", value: "80000" },
]);
assert.deepEqual(sanitizedN8nFields.map(field => field.key),
  ["policy_number", "vehicle_chassis_number", "idv"],
  "The generic field allowlist still rejects personal identity");

// Synthetic personal data only: the PDF name is an editable proposal,
// not a permission to link a customer or bypass human final booking.
const syntheticIdentity=[{
  key:"insured_name", value:"TEST POLICYHOLDER",
  page:1, evidence:"Name of Insured",
}];
const pdfIdentity=selectVerifiedN8nInsuredDraftIdentity(syntheticIdentity,null);
assert.deepEqual(pdfIdentity,{
  name:"TEST POLICYHOLDER",matchedCustomerId:null,
  needsManualReview:true,source:"verified_pdf",
});
assert.deepEqual(selectVerifiedN8nInsuredDraftIdentity(syntheticIdentity,{
  id:"synthetic-customer-1",name:"test policyholder",
}),{
  name:"test policyholder",matchedCustomerId:"synthetic-customer-1",
  needsManualReview:false,source:"linked_master",
});
assert.deepEqual(selectVerifiedN8nInsuredDraftIdentity(syntheticIdentity,{
  id:"synthetic-customer-2",name:"OTHER SYNTHETIC HOLDER",
}),{
  name:"TEST POLICYHOLDER",matchedCustomerId:null,
  needsManualReview:true,source:"conflict",
},"Conflicting PDF identity must never auto-link an existing customer");
assert.equal(selectVerifiedN8nInsuredDraftIdentity([
  {key:"insured_name",value:"TEST POLICYHOLDER",page:2,evidence:"Nominee Name"},
],null).name,"","Reject unlabeled or wrong-source PDF identities");
assert.equal(selectVerifiedN8nInsuredDraftIdentity([
  {key:"insured_name",value:"UNKNOWN",page:1,evidence:"Name of Insured"},
],null).name,"","Reject invalid insured names");
assert(sameInsuredIdentity(" TEST   POLICYHOLDER ","test policyholder"),
  "Linked-master match must normalize whitespace and case");

// Exact ICICI 3005 Chetak mapping, field-order dependencies and verified identity review.
assert.deepEqual(splitN8nRtoStateAndCity("MADHYA PRADESH-JABALPUR"),{
  state:"Madhya Pradesh",city:"Jabalpur",
});
assert.equal(splitN8nRtoStateAndCity("UNKNOWN REGION-JABALPUR"),null,
  "Unrecognised RTO states must remain manual, not guessed");
const enriched = enrichVerifiedN8nOnboardingFields([
  {key:"insured_name",label:"Insured",value:"SYNTHETIC CUSTOMER"},
  {key:"policy_product",label:"Product",value:"Bundled"},
  {key:"vehicle_make",label:"Make",value:"CHETAK"},
  {key:"vehicle_model",label:"Model",value:"C2501"},
  {key:"vehicle_rto_name",label:"RTO",value:"MADHYA PRADESH-JABALPUR"},
  {key:"vehicle_motor_power_kw",label:"CC/KW",value:"2.2"},
]);
assert(!enriched.some(f=>f.key==="insured_name"),"No PDF insured name may enter draft");
const baseState={
  registrationNo:"",vehicleClass:"",make:"",model:"",fuelType:"",manufacturingYear:"",
  capacity:"",chassisNo:"",engineNo:"",rtoState:"",rtoName:"",policyProduct:"",
  idv:"",od:"",tp:"",cpa:"",policyNo:"",insurerId:"",validFrom:"",validUpto:"",
};
const mappedChetak = buildPolicyOcrOnboardingUpdate({
  mode:"create",registrationMode:"unregistered",current:baseState,
  fields:enriched,manufacturers:["Bajaj","Bajaj Auto"],insurers:[],rcVerified:false,
});
assert.equal(mappedChetak.next.vehicleClass,"TWP");
assert.equal(mappedChetak.next.make,"Bajaj");
assert.equal(mappedChetak.next.fuelType,"Electric");
assert.equal(mappedChetak.next.rtoState,"Madhya Pradesh");
assert.equal(mappedChetak.next.rtoName,"Jabalpur");
assert.equal(mappedChetak.next.capacity,"2.2");
assert.equal(mappedChetak.next.policyProduct,"Bundled");
// ICICI 3005 sibling layout prints "CHETAK / CHETAK 3503" instead of
// "CHETAK / C3503". Keep the printed model, and select the canonical
// TWP/Bajaj/Electric/Bundled controls with motor power from CC/KW, not seats.
const c3503Fields=[
  {key:"policy_product",label:"Policy product",value:"Bundled"},
  {key:"vehicle_make",label:"Make",value:"CHETAK"},
  {key:"vehicle_model",label:"Model",value:"CHETAK 3503"},
  {key:"vehicle_rto_name",label:"RTO",value:"MADHYA PRADESH-JABALPUR"},
  {key:"vehicle_motor_power_kw",label:"Motor kW",value:"4.2"},
];
const c3503Enriched=enrichVerifiedN8nOnboardingFields(c3503Fields);
assert.equal(c3503Enriched.find(f=>f.key==="vehicle_class")?.value,"TWP",
  "CHETAK 3503 must be recognized as a two wheeler");
assert.equal(c3503Enriched.find(f=>f.key==="vehicle_fuel_type")?.value,"Electric",
  "CHETAK 3503 must be recognized as a verified electric Chetak");
const mapped3503=buildPolicyOcrOnboardingUpdate({
  mode:"create",registrationMode:"unregistered",current:baseState,
  fields:c3503Enriched,manufacturers:["Bajaj","Bajaj Auto Limited"],insurers:[],rcVerified:false,
});
assert.equal(mapped3503.next.vehicleClass,"TWP");
assert.equal(mapped3503.next.make,"Bajaj");
assert.equal(mapped3503.next.model,"CHETAK 3503","Preserve the exact printed model");
assert.equal(mapped3503.next.fuelType,"Electric");
assert.equal(mapped3503.next.capacity,"4.2","Never read 2 seats as 2 kW");
assert.equal(normalizeVerifiedMotorPowerKw("4.2 kW"),"4.2");
assert.equal(normalizeVerifiedMotorPowerKw("4.2 (KW)"),"4.2");
assert.equal(normalizeVerifiedMotorPowerKw("2 seats"),"");
assert.equal(normalizeVerifiedMotorPowerKw("3503"),"");
assert.equal(normalizeVerifiedMotorPowerKw("0"),"");
assert.equal(normalizeVerifiedMotorPowerKw("55"),"");
// Regression: real OD policies often print BAJAJ as make and CHETAK 3503
// as model. The old branch only copied motor kW for raw make CHETAK.
const odBajajFields=[
  {key:"policy_product",label:"Product",value:"Stand-Alone Own Damage"},
  {key:"vehicle_class",label:"Class",value:"Two Wheeler"},
  {key:"vehicle_make",label:"Make",value:"BAJAJ"},
  {key:"vehicle_model",label:"Model",value:"CHETAK 3503"},
  {key:"vehicle_fuel_type",label:"Fuel",value:"Electric"},
  {key:"vehicle_motor_power_kw",label:"CC/KW",value:"4.2 kW"},
  {key:"vehicle_capacity",label:"Seats",value:"2"},
];
const mappedOdBajaj=buildPolicyOcrOnboardingUpdate({
  mode:"create",registrationMode:"registered",current:baseState,
  fields:odBajajFields,manufacturers:["Bajaj"],insurers:[],rcVerified:false,
});
assert.equal(mappedOdBajaj.next.make,"Bajaj");
assert.equal(mappedOdBajaj.next.capacity,"4.2","OD Electric power must be copied independently of OEM alias");
assert.equal(mappedOdBajaj.next.policyProduct,"SAOD");
assert.equal(buildPolicyOcrOnboardingUpdate({
  mode:"create",registrationMode:"registered",current:baseState,
  fields:odBajajFields.filter(f=>f.key!=="vehicle_motor_power_kw"),
  manufacturers:["Bajaj"],insurers:[],rcVerified:false,
}).next.capacity,"","Without CC/KW, never substitute a seating count.");
assert.equal(mapped3503.next.policyProduct,"Bundled");
assert.equal(mapped3503.next.rtoState,"Madhya Pradesh");
assert.equal(mapped3503.next.rtoName,"Jabalpur");

// Until the fixed draft n8n workflow is published, its old response has
// no CC/KW evidence: class/make/fuel/product can be filled, kW cannot.
const withoutPower=buildPolicyOcrOnboardingUpdate({
  mode:"create",registrationMode:"unregistered",current:baseState,
  fields:enrichVerifiedN8nOnboardingFields(c3503Fields.filter(f=>f.key!=="vehicle_motor_power_kw")),
  manufacturers:["Bajaj Auto Limited"],insurers:[],rcVerified:false,
});
assert.equal(withoutPower.next.vehicleClass,"TWP");
assert.equal(withoutPower.next.make,"Bajaj Auto Limited");
assert.equal(withoutPower.next.capacity,"","Never infer motor kW from model alone");

// Exact-match guard: an untrained 3503 variant must remain manual.
const unknown3503=enrichVerifiedN8nOnboardingFields(c3503Fields.map(f=>
  f.key==="vehicle_model"?{...f,value:"CHETAK 3503 PLUS"}:f));
assert(!unknown3503.some(f=>f.key==="vehicle_class"||f.key==="vehicle_fuel_type"),
  "Unrecognized Chetak variant must not be automatically classified");
const unmapped3503=buildPolicyOcrOnboardingUpdate({
  mode:"create",registrationMode:"unregistered",current:baseState,
  fields:unknown3503,manufacturers:["Bajaj"],insurers:[],rcVerified:false,
});
assert.equal(unmapped3503.next.vehicleClass,"");
assert.equal(unmapped3503.next.make,"");
assert.equal(unmapped3503.next.policyProduct,"");
assert.equal(unmapped3503.next.capacity,"");
const code3503=enrichVerifiedN8nOnboardingFields(c3503Fields.map(f=>
  f.key==="vehicle_model"?{...f,value:"C3503"}:f));
assert.equal(code3503.find(f=>f.key==="vehicle_class")?.value,"TWP",
  "Existing C3503 alias must not regress");

const unknownModel = enrichVerifiedN8nOnboardingFields([
  {key:"policy_product",label:"Product",value:"Bundled"},
  {key:"vehicle_make",label:"Make",value:"CHETAK"},
  {key:"vehicle_model",label:"Model",value:"UNVERIFIED"},
]);
assert(!unknownModel.some(f=>f.key==="vehicle_class"||f.key==="vehicle_fuel_type"),
  "Never infer model-specific fuel or class for an unverified vehicle variant");

const n8nMoney = mapVerifiedN8nMotorPremium({
  basicOd: 1583, odAddons: [{name:"Test RSA",amount:240},{name:"Test accessory",amount:443}],
  totalOd: 2266,basicTp:3273,cpa:575,liability:3848,net:6114,
  exactIgst:1100.52,tax:1101,gross:7215,
});
assert.deepEqual(n8nMoney,{
  od:"1583",addOnPremium:"683",tp:"3273",cpa:"575",cpaOpted:"Yes",
},"Canonical Motor form must enter Basic OD and add-on separately, avoiding double counting");
assert.equal(Number(n8nMoney.od)+Number(n8nMoney.addOnPremium)+Number(n8nMoney.tp)+Number(n8nMoney.cpa),
  6114,"The bookable net amount must match printed n8n net premium");
assert.throws(()=>mapVerifiedN8nMotorPremium({
  basicOd:1583,odAddons:[{name:"Test",amount:684}],totalOd:2266,basicTp:3273,
  cpa:575,liability:3848,net:6114,exactIgst:1100.52,tax:1101,gross:7215,
}),/n8n_motor_premium_handoff_unreconciled/,
  "A one-rupee component mismatch must block forwarding");

// Future AI conversion queue must fail closed before canonical preflight.
// Synthetic fields only. No customer names, phones, vehicle IDs or live policies.
const aiRequiredKeys = [
  "insured_name","policy_number","insurer_name","vehicle_class","vehicle_make",
  "vehicle_model","vehicle_fuel_type","vehicle_manufacturing_year",
  "vehicle_chassis_number","vehicle_engine_number","vehicle_rto_name",
  "policy_product","policy_start_date","policy_end_date",
  "third_party_end_date","idv","od_premium","tp_premium","vehicle_motor_power_kw",
];
const aiBase = {
  policyType:"motor", intakeStatus:"in_review", isDuplicate:false,
  hasCurrentDocument:true, documentStillCurrent:true,
  parserId:"icici_3005_n8n_native_pdf", parserChecksPassed:13,
  extractionState:"success", extractionWarnings:[],
  fields:aiRequiredKeys.map(key=>({key,value:key==="vehicle_motor_power_kw"?"4.2":"SYNTHETIC"})),
  premiumReconciled:true, matchedManufacturer:true,
  customerMatch:"unique_exact", sharedPhoneHasDistinctNames:false,
  existingCustomerSameIdentity:true, reviewerAssignedToAnother:false,
  vehicleOwnerConflict:false, coverageConflict:false,
  savedDraftConflictsWithPdf:false, issuanceDateVerified:true,
  needsDateApproval:false, bundledPeriodsVerified:true,
  canonicalPreflightPassed:true,
};
const assessAi=overrides=>assessAiPolicyIntake({...aiBase,...overrides});
assert.deepEqual(assessAi().state,"eligible",
  "Only full validated extraction with explicit canonical preflight can be eligible");
assert.equal(assessAi({canonicalPreflightPassed:false}).state,"preflight_pending",
  "n8n success alone is not permission to book a policy");
const blockedBy=(code,overrides)=>assert(assessAi(overrides).exceptions.some(e=>e.code===code&&e.blocking),
  code+" must block one-click and bulk booking");
assert.equal(assessAi({sharedPhoneHasDistinctNames:true,customerMatch:"name_conflict"}).state,"eligible",
  "Same mobile but DIFFERENT verified insured requires canonical new-customer creation, not an exception");
assert.equal(assessAi({customerMatch:"none",existingCustomerSameIdentity:false}).state,"eligible",
  "No matching customer is a standard create-new flow, not a blocker");
blockedBy("customer_ambiguous",{customerMatch:"multiple"});
assert.equal(assessAi({sharedPhoneHasDistinctNames:false}).state,"eligible",
  "One mobile on several same-person policies is not automatically a conflict");
blockedBy("duplicate_policy",{isDuplicate:true});
blockedBy("unverified_parser",{parserChecksPassed:12});
blockedBy("unsupported_layout",{policyType:"health"});
blockedBy("stale_document",{documentStillCurrent:false});
blockedBy("date_approval",{needsDateApproval:true});
blockedBy("issuance_date_unverified",{issuanceDateVerified:false});
blockedBy("bundled_validity",{bundledPeriodsVerified:false});
blockedBy("financial_reconciliation",{premiumReconciled:false});
blockedBy("manufacturer_unmatched",{matchedManufacturer:false});
blockedBy("vehicle_ownership",{vehicleOwnerConflict:true});
blockedBy("coverage_conflict",{coverageConflict:true});
blockedBy("draft_conflict",{savedDraftConflictsWithPdf:true});
blockedBy("missing_field",{fields:aiBase.fields.filter(f=>f.key!=="vehicle_motor_power_kw")});
blockedBy("extraction_failed",{extractionState:"failed"});
blockedBy("reviewer_conflict",{reviewerAssignedToAnother:true});
assert.equal(assessAi({intakeStatus:"processing"}).state,"eligible",
  "Normal Intake Processing status is not itself a reviewer conflict; booking separately claims in_review");
assert.deepEqual(assessAi({policyType:"life"}).state,"unsupported",
  "Unsupported policy categories never enter the one-click bulk queue");

// Unattended extraction is private and fail-closed. No booking call should
// ever be reachable from the queue processor or scheduler endpoint.
const workerText=text("lib/ai-policy-onboarding-queue-server.ts");
const routeText=text("app/api/internal/ai-policy-onboarding/process/route.ts");
const actionsText=text("app/development/ai-policy-onboarding/actions.ts");
const workbenchText=text("components/development/semi-auto-policy-workspace.tsx");
const queueSql=readFileSync(new URL("../../../supabase/migrations/20261117154000_policy_intake_ai_processing_queue.sql",import.meta.url),"utf8");
const queueV2Sql=readFileSync(new URL("../../../supabase/migrations/20261117170000_ai_policy_priority_batch_queue_v2.sql",import.meta.url),"utf8");
const iciciSyncV2Sql=readFileSync(new URL("../../../supabase/migrations/20261118103431_icici_3005_ai_verified_ocr_sync_v2.sql",import.meta.url),"utf8");
const prioritizedQueueSql=readFileSync(new URL("../../../supabase/migrations/20261117173000_ai_policy_prioritize_trained_3005.sql",import.meta.url),"utf8");
const normalUploadActions=text("app/policy-intakes/actions.ts");
const partnerUploadApi=text("app/api/partner/policy-intakes/route.ts");
const schedulerYaml=readFileSync(new URL("../../../.github/workflows/ai-policy-intake-extraction.yml",import.meta.url),"utf8");
assert(workerText.includes("offset<ids.length;offset+=100")
  && workerText.includes("ids.slice(offset,offset+100)"),
  "All authorized open Intakes must contribute to AI queue counts across pages");
assert(workerText.includes("previewSemiAutoN8nExtraction(")
  && workerText.includes("claim_policy_intake_ai_queue_v2")
  && workerText.includes("canonicalPreflightPassed:false"),
  "Background extraction must use current signed n8n PDF, atomically claim and never mark booking-ready on parse success");
assert(!workerText.includes("onboardPolicy(")
  && !routeText.includes("onboardPolicy("),
  "Unattended extraction can NEVER create a policy or customer");
assert(routeText.includes("timingSafeEqual")
  && routeText.includes("INSUREIT_AI_QUEUE_WORKER_TOKEN")
  && routeText.includes("aiQueueEnabled()"),
  "Worker must authenticate and be explicitly feature flagged");
assert(queueSql.includes("enable row level security")
  && queueSql.includes("for update of q skip locked")
  && queueSql.includes("revoke all on public.policy_intake_ai_processing_queue from public, anon, authenticated"),
  "Private service-role queue requires RLS, transactional leases, and no public read/write grants");
assert(schedulerYaml.includes("vars.INSUREIT_AI_QUEUE_SCHEDULE_ENABLED == 'true'")
  && schedulerYaml.includes("secrets.INSUREIT_AI_QUEUE_WORKER_TOKEN"),
  "Automatic scheduler must remain disabled until separately approved and configured");
assert(workbenchText.includes("Resolve policy exceptions")
  && workbenchText.includes("Convert Verified Candidates")
  && workbenchText.includes("Confirm bulk Policy registration")
  && workbenchText.includes("convertVerifiedAiIntake(item.id,true)")
  && workbenchText.includes("queueActive)"),
  "Queue UI must show an operator-confirmed, bounded bulk conversion that reuses canonical per-Intake preflight");
assert(actionsText.includes("reprocessAiPolicyIntake")
  && actionsText.includes("requireDevelopmentPolicyOperator(id)"),
  "Each manual background reprocess request must require the current authorized reviewer");
const vercelConfig=JSON.parse(text("vercel.json"));
assert.deepEqual(vercelConfig.crons,[
  {path:"/api/internal/ai-policy-onboarding/process",schedule:"* * * * *"},
], "Vercel Pro should provide a one-minute durable fallback, separate from immediate Intake hooks");
assert(routeText.includes("export async function GET(request: NextRequest)")
  && routeText.includes("authorized(request, process.env.CRON_SECRET??")
  && routeText.includes("secret.length < 32")
  && routeText.includes("timingSafeEqual")
  && !routeText.includes("vercel-cron") 
  && routeText.includes("aiQueueEnabled()"),
  "Vercel Cron must use a 32+ byte independent Bearer secret and queue flag; user-agent is never authority");
assert(routeText.includes("export async function POST(request: NextRequest)")
  && routeText.includes("process.env.INSUREIT_AI_QUEUE_WORKER_TOKEN??"),
  "Existing opt-in GitHub Actions worker POST must remain independently protected");
// Policy Intake Register counts must match the AI workbench using the same
// authorized open set and derived duplicate buckets, not an OCR worker state.
const parityRows=[
  {id:"act",status:"processing",ocr_status:"failed"},
  {id:"review",status:"in_review",ocr_status:"completed"},
  {id:"duplicate-open",status:"ready_for_review",ocr_status:"completed"},
  {id:"regular-processing",status:"processing",ocr_status:"pending"},
  {id:"duplicate-rejected",status:"rejected",ocr_status:"completed"},
  {id:"completed",status:"completed",ocr_status:"completed"},
];
const parityDuplicateIds=new Set(["duplicate-open","duplicate-rejected"]);
const registerBucketCounts=policyIntakeStatusCounts(parityRows,parityDuplicateIds);
assert.deepEqual({
  action:registerBucketCounts.action_required,inReview:registerBucketCounts.in_review,
  processing:registerBucketCounts.processing,duplicate:registerBucketCounts.duplicate,
},{action:1,inReview:1,processing:1,duplicate:2});
const openStatuses=new Set(["ready_for_review","in_review","needs_attention","processing"]);
const aiOpenRows=parityRows.filter(x=>openStatuses.has(x.status));
const aiBucketCounts=policyIntakeStatusCounts(aiOpenRows,parityDuplicateIds);
assert.deepEqual({action:aiBucketCounts.action_required,review:aiBucketCounts.in_review,
  processing:aiBucketCounts.processing,openDuplicates:aiBucketCounts.duplicate,all:aiBucketCounts.all},
  {action:1,review:1,processing:1,openDuplicates:1,all:4},
  "Open-only AI counts match the Register's same buckets while excluding rejected/completed duplicates");
const aiPageText=text("app/development/ai-policy-onboarding/page.tsx");
assert(aiPageText.includes("policyIntakeStatusCounts(workspaceRows,duplicateIds)")
  && aiPageText.includes("getPartnerEmployeeIntakeReadScope")
  && aiPageText.includes("policyIntakeBucket(row,duplicateIds.has(row.id)) === selectedView")
  && aiPageText.includes("const pageRows: SemiAutoIntakeRow[] = statusRows"),
 "AI Intake status tabs must use canonical register bucket and authorized scope before paging");
assert(aiPageText.includes('if(item.state==="pending")queueCounts.queued++')
  && aiPageText.includes('else if(item.state==="processing")queueCounts.extracting++'),
  "n8n queue pending cannot be counted as Intake workflow Processing");
assert(!aiPageText.includes("ai_exceptions: row.is_duplicate")
  && aiPageText.includes('new Set(["duplicate_policy"'),
  "Derived duplicate rows must show a blocking exception even before n8n extracts them");
assert(workbenchText.includes("Queued for n8n")
  && workbenchText.includes("Reading PDF")
  && workbenchText.includes("Intake workflow")
  && workbenchText.includes("router.refresh()"),
  "Queue and Intake statuses must be separated and periodically refreshed");
assert(aiPageText.includes("viewLink(selectedView,safePage + 1)")
  && aiPageText.includes("statusRows.length"),
  "Server-side Intake status filtering must paginate the whole chosen status group, not only the first 75 records");
// Phase 2 customer exception lookup must stay privileged/read-only until
// the canonical customer decision, duplicate and booking transactions exist.
const customerPreviewStart=actionsText.indexOf("export async function reviewAiIntakeCustomerCandidates");
const customerPreviewEnd=actionsText.indexOf("export async function reprocessAiPolicyIntake",customerPreviewStart);
assert(customerPreviewStart>0 && customerPreviewEnd>customerPreviewStart,
  "Customer identity candidate action must be available for exception review");
const customerPreviewCode=actionsText.slice(customerPreviewStart,customerPreviewEnd);
assert(customerPreviewCode.includes("requireDevelopmentPolicyOperator(id)")
  && customerPreviewCode.includes("previewSemiAutoN8nExtraction(id)")
  && customerPreviewCode.includes('extraction.preview.checksPassed===13')
  && customerPreviewCode.includes('extraction.preview.warnings.length===0')
  && customerPreviewCode.includes('normalizedPhone(row.phone)===phone')
  && customerPreviewCode.includes('.eq("customer_mobile",intake.customer_mobile)')
  && customerPreviewCode.includes('otherOpenIntakes=group.error')
  && customerPreviewCode.includes('truncated=(rows??[]).length>=51'),
  "AI customer candidate review must reverify the current PDF, filter exact normalized phone and fail closed on too many matches");
assert(!customerPreviewCode.includes(".update(") && !customerPreviewCode.includes(".insert(")
  && !customerPreviewCode.includes("onboardPolicy("),
  "Customer exception review is strictly read-only and cannot create/link customers or book a policy");
assert(workbenchText.includes("Check customer matches")
  && workbenchText.includes("Create New Customer")
  && workbenchText.includes("Create New Customer with Policy")
  && !workbenchText.includes("/customers?choose_partner=1")
  && workbenchText.includes("reprocessAiPolicyIntake(row.id)")
  && workbenchText.includes("This mobile also appears on")
  && workbenchText.includes("reviewAiIntakeCustomerCandidates(exceptionRow.id)"),
  "Customer decision popup provides guided canonical review/create routes, not a silent automatic link");
// Event-driven n8n-first ingestion must cover both Operations and Partner
// original uploads AND successful document replacements. No Google OCR should
// be invoked when the verified n8n workbench/queue is enabled.
assert(normalUploadActions.includes("processAiQueueBatch({preferredIntakeId:input.id})")
  && normalUploadActions.split("processAiQueueBatch({preferredIntakeId:input.id})").length===3
  && normalUploadActions.includes('if(aiQueueEnabled() && (!segregatePolicyIntakeLanes() || lane==="automation"))')
  && normalUploadActions.includes('if(aiQueueEnabled() && !segregatePolicyIntakeLanes())'),
  "Operations originals must dispatch immediate n8n only in automation lane; manual replacements cannot bypass isolation");
assert(partnerUploadApi.includes("processAiQueueBatch({preferredIntakeId:input.id})")
  && partnerUploadApi.split("processAiQueueBatch({preferredIntakeId:input.id})").length===3
  && partnerUploadApi.includes('if (!proposalForm && aiQueueEnabled() && (!segregatePolicyIntakeLanes() || lane==="automation"))')
  && partnerUploadApi.includes('if (!proposalForm && aiQueueEnabled() && (!segregatePolicyIntakeLanes() || intake.processing_lane==="automation"))'),
  "Partner and Branch originals and replacements must dispatch n8n only for automation lane");
assert(workerText.includes("const MAX_BATCH = 6")
  && workerText.includes("const MAX_CONCURRENT = 3")
  && workerText.includes("Promise.all(wave.map(")
  && workerText.includes("p_preferred_intake_id:preferredIntakeId??null"),
  "Backlog uses bounded three-way concurrency; an immediate upload claims only its own Intake");
assert(workerText.includes('sync_verified_ai_intake_ocr_v2')
  && workerText.includes('p_parser_revision:parserRevision')
  && workerText.includes('p_parser_id:extraction.preview.parserId')
  && workerText.includes('synced.data!==true')
  && workerText.includes('loadPolicyIntakeDuplicateMatches(admin,[{')
  && workerText.includes('isDuplicate, // Derived from the canonical'),
  "Strict n8n PDF fields must feed canonical duplicate status and OCR through an identity- and lease-checked RPC");
assert(iciciSyncV2Sql.includes("create or replace function public.sync_verified_ai_intake_ocr_v2")
  && iciciSyncV2Sql.includes("p_parser_id='icici_3005_od_n8n_native_pdf'")
  && iciciSyncV2Sql.includes("p_parser_version='bridge-od-v1'")
  && iciciSyncV2Sql.includes("q.parser_revision=p_parser_revision")
  && iciciSyncV2Sql.includes("q.lease_id=p_lease_id")
  && iciciSyncV2Sql.includes("i.final_policy_id is null")
  && iciciSyncV2Sql.includes("policy_intake_onboarding_drafts")
  && iciciSyncV2Sql.includes("grant execute on function public.sync_verified_ai_intake_ocr_v2")
  && !iciciSyncV2Sql.includes("insert into public.policies"),
  "v2 OCR sync must preserve customer drafts, completed policies and service-role-only lease guards");
assert.equal(queueV2Sql.split("\n").filter(line=>line.trim()==="as $$").length,2, "Both private queue SQL functions need correctly paired PL/pgSQL dollar-quote openings");
assert.equal(queueV2Sql.split("\n").filter(line=>line.trim()==="$$;").length,2, "Both private queue SQL functions need correctly paired PL/pgSQL dollar-quote closings");
assert(queueV2Sql.includes("create or replace function public.claim_policy_intake_ai_queue_v2")
  && queueV2Sql.includes("p_preferred_intake_id uuid default null")
  && queueV2Sql.includes("p_max > 8")
  && queueV2Sql.includes("for update of q skip locked")
  && queueV2Sql.includes("revoke all on function public.claim_policy_intake_ai_queue_v2"),
  "Priority/large queue claims must retain service-role gates and SKIP LOCKED leases");
assert(queueV2Sql.includes("create or replace function public.sync_verified_ai_intake_ocr_v1")
  && queueV2Sql.includes("current_user <> 'service_role'")
  && queueV2Sql.includes("p_checks_passed <> 13")
  && queueV2Sql.includes("coalesce(i.ocr_fields,'[]'::jsonb)='[]'::jsonb")
  && queueV2Sql.includes("not exists(")
  && queueV2Sql.includes("policy_intake_onboarding_drafts")
  && queueV2Sql.includes("q.lease_id=p_lease_id")
  && queueV2Sql.includes("d.is_current=true")
  && !queueV2Sql.includes("insert into public.policies"),
  "Canonical OCR synchronization requires strict checked current PDF/lease, empty fields and no saved draft; never books");
// 3005 Motor filename may only affect queue attempt priority. Untrained
// formats remain valid review items and must not be silently dropped.
assert(prioritizedQueueSql.includes("case when i.policy_type='motor' and i.file_name ilike '3005%' then 0 else 1 end")
  && prioritizedQueueSql.includes("q.retry_after asc,q.created_at asc")
  && prioritizedQueueSql.includes("for update of q skip locked")
  && prioritizedQueueSql.includes("current_user <> 'service_role'")
  && prioritizedQueueSql.includes("p_preferred_intake_id is null or q.intake_id=p_preferred_intake_id")
  && prioritizedQueueSql.includes("grant execute on function public.claim_policy_intake_ai_queue_v2")
  && !prioritizedQueueSql.includes("insert into public.policies")
  && !prioritizedQueueSql.includes("delete from public.policy_intake_requests"),
  "Trained PDF filename can change only order; private priority claim must retain lease and authorization checks");
assert.equal(prioritizedQueueSql.split("\n").filter(line=>line.trim()==="as $$").length,1);
assert.equal(prioritizedQueueSql.split("\n").filter(line=>line.trim()==="$$;").length,1);
// Corrected n8n date handoff, genuine exception taxonomy and duplicate skip.
const duplicateQueueSql=readFileSync(new URL("../../../supabase/migrations/20261117190000_ai_policy_duplicate_queue_and_reassess.sql",import.meta.url),"utf8");
assert(handoff.includes('const verifiedIssuanceDate=verified?.fields.find(field=>field.key==="policy_issuance_date")?.value')
  && handoff.includes('issuanceDate:verified?(verifiedIssuanceDate||approvedSigningDate):new Date().toISOString().slice(0,10)')
  && handoff.includes('reviewerConfirmedSigningDate')
  && handoff.includes('expectedDraftRevision')
  && handoff.includes('"manufacturingYear","issuanceDate"'),
  "Verified n8n handoff must use the PDF's own issuance date and fill only empty saved draft dates");
assert(n8nValidator.includes('"policy_issuance_date"')
  && n8nValidator.includes('if (issuanceDate && !isoDate(issuanceDate))'),
  "Accept strict independent issue dates while rejecting invalid dates");
assert(!workerText.includes("const bundledPeriodsVerified=!bundled;")
  && workerText.includes('issuanceDecision==="otp_required"')
  && workerText.includes('const bundledPeriodsVerified=!bundled||('),
  "A validated bundled period is not an exception, but actual earlier-month OTP remains blocking");
assert(workerText.includes('const state:AiQueueState=isDuplicate?"duplicate"')
  && workerText.includes('filter(e=>e.code!=="preflight_pending")')
  && workerText.includes('existingDuplicate.matches.has(intake.id)')
  && workerText.indexOf('existingDuplicate.matches.has(intake.id)')<workerText.indexOf('const extraction=await previewSemiAutoN8nExtraction'),
  "Recognized duplicate must bypass expensive n8n and preflight pending is not a document exception");
assert(duplicateQueueSql.includes("policy_intake_ai_processing_queue_state_check")
  && duplicateQueueSql.includes("'duplicate'")
  && duplicateQueueSql.includes("q.state='exception'")
  && duplicateQueueSql.includes("state='pending'")
  && duplicateQueueSql.includes("q.state <> 'duplicate'")
  && duplicateQueueSql.includes("for update of q skip locked")
  && !duplicateQueueSql.includes("delete from public.policy_intake_requests")
  && !duplicateQueueSql.includes("insert into public.policies"),
  "Queue-only migration safely retires canonical duplicates and reschedules old false exceptions");
assert.equal(duplicateQueueSql.split("\n").filter(x=>x.trim()==="as $$").length,1,
  "Migration must open one PL/pgSQL body");
assert.equal(duplicateQueueSql.split("\n").filter(x=>x.trim()==="$$;").length,1,
  "Migration must close one PL/pgSQL body");
assert(aiPageText.includes("queueCounts.extracted++") && aiPageText.includes("if(duplicate)continue;"),
  "Verified extraction count cannot misstate automatic booking eligibility or include duplicate PDFs");
assert(workbenchText.includes("Duplicates skipped") && workbenchText.includes("PDF extracted")
  && workbenchText.includes("Duplicate · skipped"),
  "Queue UI must show true extraction progress and skipped duplicates separately");
// One-click conversion must use canonical transaction, and never trust
// browser fields or silently reuse a different insured's mobile match.
const convertStart=actionsText.indexOf("export async function convertVerifiedAiIntake(");
const convertEnd=actionsText.indexOf("export async function bookSemiAutoIntake(",convertStart);
assert(convertStart>0&&convertEnd>convertStart,
  "A separate one-click verified n8n conversion action must be available");
const convertCode=actionsText.slice(convertStart,convertEnd);
assert(convertCode.includes("await requireDevelopmentPolicyOperator(id)")
  && convertCode.includes('queued.state!=="verified"')
  && convertCode.includes("extracted.preview.fingerprint!==queued.extraction_fingerprint")
  && convertCode.includes('prepareVerifiedN8nIntakeHandoff(id,queued.document_id')
  && convertCode.includes('decision==="otp_required"')
  && convertCode.includes('forwarded.draft.issuanceDate!==issuanceDate')
  && convertCode.includes('normalizedIdentity(pdfField("insured_name"))')
  && convertCode.includes('mapVerifiedN8nMotorPremium(extracted.preview.premium)')
  && convertCode.includes('forwarded.draft.addOnPremium')
  && convertCode.includes('forwarded.draft.tpValidUpto')
  && convertCode.includes('createNewCustomer:true')
  && convertCode.includes('await onboardPolicy(payload)'),
  "One-click conversion must independently reverify current PDF, name, premiums, policy number, issued date and OTP, then use the canonical policy/customer transaction");
assert(convertCode.includes('queued.extraction_fingerprint,true,true')
  && convertCode.includes('normalizeVerifiedMotorPowerKw(pdfField("vehicle_motor_power_kw"))')
  && convertCode.includes('forwarded.draft.capacity!==verifiedKw')
  && convertCode.includes('await requireDevelopmentPolicyOperator(id)'),
  "Only the confirmed authorized auto-converter may atomically take reviewer ownership and fill empty verified kW fields");
assert(handoff.includes('if(assignedToAnother&&!takeOver)')
  && handoff.includes('assignmentQuery.eq("assigned_to_profile_id",intake.assigned_to_profile_id as string)'),
  "Manual reviewer assignment gate and optimistic takeover guard must be preserved");
assert(!convertCode.includes('dateApprovalId:"') && !convertCode.includes('confirmPolicyReplacement:true'),
  "Automatic customer creation must never manufacture an email OTP approval or override an active policy");
assert(actionsText.includes('addOnPremium:d.addOnPremium||"0"')
  && actionsText.includes("cpaValidUpto:d.cpaValidUpto||d.tpValidUpto"),
  "Canonical payload must preserve independently verified OD add-ons and bundled cover periods");
assert(workbenchText.includes("Convert to Policy")&&workbenchText.includes("Confirm & Convert")
  && workbenchText.includes("convertVerifiedAiIntake(row.id,true)")
  && workbenchText.includes('role="alertdialog"'),
  "Verified conversion must have a working custom confirmation, never a no-op redirect");
// An older missing-issue-date n8n draft must never falsely show today.
const onboardingPageText=text("app/policies/new/page.tsx");
assert(onboardingPageText.includes("Policy issuance date is not verified in the current PDF extraction")
  && onboardingPageText.includes("!workflowInitialValues.issuanceDate")
  && onboardingPageText.includes("/development/ai-policy-onboarding?intake_id="),
  "A missing n8n issue date needs a visible recheck path and cannot be silently replaced with today");
assert(!workbenchText.includes('<Link href="/customers?choose_partner=1"')
  && workbenchText.includes("A separate customer will be created as part of the policy booking transaction")
  === false,
  "The customer-resolution popup must not redirect to unrelated Customer Register onboarding");
const issuanceBackfillSql=readFileSync(new URL("../../../supabase/migrations/20261117193000_verified_ai_draft_issuance_backfill.sql",import.meta.url),"utf8");
assert(issuanceBackfillSql.includes("current_user <> 'service_role'")
  && issuanceBackfillSql.includes("coalesce(d.draft_payload->>'issuanceDate','')=''")
  && issuanceBackfillSql.includes("q.extraction_fingerprint=p_fingerprint")
  && issuanceBackfillSql.includes("q.checks_passed=13")
  && issuanceBackfillSql.includes("q.field_keys @> array['policy_issuance_date']")
  && issuanceBackfillSql.includes("doc.is_current=true")
  && issuanceBackfillSql.includes("d.revision+1")
  && issuanceBackfillSql.includes("q.state in ('verified','exception')")
  && !issuanceBackfillSql.includes("insert into public.policies"),
  "Server-only issue date backfill must require current document/verified n8n fingerprint and modify only an empty draft date");
assert.equal(issuanceBackfillSql.split("\n").filter(line=>line.trim()==="as $$").length,1);
assert.equal(issuanceBackfillSql.split("\n").filter(line=>line.trim()==="$$;").length,1);
assert(workerText.includes('fill_verified_ai_draft_issuance_date_v1')
  && workerText.includes('if(completed && (state==="verified" || state==="exception")')
  && workerText.includes('issuanceDateVerified && pdfIssuanceDate'),
  "Only a completed, strictly verified n8n result may auto-fill an empty issue date");
const aiIssueSchemaWorkflow=readFileSync(new URL("../../../.github/workflows/apply-ai-policy-issuance-backfill.yml",import.meta.url),"utf8");
const productionDeployGate=readFileSync(new URL("../../../.github/workflows/deploy-production.yml",import.meta.url),"utf8");
assert(aiIssueSchemaWorkflow.includes("20261117193000_verified_ai_draft_issuance_backfill.sql")
  && aiIssueSchemaWorkflow.includes("workflow_dispatch:")
  && aiIssueSchemaWorkflow.includes("supabase migration repair --linked --status applied 20261117193000")
  && aiIssueSchemaWorkflow.includes("service_exec")
  && aiIssueSchemaWorkflow.includes("auth_exec"),
  "Issuance migration must have a gated Supabase schema workflow with service-role permission verification");
assert(productionDeployGate.includes('schema_workflow="apply-ai-policy-issuance-backfill.yml"')
  && productionDeployGate.includes("AI Policy issuance-date backfill migration detected"),
  "Production deployment must wait on the exact issuance-date schema workflow instead of timing out");
// Selecting an already-processed Intake must show retained OCR without re-running n8n.
assert(workbenchText.includes("Previously extracted details · saved OCR")
  && workbenchText.includes("selected.ocr_fields.filter(")
  && workbenchText.includes("Re-extract current PDF")
  && workbenchText.includes("These are not current n8n-verified results"),
  "AI Intake selection must immediately show clearly labelled saved OCR details");
const aiWorkbenchPageText=text("app/development/ai-policy-onboarding/page.tsx");
assert(aiWorkbenchPageText.includes("ocr_fields: Array.isArray(row.ocr_fields)")
  && aiWorkbenchPageText.includes("getPartnerEmployeeIntakeReadScope"),
  "Saved OCR must remain in the existing scoped Intake list");
const n8nPreviewServerText=text("lib/policy-intake-semi-auto-n8n.ts");
assert(n8nPreviewServerText.includes("n8n webhook returned an unsuccessful response".replace(/^n/, "The n"))
  || n8nPreviewServerText.includes("The n8n webhook returned an unsuccessful response"),
  "Fresh n8n failure must have an actionable and sanitized diagnostic");
// A selected, previously extracted Motor Intake must expose a direct manual
// handoff without requiring a separate user click on Re-extract current PDF.
assert(workbenchText.includes("async function beginDirectN8nHandoff()")
  && workbenchText.includes('selected.ocr_status === "completed"')
  && workbenchText.includes("const fresh=await previewSemiAutoN8nIntake(id)")
  && workbenchText.includes('setHandoffDialog({kind:"confirm",intakeId:id,')
  && workbenchText.includes("n8nResult.preview.fingerprint"),
  "Direct handoff must reverify current PDF and retain existing confirmed fingerprint checks");
// Bulk booking is intentionally not silently enabled by clearing an extraction exception.
assert(workbenchText.includes("Confirm bulk Policy registration")
  && workbenchText.includes("const bulkBatch=bulkRemaining.slice(0,10)")
  && workbenchText.includes("const result=await convertVerifiedAiIntake(item.id,true)")
  && workbenchText.includes("setBulkAttemptedIds(previous=>")
  && workbenchText.includes("Verify this Intake in Policy Register before retrying"),
  "Bulk registration must require explicit per-batch confirmation, cap at 10 and use canonical per-Intake checks without ambiguous retries");
const aiQueueRevisionText=text("lib/ai-policy-onboarding-queue-server.ts");
assert(aiQueueRevisionText.includes('+"-issue-date-v3"')
  && aiQueueRevisionText.includes("processAiQueueBatch")
  && aiQueueRevisionText.includes("MAX_BATCH = 6")
  && aiQueueRevisionText.includes("MAX_CONCURRENT = 3"),
  "Old issuance exceptions must refresh via stable parser revision and existing bounded worker");
assert(aiWorkbenchPageText.includes("bulkCandidates = workspaceRows.filter(row =>")
  && aiWorkbenchPageText.includes('q?.state==="verified" && q.exception_codes.length===0')
  && aiWorkbenchPageText.includes("!duplicateIds.has(row.id)")
  && aiWorkbenchPageText.includes("bulkCandidates={bulkCandidates}"),
  "Bulk candidates must include only authorized verified nonduplicate Motor Intakes across all pages");
assert(workerText.includes("fetchAllPages<Customer,unknown>")
  && !workerText.includes('matches?.length===51'),
  "Queue worker must not mistake 51 customers sharing a phone for ambiguous exact identity");
// Mobile number alone is not a customer identity. Read all candidate pages,
 // then permit a NEW customer when there is no exact name+mobile master.
assert(actionsText.includes("const PAGE=200, MAX_MATCHES=2000")
  && actionsText.includes('.order("id",{ascending:true}).range(offset,offset+PAGE-1)')
  && actionsText.includes("const exactMatches=masters.filter(")
  && actionsText.includes(":{createNewCustomer:true}")
  && !actionsText.includes('limit(51)\n    .returns<Array<{id:string;phone:string;contact_name:string;company_name:string|null}>>()'),
  "Shared-mobile identities must not be rejected by a 51-row arbitrary cutoff");
assert(actionsText.includes("async function holdFailedAiConversion(id:string)")
  && actionsText.includes('exception_codes:["booking_review_required"]')
  && actionsText.includes('last_error_code:"bulk_conversion_review_required"')
  && actionsText.includes('.eq("intake_id",id).eq("state","verified")')
  && actionsText.includes("if(!result.ok)await holdFailedAiConversion(id)")
  && actionsText.includes("await holdFailedAiConversion(id);"),
  "Failed or uncertain bulk conversion must persist a review hold on previously verified queue rows");
assert(workbenchText.includes('booking_review_required:"Bulk booking requires manual review"'),
  "Held bulk bookings must show a specific manual-review reason");
// Surface a sanitized status without revealing n8n response bodies, signed
// PDF URLs, secret headers or policy data; stop a batch on shared service error.
const webhookBridgeText=text("lib/policy-intake-n8n-bridge.ts");
assert(webhookBridgeText.includes("function assertN8nHttpSuccess(response: Response)")
  && webhookBridgeText.includes('n8n_bridge_http_failure_')
  && !webhookBridgeText.includes('if (!response.ok) throw new Error("n8n_bridge_http_failure")'),
  "Webhook bridge must retain only sanitized HTTP response codes");
assert(n8nPreviewServerText.includes('n8n_bridge_http_failure_401')
  && n8nPreviewServerText.includes('n8n_bridge_http_failure_404')
  && n8nPreviewServerText.includes('n8n_bridge_http_failure_429')
  && n8nPreviewServerText.includes('n8n_bridge_http_failure_503')
  && !n8nPreviewServerText.includes("response.text()"),
  "Webhook diagnostics must classify errors safely without exposing private body");
assert(workbenchText.includes("let stopForServiceFailure=false")
  && workbenchText.includes("if(stopForServiceFailure){")
  && workbenchText.includes("The remaining ")
  && workbenchText.includes("policies were NOT attempted")
  && workbenchText.includes("setBulkStoppedReason(null)"),
  "Systemic n8n error must stop confirmed batch after first failed Intake");
// Self-hosted cutover must be explicit, HTTPS-only and pinned to the approved
// INSUREIT hostname; Cloud remains the rollback default.
assert(webhookBridgeText.includes('const EXPECTED_N8N_ORIGIN = "https://insureit.app.n8n.cloud"')
  && webhookBridgeText.includes('const SELF_HOSTED_N8N_ORIGIN = "https://n8n.nishant.uk"')
  && webhookBridgeText.includes('INSUREIT_N8N_OCR_ENDPOINT_MODE')
  && webhookBridgeText.includes('=== "self_hosted"')
  && webhookBridgeText.includes('url.protocol !== "https:"')
  && webhookBridgeText.includes('url.origin !== origin')
  && webhookBridgeText.includes('url.pathname !== EXPECTED_WEBHOOK_PATH')
  && webhookBridgeText.includes('redirect: "error"'),
  "Production self-hosted cutover must enforce an exact HTTPS host and path with Cloud rollback");
// Production studio keeps canonical server-side scope and makes reprocessing
// intentionally uncapped without overloading n8n or booking a policy.
assert(aiWorkbenchPageText.includes("const reprocessCandidates = workspaceRows.filter(row =>")
  && aiWorkbenchPageText.includes('q?.state === "exception" || q?.state === "failed" || q?.state === "unsupported"')
  && aiWorkbenchPageText.includes("reprocessCandidates={reprocessCandidates}")
  && aiWorkbenchPageText.includes("!duplicateIds.has(row.id)"),
  "Previously untrained, failed and exception Motor Intakes must be eligible for explicit safe retry");
assert(workbenchText.includes("Parser not trained · Reprocess")
  && workbenchText.includes("Reprocess current PDF")
  && workbenchText.includes("reprocessCandidates.some(candidate=>candidate.id===exceptionRow.id)")
  && workbenchText.includes("await reprocessAiPolicyIntake(row.id)")
  && workbenchText.includes("queueRetrying || isWaiting"),
  "Untrained rows must offer an explicitly confirmed, protected single-policy retry");
assert(workbenchText.includes("Reprocess All Previous ·")
  && workbenchText.includes("const reprocessBatch=reprocessRemaining;")
  && !workbenchText.includes("reprocessRemaining.slice(0,10)")
  && workbenchText.includes("Reprocess all previous Intakes?")
  && workbenchText.includes("await reprocessAiPolicyIntake(item.id)")
  && workbenchText.includes("if (reprocessCancelRef.current)")
  && workbenchText.includes("Stop remaining")
  && workbenchText.includes("createPortal(")
  && workbenchText.includes("document.body) : null")
  && workbenchText.includes("This does not create a customer, vehicle or policy."),
  "Uncapped reprocess must be confirmed, sequential, cancelable, page-independent and never book");
assert(aiWorkbenchPageText.includes("const PAGE_SIZE = 30;")
  && aiWorkbenchPageText.includes("AI Policy Studio")
  && aiWorkbenchPageText.indexOf("Page {safePage}") < aiWorkbenchPageText.indexOf("<SemiAutoPolicyWorkspace")
  && workbenchText.includes('xl:overflow-y-auto')
  && workbenchText.includes('sticky top-0 z-10'),
  "Production studio must be compact with top pagination and independent review/table scrolling");
assert(actionsText.includes('Only an open, unregistered Motor Intake can be reprocessed.')
  && actionsText.includes("duplicates.matches.has(id)")
  && actionsText.includes('.in("state",["exception","verified","unsupported","failed"])'),
  "Reprocessing must reject completed, registered and duplicate Intakes while preserving individual rechecks");
console.log("Semi-auto Motor onboarding regression checks passed.");


// An existing saved CPA opt-out must never silently become a payable CPA.
assert(handoff.includes('if(key==="cpa" && verifiedPremium && Number(verifiedPremium.cpa)>0')
  && handoff.includes('original.cpaOpted!=="Yes") continue;')
  && actionsText.includes('verifiedCpaSelectionMatches(forwarded.draft.cpaOpted,Number(verifiedMoney.cpa))')
  && workbenchText.includes('CPA amount and opt-in need separate review.'),
  "Positive CPA cannot be filled under saved opt-out or booked without explicit CPA amount/choice parity");

// // ICICI old drafts must not hide saved-date conflicts or drop later policy
// fields. A user must compare/confirm a trusted current PDF separately.
assert(handoff.includes('reviewedIssueDateReplacement')
  && handoff.includes('existingDraft.revision!==dateReview.expectedRevision')
  && handoff.includes('original.issuanceDate!==dateReview.expectedPrevious')
  && handoff.includes('supplemented.issuanceDate=verifiedIssuanceDate')
  && handoff.includes('.eq("revision",existingDraft.revision)')
  && handoff.includes('"policyNo","insurerId"')
  && handoff.includes('"validFrom","validUpto","tpValidUpto"')
  && handoff.includes('"idv","od","addOnPremium","tp","cpa"')
  && handoff.includes('!String(original[key]??"").trim()'),
  "Legacy draft correction must use explicit revision-guarded date consent and fill only empty verified policy fields");
assert(actionsText.includes('export async function reviewIciciVerifiedDraftRepair(')
  && actionsText.includes('export async function applyReviewedIciciDraftRepair(')
  && actionsText.includes('review.savedIssueDate!==expectedSavedIssueDate')
  && actionsText.includes('confirmed!==true')
  && actionsText.includes('previewSemiAutoN8nExtraction(id)')
  && actionsText.includes('applyReviewedIciciDraftRepair(')
  && workbenchText.includes('Compare current PDF and saved draft')
  && workbenchText.includes('Confirm PDF-verified draft repair')
  && workbenchText.includes('role="status"'),
  "Date conflicts must be reviewed and explicitly approved in the AI Intake UI; booking remains separate");
assert(workerText.includes('extraction.diagnosticCode??"parser_not_trained"')
  && workbenchText.includes('Parser validation reason:')
  && text("lib/policy-intake-semi-auto-n8n.ts").includes('diagnosticCode:code')
  && text("lib/policy-intake-semi-auto-n8n.ts").includes('n8n_od_reference_missing'),
  "Strict n8n parser failures must expose safe diagnostic codes instead of guessing product untrained");
