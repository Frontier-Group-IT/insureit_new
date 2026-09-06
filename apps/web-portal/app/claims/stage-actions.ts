"use server";

import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { isClaimStatus, type ClaimStatus } from "@/lib/claim-workflow";
import { revalidatePath } from "next/cache";

type OperationsStageKey =
  | "spot_status"
  | "claim_intimation"
  | "work_approval"
  | "repair_ri"
  | "billing"
  | "delivery_order"
  | "vehicle_delivery"
  | "payment_encashment";

type ManagedClaim = {
  id: string;
  current_status: ClaimStatus;
  claim_service_mode: "broker_managed" | "self_managed";
};

const orderedStageKeys: readonly OperationsStageKey[] = [
  "spot_status",
  "claim_intimation",
  "work_approval",
  "repair_ri",
  "billing",
  "delivery_order",
  "vehicle_delivery",
  "payment_encashment",
];

const stageStatuses: Record<OperationsStageKey, readonly ClaimStatus[]> = {
  spot_status: ["Initial Documents Submitted", "Initial Documents Verification Pending", "Documents Submitted", "Initial Documents Verified", "Claim Intimated", "Surveyor Appointed"],
  claim_intimation: ["Vehicle Inspected", "Spot Survey Completed", "Final Documents Awaited", "Final Documents Verification Pending", "Final Documents Submitted", "Final Documents Verified", "Claim Intimation", "Final Surveyor Details", "Survey Status"],
  work_approval: ["Survey Done", "Estimate Submitted", "Approval Pending", "Work Approval Status"],
  repair_ri: ["Work Approval Received", "Under Repair", "Repair Started", "Repair Done", "Repair Completed", "RA Intimation"],
  billing: ["RA Intimation Done"],
  delivery_order: ["Final Bill Submitted", "DO Status"],
  vehicle_delivery: ["DO Submitted"],
  payment_encashment: ["Payment Stage", "Claim Completion In Progress", "Settlement Under Process", "Claim Complete", "Settled", "Closed"],
};

const completionTargets: Record<OperationsStageKey, ClaimStatus> = {
  spot_status: "Final Documents Awaited",
  claim_intimation: "Survey Done",
  work_approval: "Work Approval Received",
  repair_ri: "RA Intimation Done",
  billing: "Final Bill Submitted",
  delivery_order: "DO Submitted",
  vehicle_delivery: "Payment Stage",
  payment_encashment: "Claim Complete",
};

const detailStageStatus: Record<OperationsStageKey, ClaimStatus> = {
  spot_status: "Surveyor Appointed",
  claim_intimation: "Survey Status",
  work_approval: "Work Approval Status",
  repair_ri: "RA Intimation",
  billing: "Final Bill Submitted",
  delivery_order: "DO Status",
  vehicle_delivery: "Payment Stage",
  payment_encashment: "Settlement Under Process",
};

const requiredFields: Record<OperationsStageKey, readonly string[]> = {
  spot_status: ["spot_survey_done_date"],
  claim_intimation: ["insurer_claim_no", "dealership_name", "dealership_location", "estimate_amount"],
  work_approval: ["approval_received_date", "cashless"],
  repair_ri: ["repair_complete_date"],
  billing: ["bill_date", "bill_amount"],
  delivery_order: ["do_date", "do_amount"],
  vehicle_delivery: ["vehicle_received"],
  payment_encashment: ["payment_received_date", "payment_received_amount"],
};

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanValue(formData: FormData, name: string) {
  return textValue(formData, name) === "true";
}

function isStageKey(value: string | null): value is OperationsStageKey {
  return Boolean(value && value in completionTargets);
}

function currentStageKey(status: ClaimStatus) {
  return orderedStageKeys.find((key) => stageStatuses[key].includes(status)) ?? null;
}

function stageDetailsFromForm(formData: FormData, stageKey: OperationsStageKey) {
  const details: Record<string, string | number> = { milestone_key: stageKey };
  for (const [key, value] of formData.entries()) {
    if (["notes", "next_status", "current_status", "milestone_key", "insurer_claim_no", "save_only"].includes(key)) continue;
    if (typeof value !== "string" || !value.trim()) continue;
    const numericValue = Number(value.replace(/,/g, ""));
    details[key] = Number.isFinite(numericValue) && /amount|tds|gst|labour|parts|bill|received|estimate/i.test(key)
      ? numericValue
      : value.trim();
  }
  details.updated_at = new Date().toISOString();
  return details;
}

