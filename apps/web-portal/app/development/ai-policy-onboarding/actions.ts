"use server";

import { preparePolicyIntakeHandoff, prepareVerifiedN8nIntakeHandoff, type PolicyIntakeDraft } from "@/app/policy-intakes/handoff-actions";
import { onboardPolicy, type PolicyOnboardingPayload } from "@/app/policies/policy-onboarding-actions";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { requireCapability } from "@/lib/master-data-server";
import { requirePolicyIntakeFinalizer, requirePolicyIntakeReviewer } from "@/lib/policy-intake-server";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";
import { buildPolicyOcrOnboardingUpdate, normalizeVerifiedMotorPowerKw } from "@/lib/policy-ocr-onboarding-apply";
import { policyDateDecision } from "@/lib/policy-date-rule";
import { mapVerifiedGoDigitCommercialPremium, mapVerifiedN8nMotorPremium, verifiedCpaSelectionMatches } from "@/lib/policy-n8n-onboarding-premium";
import { checkSemiAutoReadiness, type SemiAutoIssue } from "@/lib/policy-intake-semi-auto";
import { isN8nWorkbenchPrimary, previewSemiAutoN8nExtraction, applySemiAutoN8nExtraction, type SemiAutoN8nResult } from "@/lib/policy-intake-semi-auto-n8n";
import { segregatePolicyIntakeLanes } from "@/lib/policy-ocr-routing-mode";
export type { SemiAutoN8nResult } from "@/lib/policy-intake-semi-auto-n8n";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PolicyIntakeOcrField } from "@/lib/policy-intake-ocr-service";
import { revalidatePath } from "next/cache";
import { aiQueueEnabled } from "@/lib/ai-policy-onboarding-queue-server";
import { hasVerifiedN8nParserEvidence } from "@/lib/ai-policy-onboarding-eligibility";
import { redirect } from "next/navigation";

type Intake = {
  id: string; intake_number: string; status: string; policy_type: string | null;
  ocr_status: string; ocr_fields: PolicyIntakeOcrField[] | null; ocr_warnings: string[] | null;
  storage_bucket: string | null; storage_path: string | null;
  customer_mobile: string; lead_source_type: "posp" | "misp" | "partner";
  lead_source_code: string | null; lead_source_name: string;
  assigned_to_profile_id: string | null; created_at: string;
};
type Source = { id: string; intermediary_code: string | null; associate_employee_id: string | null; application_id: string | null };
type DraftRow = { draft_payload: PolicyIntakeDraft; revision: number };
type FieldResult = { ok: true; intake: Intake; draft: PolicyIntakeDraft; revision: number; issues: SemiAutoIssue[] } | { ok: false; issues: SemiAutoIssue[] };
export type SemiAutoActionResult = {
  ok: boolean; ready: boolean; issues: SemiAutoIssue[];
  policyCode?: string; policyId?: string; editUrl?: string;
  assignmentConflict?: { reviewerName: string };
};

function issue(field: string, message: string, section: SemiAutoIssue["section"] = "Intake"): SemiAutoIssue {
  return { section, field, message };
}
async function requireDevelopmentPolicyOperator(id?: string) {
  const profile = await requireCapability("manage_system", "approve");
  if (profile.role !== "it_super_user" && profile.role !== "super_admin") redirect("/access-denied");
  if (id) {
    await requirePolicyIntakeReviewer(id);
    await requirePolicyIntakeFinalizer(id);
  }
  return profile;
}

async function resolveRmName(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  code: string,
  type: "posp" | "misp" | "partner",
): Promise<{ ok: true; rmName: string } | { ok: false; message: string }> {
  if (!code) return { ok: false, message: "Intake has no intermediary code." };
  const result = await admin.from("intermediaries")
    .select("id,intermediary_code,associate_employee_id,application_id")
    .eq("intermediary_code", code).eq("intermediary_type", type)
    .eq("account_status", "active").limit(2).returns<Source[]>();
  if (result.error || !result.data || result.data.length !== 1) {
    return { ok: false, message: "Lead Source cannot be resolved to one active intermediary record. Correct the source in Policy Onboarding." };
  }
  const source = result.data[0];
  let employeeId = source.associate_employee_id;
  if (!employeeId && source.application_id) {
    const app = await admin.from("intermediary_onboarding_applications")
      .select("partner_record_id").eq("id", source.application_id)
      .maybeSingle<{ partner_record_id: string | null }>();
    if (app.error) return { ok: false, message: "Partner master could not be checked for RM assignment." };
    if (app.data?.partner_record_id) {
      const assignment = await admin.from("posp_misp_onboarding_profiles")
        .select("associate_employee_id").eq("partner_record_id", app.data.partner_record_id)
        .not("associate_employee_id", "is", null).order("created_at", { ascending: false }).limit(1)
        .maybeSingle<{ associate_employee_id: string | null }>();
      if (assignment.error) return { ok: false, message: "Partner associate assignment could not be checked." };
      employeeId = assignment.data?.associate_employee_id ?? null;
    }
  }
  if (!employeeId) return { ok: false, message: "Lead Source has no assigned Sales RM. Confirm the assignment in the intermediary master." };
  try {
    const employees = await loadPospMispAssociates(admin);
    const employee = employees.find(item => item.id === employeeId);
    if (!employee?.full_name?.trim()) return { ok: false, message: "Assigned RM is not present in the active Sales employee source." };
    return { ok: true, rmName: employee.full_name.trim() };
  } catch {
    return { ok: false, message: "Assigned RM master data is unavailable. Try again or use normal onboarding." };
  }
}

