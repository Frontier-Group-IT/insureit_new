import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canAccessCustomer } from "@/lib/employee-access-scope";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ClaimScopeRow = {
  id: string;
  customer_id: string;
  claim_service_mode: "broker_managed" | "self_managed" | null;
};

/**
 * Authorizes a mutation against one claim without broadening the global
 * `manage_claims` capability. Employees keep the existing capability/customer
 * scope rules. Intermediary users must prove that the claim is visible through
 * the Partner-scoped RPC before a service-role client is returned for the
 * canonical Operations mutation.
 */
export async function requireClaimWorkflowAccess(claimId: string, errorMessage = "You do not have permission to update this claim.") {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id) throw new Error(errorMessage);

  const admin = createSupabaseAdminClient();
  const { data: claim, error: claimError } = await admin
    .from("claims")
    .select("id, customer_id, claim_service_mode")
    .eq("id", claimId)
    .maybeSingle<ClaimScopeRow>();
  if (claimError || !claim) throw new Error(claimError?.message ?? "Claim not found.");

  if (await hasEffectiveCapability(profile, "manage_claims", "edit")) {
    if (!(await canAccessCustomer(profile.id, profile.role, claim.customer_id, "manage_claims"))) {
      throw new Error(errorMessage);
    }
    return {
      profile,
      claim,
      isPartner: false as const,
      supabase: await createServerSupabaseClient(),
    };
  }

  if (profile.role === "intermediary") {
    const scoped = await createServerSupabaseClient();
    const { data: partnerClaim, error: partnerClaimError } = await scoped.rpc("partner_app_claim_detail", { p_claim_id: claimId });
    if (partnerClaimError || !partnerClaim) throw new Error(errorMessage);
    return {
      profile,
      claim,
      isPartner: true as const,
      // Scope is proven above by the authenticated Partner RPC. Canonical
      // Operations writes then use the service client so they are not blocked
      // by employee-only table RLS policies.
      supabase: admin,
    };
  }

  throw new Error(errorMessage);
}

export async function canOpenClaimWorkflowResource(claimId: string) {
  try {
    await requireClaimWorkflowAccess(claimId, "Access denied.");
    return true;
  } catch {
    return false;
  }
}
