import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type BranchActivationStatus = "active" | "invited" | "pending" | "unknown";

/**
 * Display-only activation state. Keep partner_status and portal identity access
 * unchanged: those fields represent business registration/authorization, not
 * evidence that the invited person completed first sign-in.
 */
export async function getBranchActivationStatuses(branchIds: string[]): Promise<Map<string, BranchActivationStatus>> {
  const statuses = new Map<string, BranchActivationStatus>();
  if (!branchIds.length) return statuses;
  const admin = createSupabaseAdminClient();
  const { data: identities, error } = await admin.from("portal_access_identities")
    .select("entity_id,profile_id,status")
    .eq("entity_type", "branch")
    .in("entity_id", branchIds);
  if (error) {
    branchIds.forEach((id) => statuses.set(id, "unknown"));
    return statuses;
  }
  branchIds.forEach((id) => statuses.set(id, "pending"));
  await Promise.all((identities ?? []).map(async (identity) => {
    if (!identity.entity_id || !identity.profile_id) return;
    if (identity.status !== "active") {
      statuses.set(identity.entity_id, "pending");
      return;
    }
    const { data, error: userError } = await admin.auth.admin.getUserById(identity.profile_id);
    if (userError || !data.user) {
      statuses.set(identity.entity_id, "unknown");
      return;
    }
    // First successful sign-in is reliable evidence that the invite was accepted.
    // Merely sending an invite or provisioning a profile does not mean Active.
    statuses.set(identity.entity_id, data.user.last_sign_in_at ? "active" : "invited");
  }));
  return statuses;
}