async function draftPreview(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  intake: Intake,
): Promise<{ draft: PolicyIntakeDraft; revision: number }> {
  const stored = await admin.from("policy_intake_onboarding_drafts")
    .select("draft_payload,revision").eq("intake_id", intake.id).maybeSingle<DraftRow>();
  if (stored.error) throw new Error("The saved Intake draft cannot be read.");
  if (stored.data?.draft_payload) return { draft: stored.data.draft_payload, revision: stored.data.revision };
  const [makers, brands, insurers] = await Promise.all([
    admin.from("vehicle_manufacturers").select("id").eq("is_active", true),
    admin.from("vehicle_manufacturer_brands").select("manufacturer_id,brand_name").eq("is_active", true),
    admin.from("insurance_companies").select("id,name").eq("is_active", true),
  ]);
  if (makers.error || brands.error || insurers.error) throw new Error("Vehicle manufacturer or insurer master data could not be loaded.");
  const makerIds = new Set((makers.data ?? []).map(item => item.id));
  const manufacturerNames = (brands.data ?? []).filter(item => makerIds.has(item.manufacturer_id)).map(item => item.brand_name);
  const parsed = buildPolicyOcrOnboardingUpdate({
    mode: "create", registrationMode: "registered",
    current: { registrationNo: "", vehicleClass: "", make: "", model: "", fuelType: "", manufacturingYear: "", capacity: "", chassisNo: "", engineNo: "", rtoState: "", rtoName: "", policyProduct: "", idv: "", od: "", tp: "", cpa: "", policyNo: "", insurerId: "", validFrom: "", validUpto: "" },
    fields: (intake.ocr_fields ?? []).map(item => ({ key: item.key, label: item.label || item.key, value: item.value })),
    manufacturers: manufacturerNames,
    insurers: (insurers.data ?? []).map(item => ({ value: item.id, label: item.name })),
    rcVerified: false,
  });
  const d = parsed.next;
  return {
    revision: 0,
    draft: {
      registrationMode: parsed.registrationMode,
      issuanceDate: "", rmName: "",
      intermediaryType: intake.lead_source_type === "posp" ? "POSP" : intake.lead_source_type === "misp" ? "MISP" : "SIBL / Partner",
      leadSource: intake.lead_source_name, intermediaryCode: intake.lead_source_code ?? "", businessLine: "Motor",
      registrationNo: d.registrationNo, insuredName: d.insuredName ?? "", phoneNo: intake.customer_mobile,
      vehicleClass: d.vehicleClass, make: d.make, model: d.model, fuelType: d.fuelType,
      capacity: d.capacity, manufacturingYear: d.manufacturingYear, chassisNo: d.chassisNo,
      engineNo: d.engineNo, rtoState: d.rtoState, rtoName: d.rtoName,
      policyProduct: d.policyProduct, idv: d.idv, od: d.od, tp: d.tp,
      cpaOpted: "No", cpa: d.cpa, policyNo: d.policyNo, insurerId: d.insurerId,
      validFrom: d.validFrom, validUpto: d.validUpto,
      payoutBasis: "NET", projectedOdPercent: "", projectedTpPercent: "", insurerScheme: "",
      payinBillNo: "", payinBilledAmount: "", payinBillDate: "", payinStatus: "Unbilled",
      retention: "", payoutOdPercent: "", payoutTpPercent: "", flatPayoutAmount: "",
      payoutStatus: "Pending", payoutDate: "", payoutVoucherNo: "", remarks: "Policy Intake " + intake.id,
    },
  };
}

async function inspectIntake(id: string): Promise<FieldResult> {
  const profile = await requireDevelopmentPolicyOperator(id);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return { ok: false, issues: [issue("Intake ID", "Invalid Intake identifier.")] };
  const admin = createSupabaseAdminClient();
  const result = await admin.from("policy_intake_requests")
    .select("id,intake_number,status,policy_type,ocr_status,ocr_fields,ocr_warnings,storage_bucket,storage_path,customer_mobile,lead_source_type,lead_source_code,lead_source_name,assigned_to_profile_id,created_at")
    .eq("id", id).maybeSingle<Intake>();
  if (result.error || !result.data) return { ok: false, issues: [issue("Intake", "The Intake cannot be loaded or is no longer accessible.")] };
  const intake = result.data;
  const issues: SemiAutoIssue[] = [];
  if (intake.assigned_to_profile_id && intake.assigned_to_profile_id !== profile.id) {
    issues.push(issue("Reviewer assignment", "This Intake is assigned to another Operations reviewer. Reassign it through the standard Intake workflow before using semi-auto onboarding."));
  }
  const copy = await admin.from("policy_intake_documents").select("id,storage_bucket,storage_path")
    .eq("intake_id", id).eq("is_current", true).maybeSingle<{ id: string; storage_bucket: string; storage_path: string }>();
  if (copy.error) issues.push(issue("Policy copy", "The current policy document could not be verified."));
  const hasCurrentCopy = Boolean(copy.data?.storage_path && copy.data.storage_bucket
    && copy.data.storage_path === intake.storage_path && copy.data.storage_bucket === intake.storage_bucket);

  const duplicates = await loadPolicyIntakeDuplicateMatches(admin, [intake]);
  if (!duplicates.ok) issues.push(issue("Duplicate protection", duplicates.error));
  else {
    const match = duplicates.matches.get(id);
    if (match?.kind === "registered_policy") issues.push(issue("Duplicate policy", "Policy Number already belongs to an existing registered policy (" + (match.policyCode || match.policyNumber) + ")."));
    if (match?.kind === "earlier_intake") issues.push(issue("Duplicate Intake", "The same Policy Number was submitted earlier as Intake " + match.intakeNumber + ". Resolve the duplicate in Policy Intake."));
  }
  let saved: Awaited<ReturnType<typeof draftPreview>>;
  try {
    saved = await draftPreview(admin, intake);
  } catch (error) {
    return { ok: false, issues: [issue("Reference data", error instanceof Error ? error.message : "Onboarding reference data is unavailable.")] };
  }
  const draft = { ...saved.draft };
  const source = await resolveRmName(admin, intake.lead_source_code ?? "", intake.lead_source_type);
  if (!source.ok) issues.push(issue("Assigned RM", source.message, "Source"));
  else draft.rmName = source.rmName;
  issues.push(...checkSemiAutoReadiness({
    status: intake.status, policyType: intake.policy_type, ocrStatus: intake.ocr_status,
    hasCurrentCopy, ocrFields: intake.ocr_fields ?? [], draft,
    draftRevision: saved.revision, dateDecision: policyDateDecision(draft.issuanceDate),
  }));
  return { ok: true, intake, draft, revision: saved.revision, issues };
}

export async function checkSemiAutoIntake(id: string): Promise<SemiAutoActionResult> {
  if (isN8nWorkbenchPrimary()) {
    await requireDevelopmentPolicyOperator(id);
    return { ok: false, ready: false, issues: [issue("n8n processing",
      "This AI workbench uses n8n as its only extraction engine. Run the n8n processor; legacy OCR cannot authorize booking here.")] };
  }
  const inspected = await inspectIntake(id);
  return { ok: inspected.ok, ready: inspected.ok && inspected.issues.length === 0, issues: inspected.issues };
}

