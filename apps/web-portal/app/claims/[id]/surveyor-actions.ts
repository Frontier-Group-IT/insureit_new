"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canVerifyClaimDocuments } from "@/lib/roles";
import type { ClaimStatus } from "@/lib/claim-workflow";

type ActionResult = { ok: boolean; message?: string };
type ClaimForSurveyor = { id: string; current_status: ClaimStatus; customer_id: string | null };

async function currentProfile() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!canVerifyClaimDocuments(profile?.role)) throw new Error("You do not have permission to depute a spot surveyor.");
  return profile;
}

export async function deputeSpotSurveyor(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = String(formData.get("claimId") ?? "").trim();
    const surveyorName = String(formData.get("surveyorName") ?? "").trim();
    const surveyorNumber = String(formData.get("surveyorNumber") ?? "").trim();
    const surveyorEmail = String(formData.get("surveyorEmail") ?? "").trim();

    if (!claimId) throw new Error("Missing claim id.");
    if (!surveyorName) throw new Error("Please enter surveyor name.");
    if (!/^\d{10}$/.test(surveyorNumber)) throw new Error("Please enter a valid 10 digit surveyor mobile number.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(surveyorEmail)) throw new Error("Please enter a valid surveyor email address.");

    const profile = await currentProfile();
    const supabase = await createServerSupabaseClient();

    const { data: claim, error: claimError } = await supabase
      .from("claims")
      .select("id, current_status, customer_id")
      .eq("id", claimId)
      .maybeSingle<ClaimForSurveyor>();

    if (claimError || !claim) throw new Error(claimError?.message ?? "Claim not found.");

    const nextStatus: ClaimStatus = "Surveyor Appointed";
    const detailsPayload = {
      verification_type: "spot_surveyor_deputation",
      surveyor_name: surveyorName,
      surveyor_number: surveyorNumber,
      surveyor_email: surveyorEmail,
      deputed_at: new Date().toISOString(),
      deputed_by: profile?.id ?? null
    };

    const { error: detailError } = await supabase.from("claim_stage_details").insert({
      claim_id: claimId,
      stage: nextStatus,
      details: detailsPayload,
      created_by: profile?.id ?? null
    });
    if (detailError) throw new Error(detailError.message);

    const { error: updateError } = await supabase
      .from("claims")
      .update({ current_status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", claimId);
    if (updateError) throw new Error(updateError.message);

    await supabase.from("claim_status_history").insert({
      claim_id: claimId,
      from_status: claim.current_status,
      to_status: nextStatus,
      notes: `Spot surveyor deputed: ${surveyorName}, ${surveyorNumber}, ${surveyorEmail}`,
      changed_by: profile?.id ?? null
    });

    if (claim.customer_id) {
      await supabase.from("customer_activity_events").insert({
        customer_id: claim.customer_id,
        claim_id: claimId,
        event_type: "spot_surveyor_deputed",
        title: "Spot surveyor deputed",
        message: `${surveyorName} has been deputed for spot survey.`,
        priority: "medium",
        status: "new",
        metadata: detailsPayload
      });
    }

    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/claims");
    revalidatePath("/dashboard");

    return { ok: true, message: "Spot surveyor deputed successfully." };
  } catch (error) {
    console.error("deputeSpotSurveyor failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Spot surveyor deputation failed." };
  }
}
