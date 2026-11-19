import type { PolicyIssuanceDateEvidence } from "./policy-issuance-signature-evidence.ts";

/**
 * Pure, conservative exception vocabulary for future AI Policy Intake queue.
 * This DOES NOT book a policy or mark it canonically ready: eligibility for
 * conversion requires a separately validated, transaction-safe preflight.
 *
 * No customer identity, phone number, VIN or policy number is recorded in
 * the returned exception summaries.
 */
export type AiPolicyExceptionCode =
  | "unsupported_layout" | "document_missing" | "extraction_pending"
  | "extraction_failed" | "unverified_parser" | "duplicate_policy"
  | "reviewer_conflict" | "customer_identity" | "customer_ambiguous"
  | "customer_duplicate" | "customer_master_unverified" | "customer_creation_required"
  | "vehicle_ownership" | "missing_field" | "manufacturer_unmatched"
  | "financial_reconciliation" | "issuance_date_unverified" | "date_approval"
  | "bundled_validity" | "coverage_conflict" | "draft_conflict"
  | "preflight_pending" | "stale_document" | "booking_review_required";

export type AiResolutionRoute =
  | "reprocess" | "customer_decision" | "edit_draft"
  | "change_reviewer" | "vehicle_transfer" | "date_approval"
  | "coverage_review" | "inspect_duplicate" | "train_parser"
  | "canonical_preflight";

export type AiPolicyException = {
  code: AiPolicyExceptionCode;
  title: string;
  resolution: AiResolutionRoute;
  /** True means the item must be excluded from one-click and bulk conversion. */
  blocking: true;
};

export type AiPolicyEvidence = {
  policyType: string | null;
  intakeStatus: string;
  isDuplicate: boolean;
  hasCurrentDocument: boolean;
  documentStillCurrent: boolean;
  parserId: string | null;
  parserChecksPassed: number;
  extractionState: "pending" | "success" | "failed";
  extractionWarnings: readonly string[];
  fields: readonly { key: string; value: string }[];
  premiumReconciled: boolean;
  matchedManufacturer: boolean;
  /** Verified name and phone must match one single active customer master. */
  customerMatch: "unique_exact" | "none" | "multiple" | "name_conflict" | "unverified";
  /** Grouping by phone alone is never evidence that names match. */
  sharedPhoneHasDistinctNames: boolean;
  existingCustomerSameIdentity: boolean;
  reviewerAssignedToAnother: boolean;
  vehicleOwnerConflict: boolean;
  coverageConflict: boolean;
  savedDraftConflictsWithPdf: boolean;
  issuanceDateVerified: boolean;
  needsDateApproval: boolean;
  bundledPeriodsVerified: boolean;
  /** Only a transaction-compatible, read-only canonical preflight may set this. */
  canonicalPreflightPassed: boolean;
};

export type AiAssessment =
  | { state: "unsupported" | "needs_action" | "preflight_pending"; exceptions: AiPolicyException[] }
  | { state: "eligible"; exceptions: [] };

/**
 * Independent n8n bridge validation already checks all per-field/financial
 * evidence. This second-stage assessment must recognize the exact trained
 * parser and its full check count, without mistaking informational Tata AIG
 * review warnings for unreadable/unsupported PDFs.
 *
 * These are extraction checks, NOT policy-booking authorization.
 */
export const ICICI_N8N_IDS = new Set([
  "icici_3005_n8n_native_pdf", "icici_3005_od_n8n_native_pdf",
]);
export const TATA_AIG_PRIVATE_CAR_N8N_IDS = new Set([
  "tata_aig_private_car_saod_n8n_native_pdf",
  "tata_aig_private_car_package_n8n_native_pdf",
  "tata_aig_private_car_bundled_n8n_native_pdf",
]);
export const TATA_AIG_TWO_WHEELER_N8N_ID = "tata_aig_two_wheeler_bundled_n8n_native_pdf";
const TATA_INFORMATIONAL_WARNINGS = new Set([
  "tata_aig_issuance_date_unverified",
  "tata_aig_human_review_required",
  "tata_aig_printed_net_rounding",
  "tata_aig_signature_date_not_in_native_text",
]);
export type TrainedN8nParserFamily = "icici" | "tata_private_car" | "tata_two_wheeler";
export function trainedN8nParserProfile(parserId: string | null): {
  checks: 13 | 18; family: TrainedN8nParserFamily;
} | null {
  if (!parserId) return null;
  if (ICICI_N8N_IDS.has(parserId)) return { checks:13, family:"icici" };
  if (TATA_AIG_PRIVATE_CAR_N8N_IDS.has(parserId)) return { checks:18, family:"tata_private_car" };
  if (parserId===TATA_AIG_TWO_WHEELER_N8N_ID) return { checks:18, family:"tata_two_wheeler" };
  return null;
}
export function hasVerifiedN8nParserEvidence(
  parserId: string | null, checksPassed: number, warnings: readonly string[],
): boolean {
  const profile=trainedN8nParserProfile(parserId);
  return Boolean(profile && checksPassed===profile.checks
    && (profile.family==="icici" ? warnings.length===0
      : warnings.every(warning=>TATA_INFORMATIONAL_WARNINGS.has(warning))));
}