function payloadFromDraft(d: PolicyIntakeDraft, id: string, revision: number, matchedCustomerId: string | null): PolicyOnboardingPayload {
  const cpm = d.vehicleClass === "CPM";
  return {
    customer: { name: d.insuredName, phone: d.phoneNo, type: "individual", source: d.leadSource, country: "India" },
    vehicle: {
      registrationMode: d.registrationMode, registrationNumber: d.registrationMode === "registered" ? d.registrationNo : "",
      classCode: d.vehicleClass, make: d.make, model: d.model, fuelType: d.fuelType,
      manufacturingYear: d.manufacturingYear, capacity: d.capacity,
      engineCapacity: ["PCP", "TWP", "MISD"].includes(d.vehicleClass) ? d.capacity : "",
      seatingCapacity: d.vehicleClass === "PCV" ? d.capacity : "",
      grossWeight: ["GCV", "CPM"].includes(d.vehicleClass) ? d.capacity : "",
      chassisNumber: d.chassisNo, engineNumber: d.engineNo, rtoState: d.rtoState, rtoName: d.rtoName,
      registrationStatus: d.registrationMode === "unregistered" ? "registration_pending" : "",
    },
    policy: {
      issuanceDate: d.issuanceDate, rmName: d.rmName, intermediaryType: d.intermediaryType,
      leadSource: d.leadSource, intermediaryCode: d.intermediaryCode, businessLine: "Motor",
      policyType: d.policyProduct, policyNumber: d.policyNo, insuranceCompanyId: d.insurerId,
      idv: d.idv, validFrom: d.validFrom, validUpto: d.validUpto,
      odValidUpto:d.validUpto,tpValidUpto:d.tpValidUpto||"",cpaValidUpto:d.cpaValidUpto||d.tpValidUpto||"",
      remarks: d.remarks,
    },
    premium: { od: d.od, tp: cpm ? "0" : d.tp,
      addOnPremium:d.addOnPremium||"0",cpa: cpm ? "0" : d.cpa,
      cpaOpted: !cpm && d.cpaOpted === "Yes" },
    // In this first iteration no unapproved commission or payout rate is manufactured.
    payin: { basis: "NET", odPercent: "0", tpPercent: "0", scheme: "0", provided: false },
    billing: { billNumber: "", billedAmount: "0", billDate: "", status: "Unbilled" },
    payout: { retention: "0", odPercent: "0", tpPercent: "0", flatAmount: "0", status: "Pending", date: "", voucherNumber: "", provided: false },
    authbridge: { applied: false },
    resolution: matchedCustomerId ? { selectedCustomerId: matchedCustomerId } : {},
    sourceIntakeId: id, draftRevision: revision,
  };
}

/**
 * Explicit one-step conversion for a verified n8n Intake. The browser sends
 * only the Intake ID and a confirmation boolean. The server re-extracts the
 * signed current PDF, compares it with the durable queue fingerprint, claims
 * the canonical draft and runs the SAME policy/customer/vehicle transaction
 * as standard onboarding. No browser-submitted OCR, customer ID or date.
 */
// Persist every failed/uncertain bulk conversion as review-required. A client
// refresh or another bulk batch must not automatically retry the same Intake.
// Only verified queue rows are held, retaining the validated fingerprint and
// source fields for manual inspection. Explicit operator reprocessing remains
// available through the existing authorized recovery action.
async function holdFailedAiConversion(id:string):Promise<void>{
  const admin=createSupabaseAdminClient();
  const now=new Date().toISOString();
  const {error}=await admin.from("policy_intake_ai_processing_queue")
    .update({state:"exception",exception_codes:["booking_review_required"],
      last_error_code:"bulk_conversion_review_required",updated_at:now})
    .eq("intake_id",id).eq("state","verified");
  if(error)console.error("[ai-policy] booking review hold failed",{code:error.code||"unknown"});
}

export async function convertVerifiedAiIntake(id:string,confirmed:boolean):Promise<SemiAutoActionResult>{
  await requireDevelopmentPolicyOperator(id);
  // Invalid or unconfirmed requests do not mutate the queue.
  if(confirmed!==true)return{ok:false,ready:false,issues:[issue("Confirmation","Explicit policy registration confirmation is required.")]};
  if(segregatePolicyIntakeLanes()){
    const admin=createSupabaseAdminClient();
    const{data:lane}=await admin.from("policy_intake_requests").select("processing_lane").eq("id",id).maybeSingle<{processing_lane:string}>();
    if(lane?.processing_lane!=="automation")return{ok:false,ready:false,issues:[issue("Processing lane","Manual Intakes cannot be converted through the AI queue.")]};
  }
  try{
    const result=await convertVerifiedAiIntakeCore(id,confirmed);
    if(!result.ok)await holdFailedAiConversion(id);
    return result;
  }catch(error){
    // Preserve the exact error class for server-side diagnosis without
    // logging customer data, request payloads, PDF text or credentials.
    const code=error instanceof Error && error.message==="n8n_motor_premium_handoff_unreconciled"
      ?"n8n_motor_premium_handoff_unreconciled":"unexpected_conversion_exception";
    console.error("[ai-policy] canonical conversion aborted",{code});
    await holdFailedAiConversion(id);
    return{ok:false,ready:false,issues:[issue("Booking status",
      "The result could not be confirmed. Review Policy Register and this Intake before explicitly retrying; automatic re-queue is blocked.")]};
  }
}

