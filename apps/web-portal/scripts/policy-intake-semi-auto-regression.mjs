import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkSemiAutoReadiness } from "../lib/policy-intake-semi-auto.ts";
import { policyIntakeBucket } from "../lib/policy-intake-status-buckets.ts";
import { validateN8nPolicyIntakeResponse } from "../lib/policy-intake-n8n-validation.ts";
import { mapVerifiedN8nMotorPremium } from "../lib/policy-n8n-onboarding-premium.ts";
import { filterVerifiedN8nOnboardingFields } from "../lib/policy-n8n-onboarding-fields.ts";
import { enrichVerifiedN8nOnboardingFields, splitN8nRtoStateAndCity } from "../lib/policy-n8n-onboarding-enrichment.ts";
import { selectVerifiedN8nInsuredDraftIdentity, sameInsuredIdentity } from "../lib/policy-n8n-onboarding-insured.ts";
import { buildPolicyOcrOnboardingUpdate } from "../lib/policy-ocr-onboarding-apply.ts";

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


// All-Type n8n primary workbench is a separate opt-in review mode. It must
// never call legacy Google OCR, auto-apply n8n fields or book a policy.
const signedSource = text("lib/policy-intake-n8n-signed-source.ts");
const actions = text("app/development/ai-policy-onboarding/actions.ts");
assert(page.includes("const primaryN8n = isN8nWorkbenchPrimary()"),
  "All policy-type routing is enabled only by the server-side n8n primary flag");
assert(page.includes('const scoped = primaryN8n ? current : current.eq("policy_type", "motor")'),
  "Primary workbench must show all open Intake types while retaining the legacy Motor-only path");
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
assert(n8nServer.includes("JSON.stringify({ intakeId: id, documentId, fields, warnings, premium })")
  && n8nServer.includes("extraction.warnings, extraction.premium"),
  "The reviewed fingerprint must include verified financial components, not only OCR field text");
assert(handoff.includes("parsed.preview.documentId!==expectedDocumentId"),
  "A replaced PDF must not be forwarded under the prior review");
assert(handoff.includes("parsed.preview.checksPassed!==13 || parsed.preview.warnings.length>0"),
  "Only warning-free verified ICICI 3005 PDFs may create an onboarding draft");
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

console.log("Semi-auto Motor onboarding regression checks passed.");