/**
 * INSUREIT's Tata AIG issuance-date BUSINESS RULE (not CMS chain validation):
 * For approved 18-check Tata AIG variants, use the full-document signing
 * timestamp as the issuance date only if it agrees with the independently
 * read printed receipt date. The PDF metadata extractor additionally rejects
 * partial signed revisions, multiple ByteRanges, non-Tata claimed signers
 * and inconsistent Indian-calendar dates.
 *
 * This is an explicit insurer-scoped business assumption. It is NOT proof of
 * cryptographic signature trust. Other policy/booking/OTP checks still apply.
 */
export function acceptedTataAigIssuanceDate(input: {
  parserId:string; checksPassed:number; warnings:readonly string[];
  fields:readonly {key:string;value:string}[];
  issuanceEvidence?:PolicyIssuanceDateEvidence;
}):string|null {
  const profile=trainedN8nParserProfile(input.parserId);
  if(!profile || profile.family==="icici"
    || !hasVerifiedN8nParserEvidence(input.parserId,input.checksPassed,input.warnings))
    return null;
  const evidence=input.issuanceEvidence;
  if(!evidence || evidence.verification!=="metadata_only_requires_reviewer"
      || evidence.source!=="embedded_pdf_signature_timestamp"
      || evidence.requiresReviewerConfirmation!==true
      || !/^[a-f0-9]{64}$/.test(evidence.documentSha256)) return null;
  const day=(value:string)=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const parsed=new Date(value+"T00:00:00Z");
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value;
  };
  // Never accept a future calendar day, including later in this same month.
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(new Date());
  const indiaPart=(type:string)=>parts.find(p=>p.type===type)?.value??"";
  const indiaToday=`${indiaPart("year")}-${indiaPart("month")}-${indiaPart("day")}`;
  if(!day(evidence.proposedDate) || evidence.proposedDate>indiaToday
    || evidence.proposedDate!==evidence.receiptDate) return null;
  const fields=new Map(input.fields.map(f=>[f.key,f.value.trim()]));
  // A separately printed issue date takes precedence; conflicting evidence
  // requires human attention rather than choosing one silently.
  const printed=fields.get("policy_issuance_date")||"";
  if(printed && printed!==evidence.proposedDate)return null;
  const expiry=fields.get("policy_end_date");
  if(!expiry || !day(expiry) || evidence.proposedDate>expiry) return null;
  return evidence.proposedDate;
}

const requiredFields = [
  "insured_name", "policy_number", "insurer_name", "vehicle_class",
  "vehicle_make", "vehicle_model", "vehicle_fuel_type",
  "vehicle_manufacturing_year", "vehicle_chassis_number", "vehicle_engine_number",
  "vehicle_rto_name", "policy_product", "policy_start_date", "policy_end_date",
  "third_party_end_date", "idv", "od_premium", "tp_premium",
  "vehicle_motor_power_kw",
] as const;