async function convertVerifiedAiIntakeCore(id:string,confirmed:boolean):Promise<SemiAutoActionResult>{
  await requireDevelopmentPolicyOperator(id);
  const fail=(field:string,message:string)=>({ok:false,ready:false,issues:[issue(field,message)]});
  if(!aiQueueEnabled()||!isN8nWorkbenchPrimary())return fail("Automation","Verified n8n onboarding is disabled.");
  if(confirmed!==true)return fail("Confirmation","Confirm this policy's registration before continuing.");
  const admin=createSupabaseAdminClient();
  const {data:queued,error:queueError}=await admin.from("policy_intake_ai_processing_queue")
    .select("state,document_id,extraction_fingerprint,exception_codes")
    .eq("intake_id",id)
    .maybeSingle<{state:string;document_id:string;extraction_fingerprint:string|null;exception_codes:string[]}>();
  if(queueError||!queued||queued.state!=="verified"||queued.exception_codes.length||!queued.extraction_fingerprint)
    return fail("Extraction","This Intake is not currently verified for conversion. Check its latest n8n exceptions.");
  const extracted=await previewSemiAutoN8nExtraction(id);
  if(!extracted.ok)return fail("Extraction",extracted.error);
  if(extracted.preview.documentId!==queued.document_id||
     extracted.preview.fingerprint!==queued.extraction_fingerprint||
     !hasVerifiedN8nParserEvidence(extracted.preview.parserId,
       extracted.preview.checksPassed,extracted.preview.warnings))
    return fail("Source PDF","The current PDF, fingerprint or strict insurer verification is invalid. Recheck this Intake before booking.");

  const pdfField=(key:string)=>extracted.preview.fields.find(f=>f.key===key)?.value?.trim()??"";
  // A passed arithmetic/PDF check does not establish vehicle motor power.
  // Verify the separate CC/KW field before auto-taking over reviewer ownership.
  const isOdElectricTwoWheeler=extracted.preview.parserId==="icici_3005_od_n8n_native_pdf"
    && /^(TWP|TWO\s*-?\s*WHEELER)$/i.test(pdfField("vehicle_class"))
    && pdfField("vehicle_fuel_type").toLowerCase()==="electric";
  const verifiedKw=isOdElectricTwoWheeler
    ? normalizeVerifiedMotorPowerKw(pdfField("vehicle_motor_power_kw")):"";
  if(isOdElectricTwoWheeler&&!verifiedKw)
    return fail("Vehicle capacity","The current verified PDF extraction has no usable Motor CC/KW value. Review the PDF/parser; seating capacity or model number cannot be substituted.");

  // Tata responses intentionally omit a native-text issue date. The signing
  // proposal is accepted only by the PDF integrity/receipt cross-check in
  // previewSemiAutoN8nExtraction; never substitute receipt or cover start.
  const issuanceDate=pdfField("policy_issuance_date")
    ||extracted.preview.acceptedIssuanceDate||"";
  const decision=policyDateDecision(issuanceDate);
  if(decision==="invalid"||decision==="future")
    return fail("Policy issuance date","The original PDF does not contain a valid separately verified Policy Issued On date. Correct it through canonical onboarding; today's date is not substituted.");
  if(decision==="otp_required")
    return fail("Date approval","The verified original policy issue date requires the existing email OTP approval. This cannot be bypassed automatically.");

  // Validate the original PDF premium and its OD/NCB deduction before a
  // handoff can claim the Intake or create a canonical draft.
  let verifiedMoney:ReturnType<typeof mapVerifiedN8nMotorPremium>;
  const commercial=extracted.preview.commercialPremium;
  if (commercial) {
    // Only the exact Go Digit 18-check native PDF contract may enter this path.
    // The other commercial insurers remain review-only until their separate
    // canonical premium/component mappings have been independently certified.
    if (extracted.preview.parserId!=="go_digit_cv_native_pdf"
        || extracted.preview.checksPassed!==18 || extracted.preview.warnings.length)
      return fail("Premium","This commercial layout still requires insurer-specific booking review.");
    // Do not claim reviewer ownership or update an existing draft if the PDF
    // omits an onboarding-mandatory value. In particular registration year is
    // NOT manufacturing year; current Digit sample prints manufacturing '--'.
    for (const key of ["insured_name","policy_product","vehicle_manufacturing_year",
      "vehicle_capacity","vehicle_rto_name","vehicle_rto_state","vehicle_class"]) {
      if (!pdfField(key)) return fail("Missing verified PDF field",
        key==="vehicle_manufacturing_year"
          ?"Manufacturing year is not printed in this Go Digit PDF. Registration year cannot substitute. Verify the year from RC/VAHAN before policy booking."
          :"The current Go Digit PDF does not independently verify "+key+". Review the original PDF or verified RC before booking.");
    }
    if (pdfField("policy_product")!=="Digit Commercial Vehicle Insurance")
      return fail("Policy product","The commercial product is not the verified combined Go Digit motor policy.");
    try {verifiedMoney=mapVerifiedGoDigitCommercialPremium(commercial);}
    catch {return fail("Premium","Printed OD, TP, net, GST and gross do not reconcile with the canonical form.");}
  } else {
    if (!extracted.preview.premium)
      return fail("Premium","A verified premium breakdown is missing.");
    try{verifiedMoney=mapVerifiedN8nMotorPremium(extracted.preview.premium);}
    catch{return fail("Premium","The independently verified premium, OD/NCB, or Tata liability allocation cannot be reconciled with canonical onboarding. Review the policy manually.");}
  }

  // Explicitly confirmed IT/Admin auto-conversion uses the existing atomic
  // reviewer takeover; manual handoffs keep their separate confirmation.
  // Fill blank fields from CURRENT verified PDF only, never overwrite edits.
  const forwarded=await prepareVerifiedN8nIntakeHandoff(id,queued.document_id,
    queued.extraction_fingerprint,true,true);
  if(!forwarded.ok)return fail("Canonical Intake handoff",forwarded.error);
  if(forwarded.draft.issuanceDate!==issuanceDate)
    return fail("Saved issuance date","The saved draft's issue date differs from the verified current PDF. Review it before booking; no existing manual value was overwritten.");
  if(forwarded.draftRevision<1)return fail("Draft revision","Canonical revision is unavailable.");
  if(commercial && (forwarded.draft.policyProduct!=="Package"
    || forwarded.draft.vehicleClass!=="MISD"
    || forwarded.draft.manufacturingYear!==pdfField("vehicle_manufacturing_year")
    || forwarded.draft.capacity!==pdfField("vehicle_capacity")
    || forwarded.draft.rtoName!==pdfField("vehicle_rto_name")
    || forwarded.draft.rtoState!==pdfField("vehicle_rto_state")))
    return fail("Verified Go Digit fields","The saved commercial identity, class, manufacturing year, CC, RTO or Package selection differs from the verified PDF.");
  if(isOdElectricTwoWheeler
      && (forwarded.draft.vehicleClass!=="TWP"
        ||forwarded.draft.fuelType!=="Electric"
        ||forwarded.draft.capacity!==verifiedKw))
    return fail("Vehicle capacity","The saved class, fuel or motor capacity conflicts with the verified PDF CC/KW. Review the existing onboarding draft; automatic conversion will not overwrite it.");
  const normalizedIdentity=(value:string)=>value.normalize("NFKC").trim().replace(/\s+/g," ").toUpperCase();
  if(!pdfField("insured_name")||
     normalizedIdentity(pdfField("insured_name"))!==normalizedIdentity(forwarded.draft.insuredName)){
    return fail("Insured name","The saved insured name differs from the current verified PDF. Review the canonical draft rather than registering the wrong identity.");
  }
  // The booking payload uses cpaOpted to determine whether CPA is charged.
  // An older saved draft can say "No" even when the verified PDF charges CPA:
  // matching only the numeric CPA field would silently understate the policy.
  // Never auto-opt-in or override an operator's saved selection.
  if(!verifiedCpaSelectionMatches(forwarded.draft.cpaOpted,Number(verifiedMoney.cpa)))
    return fail("Owner-driver CPA",
      "The verified PDF CPA premium and the saved CPA opt-in differ. Open Policy Onboarding and explicitly review both CPA amount and CPA selection before booking.");
  const sameMoney=(a:string,b:string)=>Number.isFinite(Number(a||"0"))
    && Number.isFinite(Number(b||"0")) && Math.round(Number(a||"0")*100)===Math.round(Number(b||"0")*100);
  if(!sameMoney(forwarded.draft.od,verifiedMoney.od)
    ||!sameMoney(forwarded.draft.addOnPremium??"0",verifiedMoney.addOnPremium)
    ||!sameMoney(forwarded.draft.tp,verifiedMoney.tp)
    ||!sameMoney(forwarded.draft.cpa,verifiedMoney.cpa)
    ||forwarded.draft.validFrom!==pdfField("policy_start_date")
    ||forwarded.draft.validUpto!==pdfField("policy_end_date")
    ||forwarded.draft.tpValidUpto!==pdfField("third_party_end_date")
    ||forwarded.draft.policyNo.replace(/[^A-Z0-9]/gi,"").toUpperCase()
      !==pdfField("policy_number").replace(/[^A-Z0-9]/gi,"").toUpperCase()){
    return fail("PDF reconciliation","Saved validity, policy number or premium differs from the current n8n-verified PDF. Review it before booking.");
  }

  // Use the same verified insured name and phone as normal onboarding.
  // One exact unique matching customer -> use it; no exact matching master
  // -> create a separate customer, EVEN if other names share the phone.
  // More than one exact match remains ambiguous and cannot be silently linked.
  const insured=forwarded.draft.insuredName.trim();
  const phone=forwarded.draft.phoneNo.replace(/\D/g,"").slice(-10);
  if(!insured||!/^\d{10}$/.test(phone))
    return fail("Customer identity","Insured name or mobile is missing from the verified Intake.");
  // A shared dealership/branch mobile can belong to many distinct insureds.
  // Read every bounded page and match BOTH exact normalized name and phone.
  // Never infer a customer from mobile alone or arbitrarily reject at 51.
  type Master = {id:string;phone:string;contact_name:string;company_name:string|null};
  const masters:Master[]=[];
  let customerLookupFailed=false;
  const PAGE=200, MAX_MATCHES=2000;
  for(let offset=0;offset<MAX_MATCHES;offset+=PAGE){
    const page=await admin.from("customers")
      .select("id,phone,contact_name,company_name").ilike("phone","%"+phone)
      .order("id",{ascending:true}).range(offset,offset+PAGE-1)
      .returns<Master[]>();
    if(page.error){customerLookupFailed=true;break;}
    masters.push(...(page.data??[]));
    if((page.data??[]).length<PAGE)break;
  }
  // Hitting the cap is an ambiguous identity lookup, never permission to
  // create a duplicate exact-identity customer.
  if(customerLookupFailed||masters.length>=MAX_MATCHES)
    return fail("Customer identity","Complete customer master lookup is unavailable or exceeds the review limit. No customer was created.");
  const norm=(v:string)=>v.normalize("NFKC").trim().replace(/\s+/g," ").toUpperCase();
  const exactMatches=masters.filter(c=>c.phone.replace(/\D/g,"").slice(-10)===phone
    && [c.company_name,c.contact_name].some(v=>norm(v??"")===norm(insured)));
  if(exactMatches.length>1)
    return fail("Customer identity","Multiple exact insured customer records exist. Select the correct customer in standard onboarding.");
  const payload=payloadFromDraft(forwarded.draft,id,forwarded.draftRevision,
    exactMatches[0]?.id??null);
  payload.resolution=exactMatches.length===1
    ?{selectedCustomerId:exactMatches[0].id}
    :{createNewCustomer:true};

  // The canonical engine independently validates active/overlapping policies,
  // actual vehicle ownership, intermediary scope, date OTP, Intake revision
  // and duplicate booking. Never set replacement/coverage approval shortcuts.
  const booked=await onboardPolicy(payload);
  if(booked.ok){
    revalidatePath("/development/ai-policy-onboarding");
    revalidatePath("/policy-intakes");
    return{ok:true,ready:true,issues:[],policyId:booked.policyId,policyCode:booked.policyCode};
  }
  if(booked.kind==="customer_match")return fail("Customer identity",
    "A verified exact-name customer match now exists or multiple candidates need selection. No duplicate customer was created.");
  if(booked.kind==="ownership_conflict")return fail("Vehicle ownership",
    "An existing vehicle belongs to a different customer. Use the audited Transfer Vehicle workflow.");
  if(booked.kind==="business_conflict")return fail("Policy history",
    "The canonical coverage or policy-history check requires review; no booking was performed.");
  return fail("Canonical booking",booked.error);
}

