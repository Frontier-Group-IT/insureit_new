"use server";

import { preparePolicyIntakeHandoff, type PolicyIntakeDraft } from "@/app/policy-intakes/handoff-actions";
import { onboardPolicy, type PolicyOnboardingPayload } from "@/app/policies/policy-onboarding-actions";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { requireCapability } from "@/lib/master-data-server";
import { requirePolicyIntakeFinalizer, requirePolicyIntakeReviewer } from "@/lib/policy-intake-server";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";
import { buildPolicyOcrOnboardingUpdate } from "@/lib/policy-ocr-onboarding-apply";
import { policyDateDecision } from "@/lib/policy-date-rule";
import { checkSemiAutoReadiness, type SemiAutoIssue } from "@/lib/policy-intake-semi-auto";
import { previewSemiAutoN8nExtraction, applySemiAutoN8nExtraction, type SemiAutoN8nResult } from "@/lib/policy-intake-semi-auto-n8n";
export type { SemiAutoN8nResult } from "@/lib/policy-intake-semi-auto-n8n";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PolicyIntakeOcrField } from "@/lib/policy-intake-ocr-service";
import { revalidatePath } from "next/cache";
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
      idv: d.idv, validFrom: d.validFrom, validUpto: d.validUpto, remarks: d.remarks,
    },
    premium: { od: d.od, tp: cpm ? "0" : d.tp, addOnPremium: "0", cpa: cpm ? "0" : d.cpa, cpaOpted: !cpm && d.cpaOpted === "Yes" },
    // In this first iteration no unapproved commission or payout rate is manufactured.
    payin: { basis: "NET", odPercent: "0", tpPercent: "0", scheme: "0", provided: false },
    billing: { billNumber: "", billedAmount: "0", billDate: "", status: "Unbilled" },
    payout: { retention: "0", odPercent: "0", tpPercent: "0", flatAmount: "0", status: "Pending", date: "", voucherNumber: "", provided: false },
    authbridge: { applied: false },
    resolution: matchedCustomerId ? { selectedCustomerId: matchedCustomerId } : {},
    sourceIntakeId: id, draftRevision: revision,
  };
}

export async function bookSemiAutoIntake(id: string, confirmed: boolean): Promise<SemiAutoActionResult> {
  await requireDevelopmentPolicyOperator(id);
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
 * The existing Development workbench uses the n8n bridge only after a
 * deliberate button click and the same reviewer + finalizer permissions.
 * Preview is read-only and never marks the Intake as bookable.
 */
export async function previewSemiAutoN8nIntake(id: string): Promise<SemiAutoN8nResult> {
  await requireDevelopmentPolicyOperator(id);
  return previewSemiAutoN8nExtraction(id);
}

export async function applySemiAutoN8nIntake(
  id: string, documentId: string, fingerprint: string, confirmed: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await requireDevelopmentPolicyOperator(id);
  if (confirmed !== true) return { ok: false, error: "Explicit confirmation is required to apply the reviewed OCR result." };
  const result = await applySemiAutoN8nExtraction(id, documentId, fingerprint);
  if (result.ok) {
    revalidatePath("/development/ai-policy-onboarding");
    revalidatePath("/policy-intakes");
    revalidatePath("/policy-intakes/" + encodeURIComponent(id));
  }
  return result;
}
