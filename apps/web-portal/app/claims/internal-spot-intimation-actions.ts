"use server";

import { revalidatePath } from "next/cache";
import { isClaimStatus, managerTransitions, type ClaimStatus } from "@/lib/claim-workflow";
import { insertAuthorizedClaimStageDetail, requireClaimWorkflowAccess } from "@/lib/claim-workflow-access";
import { validateInternalSpotIntimation } from "@/lib/internal-spot-intimation";

type ClaimRow = {
  id: string;
  current_status: ClaimStatus;
  claim_service_mode: "broker_managed" | "self_managed";
  accident_description: string | null;
};

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function combineDateAndTime(formData: FormData, dateField: string, timeField: string) {
  const date = textValue(formData, dateField);
  const time = textValue(formData, timeField);
  if (!date || !time) return;
  formData.set(dateField, `${date}T${time}`);
}

function normalizeSpotIntimationDateTimes(formData: FormData) {
  combineDateAndTime(formData, "incident_at", "incident_time");
  combineDateAndTime(formData, "spot_intimation_at", "spot_intimation_time");
}

function requireInternalSpotIntimationDriverDetails(formData: FormData) {
  const missing = [
    ["Driver Name", textValue(formData, "driver_name")],
    ["Driver Number", textValue(formData, "driver_phone")],
    ["Location", textValue(formData, "location") ?? textValue(formData, "accident_location")],
  ].filter((entry) => !entry[1]).map((entry) => entry[0]);
  if (missing.length) throw new Error(`Please complete the required Spot Intimation fields: ${missing.join(", ")}.`);
}

function mergeCustomerDriverDescription(existing: string | null, driverName: string | null, driverPhone: string | null) {
  const preserved = (existing ?? "").split(/\r?\n/).filter((line) => !/^\s*Driver:\s*/i.test(line) && !/^\s*Driver phone:\s*/i.test(line)).join("\n").trim();
  const driverLines = [driverName ? `Driver: ${driverName}` : null, driverPhone ? `Driver phone: ${driverPhone}` : null].filter(Boolean);
  return [preserved, ...driverLines].filter(Boolean).join("\n") || null;
}

async function loadManagedClaim(claimId: string, supabase: Awaited<ReturnType<typeof requireClaimWorkflowAccess>>["supabase"]) {
  const { data, error } = await supabase.from("claims").select("id,current_status,claim_service_mode,accident_description").eq("id", claimId).maybeSingle<ClaimRow>();
  if (error || !data) throw new Error(error?.message ?? "Claim not found.");
  if (data.claim_service_mode !== "broker_managed") throw new Error("Operations can update Spot Intimation only for managed claims.");
  if (!isClaimStatus(data.current_status)) throw new Error("Claim has an unsupported status.");
  return data;
}

function normalizedDetails(claim: ClaimRow, formData: FormData) {
  const incidentAt = textValue(formData, "incident_at") ?? textValue(formData, "accident_at");
  const spotIntimationAt = textValue(formData, "spot_intimation_at");
  const normalized = validateInternalSpotIntimation(incidentAt, spotIntimationAt);
  const driverName = textValue(formData, "driver_name");
  const driverPhone = textValue(formData, "driver_phone");
  const location = textValue(formData, "location") ?? textValue(formData, "accident_location");
  const accidentDescription = mergeCustomerDriverDescription(claim.accident_description, driverName, driverPhone);
  return {
    normalized,
    location,
    accidentDescription,
    details: {
      milestone_key: "spot_intimation",
      incident_at: normalized.incidentAt,
      accident_at: normalized.incidentAt,
      spot_intimation_at: normalized.spotIntimationAt,
      driver_name: driverName,
      driver_phone: driverPhone,
      location,
      accident_location: location,
      accident_description: accidentDescription,
    },
  };
}

export async function advanceInternalSpotIntimation(claimId: string, formData: FormData) {
  normalizeSpotIntimationDateTimes(formData);
  requireInternalSpotIntimationDriverDetails(formData);
  const access = await requireClaimWorkflowAccess(claimId, "You do not have permission to update claim workflow stages.");
  const { profile, supabase } = access;
  const claim = await loadManagedClaim(claimId, supabase);
  const requestedStatus = textValue(formData, "next_status");
  const nextStatus = isClaimStatus(requestedStatus) ? requestedStatus : null;
  const allowedStatus = managerTransitions[claim.current_status];
  if (!nextStatus || nextStatus !== allowedStatus) throw new Error("This status change is not allowed for the current claim stage.");

  const { normalized, location, accidentDescription, details } = normalizedDetails(claim, formData);
  const { error: updateError } = await supabase.from("claims").update({ current_status: nextStatus, accident_at: normalized.incidentAt, spot_intimation_at: normalized.spotIntimationAt, accident_location: location, accident_description: accidentDescription }).eq("id", claimId);
  if (updateError) throw new Error(updateError.message);
  await insertAuthorizedClaimStageDetail(access, { claim_id: claimId, stage: nextStatus, details, created_by: profile.id });
  const { error: historyError } = await supabase.from("claim_status_history").insert({ claim_id: claimId, from_status: claim.current_status, to_status: nextStatus, notes: textValue(formData, "notes") ?? `Claim moved to ${nextStatus}.`, changed_by: profile.id });
  if (historyError) throw new Error(historyError.message);
  revalidateClaimPaths(claimId);
}

export async function saveInternalSpotIntimationDetails(claimId: string, formData: FormData) {
  normalizeSpotIntimationDateTimes(formData);
  requireInternalSpotIntimationDriverDetails(formData);
  const access = await requireClaimWorkflowAccess(claimId, "You do not have permission to update claim workflow stages.");
  const { profile, supabase } = access;
  const claim = await loadManagedClaim(claimId, supabase);
  const { normalized, location, accidentDescription, details } = normalizedDetails(claim, formData);
  const { data: persistedClaim, error: claimError } = await supabase.from("claims").update({ accident_at: normalized.incidentAt, spot_intimation_at: normalized.spotIntimationAt, accident_location: location, accident_description: accidentDescription }).eq("id", claimId).select("id").maybeSingle<{ id: string }>();
  if (claimError) throw new Error(claimError.message);
  if (!persistedClaim) throw new Error("The Spot Intimation changes could not be persisted. Refresh the claim and try again.");
  await insertAuthorizedClaimStageDetail(access, { claim_id: claimId, stage: claim.current_status, details, created_by: profile.id });
  revalidateClaimPaths(claimId);
}

function revalidateClaimPaths(claimId: string) {
  revalidatePath(`/claims/${claimId}`);
  revalidatePath(`/partner/claims/${claimId}`);
  revalidatePath("/claims");
  revalidatePath("/partner/claims");
  revalidatePath("/dashboard");
}