export async function bookSemiAutoIntake(id: string, confirmed: boolean): Promise<SemiAutoActionResult> {
  await requireDevelopmentPolicyOperator(id);
  if (isN8nWorkbenchPrimary()) return { ok: false, ready: false, issues: [issue("n8n review",
    "Booking from this AI workbench is disabled while n8n training and canonical onboarding integration are being validated.", "Approval")] };
  if (confirmed !== true) return { ok: false, ready: false, issues: [issue("Authorization", "Explicit booking confirmation is required.", "Approval")] };
  const inspection = await inspectIntake(id);
  if (!inspection.ok || inspection.issues.length) return { ok: inspection.ok, ready: false, issues: inspection.issues };
  // Claim the Intake and create/resume its canonical onboarding draft only after the dry-run passes.
  const prepared = await preparePolicyIntakeHandoff(id);
  if (!prepared.ok) return { ok: false, ready: false, issues: [issue("Intake handoff", prepared.error)] };
  // Reread the authoritative saved draft and revision; no stale browser payload is accepted.
  const verified = await inspectIntake(id);
  if (!verified.ok || verified.issues.length) return { ok: verified.ok, ready: false, issues: verified.issues };
  const bookingPayload = payloadFromDraft(verified.draft, id, verified.revision, prepared.matchedCustomerId);
  const result = await onboardPolicy(bookingPayload);
  if (result.ok) {
    revalidatePath("/development/ai-policy-onboarding");
    return { ok: true, ready: true, issues: [], policyId: result.policyId, policyCode: result.policyCode };
  }
  if (result.kind === "customer_match") {
    return { ok: false, ready: false, issues: [issue("Customer matching", "Customer identity needs a human decision. " + result.candidates.length + " possible customer record(s) were found. Select the correct customer or create a new customer in standard onboarding.", "Customer")] };
  }
  if (result.kind === "ownership_conflict") {
    return { ok: false, ready: false, issues: [issue("Vehicle ownership", "Vehicle " + result.conflict.registrationNumber + " belongs to another customer. Resolve it through the audited Vehicle Transfer workflow.", "Vehicle")] };
  }
  if (result.kind === "business_conflict") {
    const conflict = result.conflict;
    const descriptions: Record<typeof conflict.type, string> = {
      manufacturer_unknown: "Manufacturer is not recognized in the master. Correct the vehicle make.",
      vehicle_identity_conflict: "Registration, chassis or engine differs from the existing vehicle. " + (conflict.type === "vehicle_identity_conflict" ? conflict.message : ""),
      policy_duplicate: "This policy number is already registered. Review the existing policy.",
      coverage_overlap: "Policy coverage overlaps an existing policy. Review the current coverage period.",
      active_policy_notice: "An active policy exists for this vehicle. Confirm its history through standard onboarding.",
      expired_policy_history: "An expired policy exists for this vehicle. Review the coverage history through standard onboarding.",
      coverage_gap: "There is a coverage gap before this policy starts. Review the period in standard onboarding.",
    };
    return { ok: false, ready: false, issues: [issue("Policy conflict", descriptions[conflict.type], "Policy")] };
  }
  return { ok: false, ready: false, issues: [issue(result.kind, result.error, "Policy")] };
}

export async function editSemiAutoIntake(id: string, takeOver = false): Promise<SemiAutoActionResult> {
  await requireDevelopmentPolicyOperator(id);
  if (isN8nWorkbenchPrimary()) return { ok: false, ready: false, issues: [issue("n8n review",
    "Use the standard Intake Review or canonical Policy Onboarding route for manual corrections. This workbench does not claim or overwrite Intakes.")] };
  // Only a second, explicitly confirmed action may take ownership of an assigned
  // Intake. The canonical handoff verifies permissions, duplicates and the live
  // assignee again and atomically claims the record before opening its draft.
  const handoff = await preparePolicyIntakeHandoff(id, takeOver === true);
  if (!handoff.ok) {
    if (handoff.conflict) {
      return {
        ok: false, ready: false, assignmentConflict: { reviewerName: handoff.reviewerName },
        issues: [issue("Reviewer assignment", handoff.error)],
      };
    }
    return { ok: false, ready: false, issues: [issue("Intake handoff", handoff.error)] };
  }
  return { ok: true, ready: false, issues: [], editUrl: "/policies/new?intake_id=" + encodeURIComponent(id) };
}