export function assessAiPolicyIntake(input: AiPolicyEvidence): AiAssessment {
  const exceptions: AiPolicyException[] = [];
  const add = (code: AiPolicyExceptionCode, title: string, resolution: AiResolutionRoute) => {
    if (!exceptions.some(item => item.code === code)) {
      exceptions.push({ code, title, resolution, blocking: true });
    }
  };
  const parser=trainedN8nParserProfile(input.parserId);
  if (input.policyType !== "motor" || !parser) {
    add("unsupported_layout", "Parser not trained for this policy", "train_parser");
  }
  if (!input.hasCurrentDocument) add("document_missing", "Current policy PDF missing", "edit_draft");
  if (!input.documentStillCurrent) add("stale_document", "Policy copy changed since extraction", "reprocess");
  if (input.extractionState === "pending") add("extraction_pending", "Awaiting n8n extraction", "reprocess");
  if (input.extractionState === "failed") add("extraction_failed", "n8n could not verify this policy", "reprocess");
  if (input.extractionState === "success" &&
      !hasVerifiedN8nParserEvidence(input.parserId,input.parserChecksPassed,input.extractionWarnings)) {
    add("unverified_parser", "Policy validation or premium evidence incomplete", "edit_draft");
  }
  if (input.isDuplicate) add("duplicate_policy", "Possible duplicate policy or Intake", "inspect_duplicate");
  if (input.reviewerAssignedToAnother) add("reviewer_conflict", "Assigned to another reviewer", "change_reviewer");

  if (input.extractionState === "success") {
    const fields = new Map(input.fields.map(field => [field.key, field.value.trim()]));
    // The old kW-only requirement is valid for ICICI 3005 and electric
    // two-wheelers, but not for petrol/diesel Tata AIG private cars.
    const required: string[]=[...requiredFields].filter(key =>
      key!=="vehicle_motor_power_kw" || parser?.family!=="tata_private_car");
    if (parser?.family==="tata_private_car" || parser?.family==="tata_two_wheeler") {
      required.push("vehicle_capacity","vehicle_registration_status","vehicle_rto_state");
      if (fields.get("vehicle_registration_status")?.toLowerCase()==="registered") {
        required.push("vehicle_registration_number");
      }
    }
    if (required.some(key => !fields.get(key))) {
      add("missing_field", "Mandatory extracted fields are missing", "edit_draft");
    }
    if (!input.matchedManufacturer) add("manufacturer_unmatched", "Vehicle make not matched to master", "edit_draft");
    if (!input.premiumReconciled) add("financial_reconciliation", "Premium components do not reconcile", "edit_draft");
  }
  if (!input.issuanceDateVerified) add("issuance_date_unverified", "Policy issuance date requires verification", "edit_draft");
  if (input.needsDateApproval) add("date_approval", "Date approval is required", "date_approval");
  if (!input.bundledPeriodsVerified) add("bundled_validity", "TP/CPA expiry periods require verification", "edit_draft");

  if (input.customerMatch === "multiple") add("customer_ambiguous", "Multiple matching customer records", "customer_decision");
  // Same mobile with a DIFFERENT PDF-verified insured name is not an
  // exception. Canonical Policy Onboarding already supports creating a
  // separate customer with that name and the existing mobile number.
  // Reusing an unrelated master record is never inferred from the phone.
  // Multiple EXACT matching customer records still need disambiguation.
  if (input.customerMatch === "unverified") add("customer_master_unverified", "Customer master identity not yet checked", "customer_decision");
  // A verified insured with no exact master match is an ordinary
  // create-new-customer path, not a parser or booking exception.
  if (input.customerMatch === "none" && input.existingCustomerSameIdentity) {
    add("customer_duplicate", "Existing same-identity customer needs confirmation", "customer_decision");
  }
  if (input.vehicleOwnerConflict) add("vehicle_ownership", "Vehicle belongs to another customer", "vehicle_transfer");
  if (input.coverageConflict) add("coverage_conflict", "Existing policy dates or coverage conflict", "coverage_review");
  if (input.savedDraftConflictsWithPdf) add("draft_conflict", "Saved manual value differs from current verified PDF", "edit_draft");
  // Processing/Ready for Review are normal Intake lifecycle states.
  // The canonical booking transaction must claim in_review and verify
  // reviewer permissions immediately before committing. Extraction is not
  // blocked merely because that transition has not happened yet.

  if (exceptions.length) return {
    state: exceptions.some(e => e.code === "unsupported_layout") ? "unsupported" : "needs_action",
    exceptions,
  };
  if (!input.canonicalPreflightPassed) {
    add("preflight_pending", "Canonical customer, vehicle and policy preflight pending", "canonical_preflight");
    return { state: "preflight_pending", exceptions };
  }
  return { state: "eligible", exceptions: [] };
}
