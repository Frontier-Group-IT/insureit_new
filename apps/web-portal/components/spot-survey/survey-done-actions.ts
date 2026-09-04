"use server";

import { hasEffectiveCapability } from "@/lib/effective-permissions";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";

type ActionResult = { ok: boolean; message?: string };

async function currentProfile() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile) throw new Error("You must be signed in to complete the spot survey.");
  if (!(await hasEffectiveCapability(profile, "manage_claims", "edit"))) throw new Error("You do not have permission to complete this stage.");
  return profile;
}

export async function markSpotSurveyDone(claimId: string): Promise<ActionResult> {
  try {
    const cleanClaimId = String(claimId ?? "").trim();
    if (!cleanClaimId) throw new Error("Missing claim id.");

    const profile = await currentProfile();
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("complete_spot_survey", {
      p_claim_id: cleanClaimId,
      p_completed_by: profile.id
    });
    if (error) throw new Error(error.message);
    if (!data?.ok || data.next_status !== "Final Documents Awaited") {
      throw new Error("The spot survey was not completed and Claim Intimation uploads were not opened.");
    }

    revalidatePath(`/claims/${cleanClaimId}`);
    revalidatePath(`/claims/${cleanClaimId}/final-documents`);
    revalidatePath("/claims");
    revalidatePath("/dashboard");

    return { ok: true, message: "Spot survey completed. Claim Intimation uploads are now open." };
  } catch (error) {
    console.error("markSpotSurveyDone failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Unable to complete this stage." };
  }
}
