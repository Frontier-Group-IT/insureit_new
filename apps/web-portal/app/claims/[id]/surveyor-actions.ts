"use server";

import { hasEffectiveCapability } from "@/lib/effective-permissions";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";

type ActionResult = { ok: boolean; message?: string };
async function currentProfile() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile) throw new Error("You must be signed in to depute a spot surveyor.");
  if (!(await hasEffectiveCapability(profile, "manage_claims", "edit"))) throw new Error("You do not have permission to depute a spot surveyor.");
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
    const { data, error } = await supabase.rpc("depute_spot_surveyor", {
      p_claim_id: claimId,
      p_surveyor_name: surveyorName,
      p_surveyor_number: surveyorNumber,
      p_surveyor_email: surveyorEmail,
      p_deputed_by: profile.id
    });
    if (error) throw new Error(error.message);
    if (!data?.ok || data.next_status !== "Surveyor Appointed") {
      throw new Error("The surveyor details were not saved and the claim did not move to Surveyor Appointed.");
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