/**
 * Explicit semi-automated handoff. Re-extract n8n server-side and verify the
 * reviewed document + fingerprint before calling the canonical Intake draft
 * preparation. The canonical Policy Onboarding page remains responsible for
 * all editable fields, manual verification, approval, and final booking.
 */
export async function continueVerifiedN8nIntakeToOnboarding(
  id: string, documentId: string, fingerprint: string, confirmed: boolean, takeOver = false, fillEmptyFields = false,
  reviewerConfirmedSigningDate?:{
    date:string;documentSha256:string;expectedDraftRevision:number|null;expectedPreviousDate:string|null;
  },
): Promise<{ ok: boolean; editUrl?: string; error?: string; existingDraft?:boolean; assignmentConflict?: { reviewerName: string } }> {
  await requireDevelopmentPolicyOperator(id);
  // Do not claim or create a draft for someone who cannot open /policies/new.
  await requirePolicyCreator();
  if (!isN8nWorkbenchPrimary() || confirmed !== true) {
    return { ok: false, error: "A confirmed n8n-primary review is required before forwarding to Policy Onboarding." };
  }
  const handoff = await prepareVerifiedN8nIntakeHandoff(id,documentId,fingerprint,takeOver===true,fillEmptyFields===true,undefined,reviewerConfirmedSigningDate);
  if (!handoff.ok) {
    if (handoff.conflict) return { ok:false,error:handoff.error,assignmentConflict:{reviewerName:handoff.reviewerName} };
    return { ok:false,error:handoff.error };
  }
  revalidatePath("/development/ai-policy-onboarding");
  revalidatePath("/policy-intakes");
  revalidatePath("/policy-intakes/" + encodeURIComponent(id));
  return { ok:true,editUrl:"/policies/new?intake_id=" + encodeURIComponent(id),
    existingDraft:handoff.existingDraft === true };
}

/**
 * Read-only, source-verified comparison for older ICICI drafts. It does not
 * change queue state, reviewer, draft or registered policies.
 */
export type ReviewedIciciDraftComparison =
  | {ok:false;error:string}
  | {ok:true;intakeId:string;documentId:string;fingerprint:string;revision:number;
     savedIssueDate:string;pdfIssueDate:string;
     missingFields:string[];otherConflicts:string[];
     policyNumber:string;parserId:string;
     verifiedCpa:string;savedCpa:string;savedCpaOpted:"Yes"|"No";
     cpaNeedsReview:boolean;};

export async function reviewIciciVerifiedDraftRepair(id:string):Promise<ReviewedIciciDraftComparison>{
  await requireDevelopmentPolicyOperator(id);
  await requirePolicyCreator();
  if(!isN8nWorkbenchPrimary())return{ok:false,error:"n8n-primary verification is disabled."};
  const admin=createSupabaseAdminClient();
  const {data:queue,error:queueError}=await admin.from("policy_intake_ai_processing_queue")
    .select("state,document_id,extraction_fingerprint,checks_passed,exception_codes")
    .eq("intake_id",id).maybeSingle<{state:string;document_id:string;extraction_fingerprint:string|null;checks_passed:number;exception_codes:string[]}>();
  if(queueError||!queue||queue.checks_passed!==13||!queue.extraction_fingerprint
      ||!["exception","verified"].includes(queue.state)
      ||queue.exception_codes.some(code=>code!=="booking_review_required"))
    return{ok:false,error:"Only an independently validated ICICI draft held for booking review can be reconciled."};
  const {data:existing,error:draftError}=await admin.from("policy_intake_onboarding_drafts")
    .select("revision,draft_payload").eq("intake_id",id)
    .maybeSingle<{revision:number;draft_payload:PolicyIntakeDraft}>();
  if(draftError||!existing?.draft_payload)
    return{ok:false,error:"No previously saved onboarding draft exists for this Intake."};
  const extracted=await previewSemiAutoN8nExtraction(id);
  if(!extracted.ok)return{ok:false,error:extracted.error};
  const preview=extracted.preview;
  if(preview.documentId!==queue.document_id
    ||preview.fingerprint!==queue.extraction_fingerprint
    ||preview.checksPassed!==13||preview.warnings.length
    ||!["icici_3005_n8n_native_pdf","icici_3005_od_n8n_native_pdf"].includes(preview.parserId))
    return{ok:false,error:"The current verified PDF is different or has incomplete checks; reprocess and review before changing any saved draft."};
  if (!preview.premium) return {ok:false,error:"Only ICICI's complete printed premium breakdown can be reconciled here."};
  const pdfField=(key:string)=>preview.fields.find(field=>field.key===key)?.value?.trim()??"";
  const pdfIssueDate=pdfField("policy_issuance_date");
  if(policyDateDecision(pdfIssueDate)==="invalid"||policyDateDecision(pdfIssueDate)==="future")
    return{ok:false,error:"The PDF does not establish a valid separately printed issuance date."};
  const draft=existing.draft_payload;
  // No sensitive PDF text, signed URL, or raw policy data is logged.
  const fields:[keyof PolicyIntakeDraft,string][]=[
    ["insuredName",pdfField("insured_name")],["policyNo",pdfField("policy_number")],
    ["validFrom",pdfField("policy_start_date")],["validUpto",pdfField("policy_end_date")],
    ["tpValidUpto",pdfField("third_party_end_date")],
    ["vehicleClass",pdfField("vehicle_class")],["model",pdfField("vehicle_model")],
    ["fuelType",pdfField("vehicle_fuel_type")],["capacity",pdfField("vehicle_motor_power_kw")],
    ["manufacturingYear",pdfField("vehicle_manufacturing_year")],
  ];
  const missingFields=fields.filter(([key,val])=>val&&!String(draft[key]??"").trim()).map(([key])=>key);
  // Do not silently overwrite conflicts other than explicitly approved issue date.
  // Other strict identity/coverage/premium comparisons remain in the converter.
  const otherConflicts=fields.filter(([key,val])=>val&&String(draft[key]??"").trim()
    && key!=="model"&&key!=="vehicleClass"&&key!=="fuelType"
    && String(draft[key]??"").trim().toUpperCase()!==val.toUpperCase()).map(([key])=>key);
  const verifiedCpa=String(preview.premium.cpa);
  const savedCpa=String(draft.cpa??"");
  const savedCpaOpted=draft.cpaOpted==="Yes"?"Yes" as const:"No" as const;
  const cpaNeedsReview=(savedCpaOpted==="Yes")!==(preview.premium.cpa>0)
    || (savedCpa!=="" && Number(savedCpa)!==preview.premium.cpa);
  return{ok:true,intakeId:id,documentId:queue.document_id,
    fingerprint:preview.fingerprint,revision:existing.revision,
    savedIssueDate:draft.issuanceDate??"",pdfIssueDate,missingFields,
    otherConflicts,policyNumber:pdfField("policy_number"),parserId:preview.parserId,
    verifiedCpa,savedCpa,savedCpaOpted,cpaNeedsReview};
}