function claimFieldUpdates(formData: FormData) {
  const insurerClaimNo = textValue(formData, "insurer_claim_no");
  const approvedAmount = textValue(formData, "approved_amount");
  const settlementAmount = textValue(formData, "payment_received_amount");
  return {
    ...(insurerClaimNo ? { insurer_claim_no: insurerClaimNo } : {}),
    ...(approvedAmount ? { approved_amount: Number(approvedAmount.replace(/,/g, "")) } : {}),
    ...(settlementAmount ? { settlement_amount: Number(settlementAmount.replace(/,/g, "")) } : {}),
  };
}

export async function completeClaimJourneyStage(claimId: string, formData: FormData) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!(await hasEffectiveCapability(profile, "manage_claims", "edit"))) {
    throw new Error("You do not have permission to update claim workflow stages.");
  }

  const stageKeyValue = textValue(formData, "milestone_key");
  if (!isStageKey(stageKeyValue)) throw new Error("This claim stage cannot be saved from this form.");
  const stageKey = stageKeyValue;
  const saveOnly = booleanValue(formData, "save_only");

  for (const field of requiredFields[stageKey]) {
    if (!textValue(formData, field)) throw new Error("Complete all mandatory stage fields before saving details.");
  }

  const supabase = await createServerSupabaseClient();
  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .select("id,current_status,claim_service_mode")
    .eq("id", claimId)
    .maybeSingle<ManagedClaim>();

  if (claimError || !claim) throw new Error(claimError?.message ?? "Claim not found.");
  if (claim.claim_service_mode !== "broker_managed") throw new Error("Operations can update only managed claims.");
  if (!isClaimStatus(claim.current_status)) throw new Error("The claim has an unsupported workflow status.");

  const activeKey = currentStageKey(claim.current_status);
  const targetIndex = orderedStageKeys.indexOf(stageKey);
  const activeIndex = activeKey ? orderedStageKeys.indexOf(activeKey) : orderedStageKeys.length - 1;
  const terminal = ["Claim Complete", "Settled", "Closed"].includes(claim.current_status);

  if (!terminal && targetIndex > activeIndex) {
    throw new Error("This stage is not available yet. Complete the current stage first.");
  }

  const details = stageDetailsFromForm(formData, stageKey);
  const claimUpdates = claimFieldUpdates(formData);

  if (saveOnly || terminal || stageKey !== activeKey) {
    if (Object.keys(claimUpdates).length) {
      const { error: claimUpdateError } = await supabase.from("claims").update(claimUpdates).eq("id", claimId);
      if (claimUpdateError) throw new Error(claimUpdateError.message);
    }

    const { error: detailError } = await supabase.from("claim_stage_details").insert({
      claim_id: claimId,
      stage: detailStageStatus[stageKey],
      details,
      created_by: profile?.id ?? null,
    });
    if (detailError) throw new Error(detailError.message);

    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/claims");
    revalidatePath("/dashboard");
    return { ok: true, nextStatus: claim.current_status, advanced: false };
  }

  const nextStatus = completionTargets[stageKey];
  const { data: updated, error: updateError } = await supabase
    .from("claims")
    .update({ current_status: nextStatus, ...claimUpdates })
    .eq("id", claimId)
    .eq("current_status", claim.current_status)
    .select("id,current_status")
    .maybeSingle<{ id: string; current_status: ClaimStatus }>();

  if (updateError) throw new Error(updateError.message);
  if (!updated || updated.current_status !== nextStatus) {
    throw new Error("The claim stage could not be persisted. Refresh the claim and try again.");
  }

  const { error: detailError } = await supabase.from("claim_stage_details").insert({
    claim_id: claimId,
    stage: detailStageStatus[stageKey],
    details: { ...details, completed_at: new Date().toISOString() },
    created_by: profile?.id ?? null,
  });
  if (detailError) throw new Error(detailError.message);

  const { error: historyError } = await supabase.from("claim_status_history").insert({
    claim_id: claimId,
    from_status: claim.current_status,
    to_status: nextStatus,
    notes: textValue(formData, "notes") ?? `Operations completed ${stageKey.replaceAll("_", " ")} and opened the next journey stage.`,
    changed_by: profile?.id ?? null,
  });
  if (historyError) throw new Error(historyError.message);

  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/claims");
  revalidatePath("/dashboard");

  return { ok: true, nextStatus, advanced: true };
}
