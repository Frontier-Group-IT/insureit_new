"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireCapability } from "@/lib/master-data-server";

export type AssistanceReviewState = { ok: boolean; message: string };

const acceptedEntryStatuses = new Set([
  "Initial Documents Pending",
  "Initial Documents Verification Pending",
  "Initial Documents Verified",
]);

export async function resolveAssistanceIntake(_previous: AssistanceReviewState, formData: FormData): Promise<AssistanceReviewState> {
  try {
    const claimId = String(formData.get("claimId") ?? "").trim();
    const decision = String(formData.get("decision") ?? "").trim().toLowerCase();
    const note = String(formData.get("note") ?? "").trim();
    const entryStatus = String(formData.get("entryStatus") ?? "").trim();

    if (!claimId) throw new Error("Missing claim id.");
    if (decision !== "accepted" && decision !== "declined") throw new Error("Choose whether to accept or decline assistance.");
    if (note.length < 10) throw new Error("Enter a review note of at least 10 characters.");
    if (decision === "accepted" && !acceptedEntryStatuses.has(entryStatus)) throw new Error("Select a supported internal intake stage.");

    const profile = await requireCapability("manage_claims", "edit");
    if (!profile?.id) throw new Error("You do not have permission to review assistance requests.");

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("resolve_claim_assistance_intake", {
      p_claim_id: claimId,
      p_decision: decision,
      p_entry_status: decision === "accepted" ? entryStatus : null,
      p_note: note,
      p_resolved_by: profile.id,
    });

    if (error) throw new Error(error.message);
    if (!data?.ok || data.decision !== decision) throw new Error("The assistance decision was not saved.");

    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/claims");
    revalidatePath("/dashboard");
    return { ok: true, message: decision === "accepted" ? "Assistance accepted. The claim is now in the Internal Claims queue." : "Assistance declined. The claim remains customer-managed." };
  } catch (error) {
    console.error("resolveAssistanceIntake failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "The assistance request could not be reviewed." };
  }
}