/** Separate explicit operator confirmation; applies NO policy booking. */
export async function applyReviewedIciciDraftRepair(
  id:string, documentId:string, fingerprint:string,
  revision:number,expectedSavedIssueDate:string,confirmed:boolean,
):Promise<{ok:boolean;error?:string;revision?:number}>{
  await requireDevelopmentPolicyOperator(id);
  await requirePolicyCreator();
  if(confirmed!==true||!Number.isSafeInteger(revision)||revision<1)
    return{ok:false,error:"Review the verified PDF changes and explicitly confirm before applying."};
  const review=await reviewIciciVerifiedDraftRepair(id);
  if(!review.ok)return review;
  if(review.documentId!==documentId||review.fingerprint!==fingerprint
    ||review.revision!==revision||review.savedIssueDate!==expectedSavedIssueDate)
    return{ok:false,error:"The saved draft or PDF changed; refresh the comparison. No changes were applied."};
  const out=await prepareVerifiedN8nIntakeHandoff(id,documentId,fingerprint,true,true,{
    expectedPrevious:expectedSavedIssueDate,expectedRevision:revision,
  });
  if(!out.ok)return{ok:false,error:out.error};
  revalidatePath("/development/ai-policy-onboarding");
  revalidatePath("/policy-intakes/"+encodeURIComponent(id));
  return{ok:true,revision:out.draftRevision};
}

/**
 * The existing Development workbench uses the n8n bridge only after a
 * deliberate button click and the same reviewer + finalizer permissions.
 * Preview is read-only and never marks the Intake as bookable.
 */
export async function previewSemiAutoN8nIntake(id: string): Promise<SemiAutoN8nResult> {
  await requireDevelopmentPolicyOperator(id);
  return previewSemiAutoN8nExtraction(id);
}

export type AiCustomerCandidateReview =
  | {ok:false;error:string}
  | {ok:true;insuredName:string|null;mobileLast4:string;otherOpenIntakes:number|null;
      candidates:Array<{id:string;customerCode:string;displayName:string;
        nameMatch:"verified_exact"|"different"|"unverified"}>;
      truncated:boolean;verificationNote:string};

/**
 * Phase 2 (read-only): a focused customer identity decision preview.
 * The current signed PDF must be reverified by n8n before proposing any
 * insured name. A shared mobile number is NOT proof of matching identity.
 * There is no customer creation, linking, decision persistence or booking here.
 */
export async function reviewAiIntakeCustomerCandidates(id:string):Promise<AiCustomerCandidateReview>{
  await requireDevelopmentPolicyOperator(id);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){
    return {ok:false,error:"Invalid Intake reference."};
  }
  const admin=createSupabaseAdminClient();
  const {data:intake,error:intakeError}=await admin.from("policy_intake_requests")
    .select("id,status,customer_mobile").eq("id",id)
    .maybeSingle<{id:string;status:string;customer_mobile:string}>();
  if(intakeError || !intake ||
    !["ready_for_review","in_review","needs_attention","processing"].includes(intake.status)){
    return {ok:false,error:"This Intake is no longer open for customer review."};
  }
  const normalizedPhone=(v:string)=>v.replace(/\D/g,"").slice(-10);
  const phone=normalizedPhone(intake.customer_mobile??"");
  if(!/^\d{10}$/.test(phone)){
    return {ok:false,error:"The Intake mobile number requires correction before customer matching."};
  }
  // Prefix/country-code formats vary across customer masters. Query by the
  // last 10 digits but require exact post-normalization equality on every hit.
  const {data:rows,error}=await admin.from("customers")
    .select("id,customer_code,contact_name,company_name,phone")
    .ilike("phone","%"+phone).limit(51)
    .returns<Array<{id:string;customer_code:string;contact_name:string;
      company_name:string|null;phone:string}>>();
  if(error)return {ok:false,error:"Customer master lookup is temporarily unavailable."};
  const candidates=(rows??[]).filter(row=>normalizedPhone(row.phone)===phone);
  // Another Intake using the same mobile is a review signal, not evidence
  // that the insured names are different or customers should be merged.
  const group=await admin.from("policy_intake_requests")
    .select("id",{count:"exact",head:true}).eq("customer_mobile",intake.customer_mobile)
    .in("status",["processing","ready_for_review","in_review","needs_attention"]);
  const otherOpenIntakes=group.error||group.count===null?null:Math.max(0,group.count-1);
  // A truncated result must NEVER be treated as a unique identity.
  const truncated=(rows??[]).length>=51;
  const extraction=await previewSemiAutoN8nExtraction(id);
  const pdfName=extraction.ok
    ? extraction.preview.fields.find(v=>v.key==="insured_name")?.value?.trim()??""
    : "";
  const normalizedName=(v:string)=>v.normalize("NFKC").replace(/\s+/g," ").trim().toUpperCase();
  const trustedName=pdfName && extraction.ok && extraction.preview.checksPassed===13 && extraction.preview.warnings.length===0
    ? pdfName:null;
  return {
    ok:true,insuredName:trustedName,mobileLast4:phone.slice(-4),otherOpenIntakes,truncated,
    candidates:candidates.slice(0,50).map(row=>({
      id:row.id,customerCode:row.customer_code,
      displayName:row.company_name?.trim()||row.contact_name,
      nameMatch:!trustedName?"unverified"
        :[row.company_name,row.contact_name].some(value=>normalizedName(value??"")===normalizedName(trustedName))
        ?"verified_exact":"different",
    })),
    verificationNote:trustedName
      ?"Insured name verified against the current PDF; matching is informational only. Explicit customer linking still requires canonical onboarding checks."
      :"Insured name could not be independently verified from the current PDF. All customer candidates require manual identity review.",
  };
}

/**
 * Explicit authorized reset of an already processed queue row. Never alters
 * OCR, saved onboarding drafts, customers, vehicles or registered policies.
 * The worker independently re-checks current PDF at the next scheduled run.
 */
