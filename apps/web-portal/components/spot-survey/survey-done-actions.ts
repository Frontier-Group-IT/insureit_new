"use server";

import { revalidatePath } from "next/cache";
import { requireClaimWorkflowAccess } from "@/lib/claim-workflow-access";

type ActionResult = { ok: boolean; message?: string };

export async function markSpotSurveyDone(claimId: string): Promise<ActionResult> {
  try {
    const cleanClaimId = String(claimId ?? "").trim();
    if (!cleanClaimId) throw new Error("Missing claim id.");
    const { profile, supabase } = await requireClaimWorkflowAccess(cleanClaimId, "You do not have permission to complete this stage.");
    const { data, error } = await supabase.rpc("complete_spot_survey", { p_claim_id: cleanClaimId, p_completed_by: profile.id });
    if (error) throw new Error(error.message);
    if (!data?.ok || data.next_status !== "Final Documents Awaited") throw new Error("The spot survey was not completed and Claim Intimation uploads were not opened.");

    revalidatePath(`/claims/${cleanClaimId}`);
    revalidatePath(`/partner/claims/${cleanClaimId}`);
    revalidatePath(`/claims/${cleanClaimId}/final-documents`);
    revalidatePath("/claims");
    revalidatePath("/partner/claims");
    revalidatePath("/dashboard");
    return { ok: true, message: "Spot survey completed. Claim Intimation uploads are now open." };
  } catch (error) {
    console.error("markSpotSurveyDone failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Unable to complete this stage." };
  }
}
