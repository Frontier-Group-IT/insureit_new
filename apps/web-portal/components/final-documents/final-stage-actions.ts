"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";

type ActionResult = { ok: boolean; message?: string };

type ClaimRow = { id: string; current_status: string | null };

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function profile() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.role) throw new Error("User role not found.");
  return profile;
}

async function claim(claimId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("claims").select("id, current_status").eq("id", claimId).maybeSingle<ClaimRow>();
  if (error || !data) throw new Error(error?.message ?? "Claim not found.");
  return data;
}

async function writeDecision(claimId: string, decision: string, allowed: string[]) {
  const user = await profile();
  if (!allowed.includes(user.role)) throw new Error("You do not have permission for this action.");
  const row = await claim(claimId);
  const supabase = await createServerSupabaseClient();
  const details = { verification_type: "final_documents_stage_decision", decision, decided_at: new Date().toISOString(), decided_by: user.id ?? null, decided_by_role: user.role };
  const { error } = await supabase.from("claim_stage_details").insert({ claim_id: claimId, stage: row.current_status ?? "Final Documents", details, created_by: user.id ?? null });
  if (error) throw new Error(error.message);
  await supabase.from("claim_status_history").insert({ claim_id: claimId, from_status: row.current_status, to_status: row.current_status, notes: `Final documents ${decision}.`, changed_by: user.id ?? null });
  revalidatePath(`/claims/${claimId}/final-documents`);
  revalidatePath("/dashboard");
}

export async function processFinalDocuments(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = clean(formData.get("claimId"));
    if (!claimId) throw new Error("Missing claim id.");
    await writeDecision(claimId, "processed", ["admin", "claim_processor"]);
    return { ok: true, message: "Processed and sent for approval." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Process failed." };
  }
}

export async function approveFinalDocuments(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = clean(formData.get("claimId"));
    if (!claimId) throw new Error("Missing claim id.");
    await writeDecision(claimId, "approved", ["super_admin", "manager", "it_super_user"]);
    return { ok: true, message: "Approved." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Approval failed." };
  }
}

export async function returnFinalDocuments(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = clean(formData.get("claimId"));
    if (!claimId) throw new Error("Missing claim id.");
    await writeDecision(claimId, "returned", ["super_admin", "manager", "it_super_user"]);
    return { ok: true, message: "Returned for correction." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Return failed." };
  }
}
