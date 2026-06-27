"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import type { ClaimStatus } from "@/lib/claim-workflow";
import { canVerifyClaimDocuments } from "@/lib/roles";

type ActionResult = { ok: boolean; message?: string };
type ClaimRow = { id: string; customer_id: string | null; current_status: ClaimStatus };

async function currentProfile() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!canVerifyClaimDocuments(profile?.role)) throw new Error("You do not have permission to complete this stage.");
  return profile;
}

export async function markSpotSurveyDone(claimId: string): Promise<ActionResult> {
  try {
    const cleanClaimId = String(claimId ?? "").trim();
    if (!cleanClaimId) throw new Error("Missing claim id.");
    const profile = await currentProfile();
    const supabase = await createServerSupabaseClient();
    const { data: claim, error: claimError } = await supabase.from("claims").select("id, customer_id, current_status").eq("id", cleanClaimId).maybeSingle<ClaimRow>();
    if (claimError || !claim) throw new Error(claimError?.message ?? "Claim not found.");

    const nextStatus: ClaimStatus = "Spot Survey Completed";
    const now = new Date().toISOString();
    const details = { verification_type: "spot_survey_completed", previous_status: claim.current_status, next_status: nextStatus, next_stage: "Final Documents", completed_at: now, completed_by: profile?.id ?? null };

    const { error: updateError } = await supabase.from("claims").update({ current_status: nextStatus, updated_at: now }).eq("id", cleanClaimId);
    if (updateError) throw new Error(updateError.message);

    await supabase.from("claim_stage_details").insert({ claim_id: cleanClaimId, stage: "Final Documents", details, created_by: profile?.id ?? null });
    await supabase.from("claim_status_history").insert({ claim_id: cleanClaimId, from_status: claim.current_status, to_status: nextStatus, notes: "Spot survey completed. Claim moved to Final Documents stage.", changed_by: profile?.id ?? null });

    if (claim.customer_id) {
      await supabase.from("customer_activity_events").insert({ customer_id: claim.customer_id, claim_id: cleanClaimId, event_type: "spot_survey_completed", title: "Spot survey completed", message: "Claim has moved to final documents stage.", priority: "medium", status: "new", metadata: details });
    }

    revalidatePath(`/claims/${cleanClaimId}`);
    revalidatePath(`/claims/${cleanClaimId}/final-documents`);
    revalidatePath("/claims");
    revalidatePath("/dashboard");
    return { ok: true, message: "Spot survey completed." };
  } catch (error) {
    console.error("markSpotSurveyDone failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Unable to complete this stage." };
  }
}
