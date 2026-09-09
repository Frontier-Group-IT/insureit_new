"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";

export type ExternalOperationsTakeoverResult = { ok: boolean; message?: string };

export async function beginExternalOperationsWorkflow(claimId: string): Promise<ExternalOperationsTakeoverResult> {
  try {
    const cleanClaimId = String(claimId ?? "").trim();
    if (!cleanClaimId) throw new Error("Missing claim id.");

    const accessToken = await getServerAccessToken();
    const { profile } = await getAuthenticatedProfile(accessToken);
    if (!profile?.id || !(await hasEffectiveCapability(profile, "manage_claims", "edit"))) {
      throw new Error("You do not have permission to manage claim workflow stages.");
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await (supabase.rpc as any)("begin_external_claim_operations_workflow", {
      p_claim_id: cleanClaimId,
      p_actor_id: profile.id,
    });

    if (error) throw new Error(error.message);
    if (!data?.ok || data.policy_service_source !== "external" || data.claim_service_mode !== "broker_managed") {
      throw new Error("The External Claim could not enter the Operations workflow.");
    }

    revalidatePath(`/claims/${cleanClaimId}`);
    revalidatePath("/claims");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    console.error("beginExternalOperationsWorkflow failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Unable to open the External Claim in Operations." };
  }
}
