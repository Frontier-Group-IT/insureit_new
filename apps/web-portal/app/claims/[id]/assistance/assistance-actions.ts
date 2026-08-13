"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";

type ActionResult = { ok: boolean; message: string; decision?: "accepted" | "declined" };

export async function resolveAssistanceRequest(claimId: string, decision: "accepted" | "declined", note: string): Promise<ActionResult> {
  try {
    const cleanClaimId = String(claimId ?? "").trim();
    if (!cleanClaimId) throw new Error("Missing claim reference.");

    const accessToken = await getServerAccessToken();
    const { profile } = await getAuthenticatedProfile(accessToken);
    if (!(await hasEffectiveCapability(profile, "manage_claims", "edit"))) {
      throw new Error("You do not have permission to review claim assistance requests.");
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("resolve_claim_assistance", {
      p_claim_id: cleanClaimId,
      p_decision: decision,
      p_note: note.trim() || null,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/claims");
    revalidatePath(`/claims/${cleanClaimId}`);
    revalidatePath(`/claims/${cleanClaimId}/assistance`);
    revalidatePath("/dashboard");

    return {
      ok: true,
      decision,
      message: decision === "accepted"
        ? "Sankalp assistance accepted. The claim is now broker-managed."
        : "Assistance request declined. The claim remains self-tracked by the customer.",
    };
  } catch (error) {
    console.error("resolveAssistanceRequest failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Unable to review this assistance request." };
  }
}