export async function reprocessAiPolicyIntake(id: string): Promise<{ok:boolean;error?:string}> {
  await requireDevelopmentPolicyOperator(id);
  if(!aiQueueEnabled())return{ok:false,error:"The automatic extraction queue is not enabled."};
  const admin=createSupabaseAdminClient();
  // A reprocess request cannot reopen a registered/completed policy or
  // override the canonical Policy Intake duplicate exclusion.
  const {data:intake,error:intakeError}=await admin.from("policy_intake_requests")
    .select("id,intake_number,status,policy_type,final_policy_id,created_at,ocr_fields,processing_lane")
    .eq("id",id).maybeSingle();
  if(intakeError||!intake||intake.policy_type!=="motor"
    ||(segregatePolicyIntakeLanes() && intake.processing_lane!=="automation")
    ||!["processing","ready_for_review","in_review","needs_attention"].includes(intake.status)
    ||intake.final_policy_id){
    return{ok:false,error:"Only an open, unregistered Motor Intake can be reprocessed."};
  }
  const duplicates=await loadPolicyIntakeDuplicateMatches(admin,[intake]);
  if(!duplicates.ok)return{ok:false,error:"Duplicate safety check is unavailable; no queue change was made."};
  if(duplicates.matches.has(id))return{ok:false,error:"This Intake is a duplicate. Resolve it in Policy Intake before reprocessing."};
  const {data:copy,error:copyError}=await admin.from("policy_intake_documents")
    .select("id").eq("intake_id",id).eq("is_current",true)
    .maybeSingle<{id:string}>();
  if(copyError||!copy)return{ok:false,error:"The current private policy PDF must be available before reprocessing."};
  const {data:row,error:rowError}=await admin.from("policy_intake_ai_processing_queue")
    .select("document_id,state,processed_at").eq("intake_id",id)
    .maybeSingle<{document_id:string;state:string;processed_at:string|null}>();
  if(rowError||!row)return{ok:false,error:"The Intake has not entered the automatic queue yet."};
  if(row.document_id!==copy.id)return{ok:false,error:"The PDF changed; wait for the queue to register the new document version."};
  if(row.state==="processing"||row.state==="pending")return{ok:false,error:"This Intake is already queued or being processed."};
  if(row.processed_at && Date.now()-new Date(row.processed_at).getTime()<60_000)
    return{ok:false,error:"This Intake was just processed. Recheck after the current result has been reviewed."};
  const {data:updated,error:updateError}=await admin.from("policy_intake_ai_processing_queue")
    .update({state:"pending",exception_codes:[],field_keys:[],parser_id:null,
      extraction_fingerprint:null,checks_passed:0,
      lease_id:null,leased_until:null,attempts:0,retry_after:new Date().toISOString(),
      processed_at:null,last_error_code:null,updated_at:new Date().toISOString()})
    .eq("intake_id",id).eq("document_id",copy.id)
    .in("state",["exception","verified","unsupported","failed"])
    .select("intake_id").maybeSingle<{intake_id:string}>();
  if(updateError||!updated)return{ok:false,error:"The queue changed; refresh the Intake before trying again."};
  revalidatePath("/development/ai-policy-onboarding");
  return{ok:true};
}

/**
 * One-click, explicit fresh parse for an open Motor Intake. The verified
 * current PDF is re-read through n8n, then replaces the active parser-owned
 * OCR and saved onboarding draft. It never books or creates master records.
 */
export async function reparseAndReplaceAiPolicyIntakeDraft(
  id:string,
):Promise<{ok:boolean;editUrl?:string;error?:string}> {
  await requireDevelopmentPolicyOperator(id);
  await requirePolicyCreator();
  if(!isN8nWorkbenchPrimary())return{ok:false,error:"The n8n review workbench is not enabled."};
  const admin=createSupabaseAdminClient();
  const {data:intake,error}=await admin.from("policy_intake_requests")
    .select("id,intake_number,status,policy_type,final_policy_id,created_at,processing_lane,ocr_fields")
    .eq("id",id).maybeSingle();
  if(error||!intake||intake.policy_type!=="motor"
      ||!(["processing","ready_for_review","in_review","needs_attention"].includes(intake.status))
      ||intake.final_policy_id){
    return{ok:false,error:"Only an open, unbooked Motor Intake can be reparsed."};
  }
  const duplicate=await loadPolicyIntakeDuplicateMatches(admin,[intake]);
  if(!duplicate.ok)return{ok:false,error:"Duplicate verification is unavailable; nothing was replaced."};
  if(duplicate.matches.has(id))return{ok:false,error:"This Intake is a duplicate and cannot be reparsed into an onboarding draft."};
  const {data:currentDocument,error:documentError}=await admin.from("policy_intake_documents")
    .select("id").eq("intake_id",id).eq("is_current",true)
    .maybeSingle<{id:string}>();
  if(documentError||!currentDocument)return{ok:false,error:"The current private policy PDF is unavailable."};
  const {data:queue}=await admin.from("policy_intake_ai_processing_queue")
    .select("state,document_id").eq("intake_id",id)
    .maybeSingle<{state:string;document_id:string}>();
  if(queue && queue.document_id===currentDocument.id
      && ["pending","processing"].includes(queue.state)){
    return{ok:false,error:"This PDF is already being processed. Wait for that run to finish, then reparse."};
  }

  // This is the explicit operator path for either lane. It does not change
  // processing_lane; unsupported layouts remain manual and cannot be booked.
  const handoff=await prepareVerifiedN8nIntakeHandoff(
    id,null,null,false,false,undefined,undefined,true,
  );
  if(!handoff.ok)return{ok:false,error:handoff.error};
  revalidatePath("/development/ai-policy-onboarding");
  revalidatePath("/policy-intakes");
  revalidatePath("/policy-intakes/"+encodeURIComponent(id));
  return{ok:true,editUrl:"/policies/new?intake_id="+encodeURIComponent(id)};
}

export async function applySemiAutoN8nIntake(
  id: string, documentId: string, fingerprint: string, confirmed: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await requireDevelopmentPolicyOperator(id);
  if (isN8nWorkbenchPrimary()) return { ok: false,
    error: "n8n is the authoritative extraction engine in this workbench, but automatic OCR application is disabled until the canonical handoff is validated." };
  if (confirmed !== true) return { ok: false, error: "Explicit confirmation is required to apply the reviewed OCR result." };
  const result = await applySemiAutoN8nExtraction(id, documentId, fingerprint);
  if (result.ok) {
    revalidatePath("/development/ai-policy-onboarding");
    revalidatePath("/policy-intakes");
    revalidatePath("/policy-intakes/" + encodeURIComponent(id));
  }
  return result;
}


/**
 * IT-only escape hatch for an untrained/failed automation Intake.
 * The service-role RPC atomically locks Intake + queue, requires a terminal
 * failure, and writes the exact actor/reason into audit_logs. It neither
 * re-extracts the PDF nor changes booking, ownership or reviewer assignment.
 */
export async function transferFailedAiIntakeToManual(
  id: string, reason: string,
): Promise<{ok: true} | {ok: false; error: string}> {
  if (!segregatePolicyIntakeLanes() || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) {
    return {ok:false,error:"The Intake lane transfer is not available."};
  }
  const why=reason.trim();
  if(why.length<12 || why.length>500) {
    return {ok:false,error:"Enter a specific reason between 12 and 500 characters."};
  }
  const actor=await requireDevelopmentPolicyOperator(id);
  const admin=createSupabaseAdminClient();
  const {data,error}=await admin.rpc("move_policy_intake_automation_to_manual_v1",{
    p_intake_id:id,p_actor_id:actor.id,p_reason:why
  });
  if(error) return {ok:false,error:"The transfer could not be saved. Check the approved database migration."};
  if(data!==true) return {ok:false,error:"Only unbooked, terminal failed/untrained Intakes can move to Manual Onboarding. Refresh and verify the current queue state."};
  revalidatePath("/policy-intakes");
  revalidatePath(`/policy-intakes/${id}`);
  revalidatePath("/development/ai-policy-onboarding");
  return {ok:true};
}
