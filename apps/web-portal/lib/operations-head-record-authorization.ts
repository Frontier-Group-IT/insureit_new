import "server-only";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canAccessOperationsHeadCase, canAccessPolicy } from "@/lib/policy-access-scope";

export type OperationsHeadRecordKind = "policy" | "life_health_case";

/**
 * Server-only record guard. Must run before service-role reads, uploads,
 * updates, approvals, or document signing. A capability grant without this
 * check is never sufficient for the Operations Head role.
 */
export async function requireOperationsHeadRecordOwnership(kind: OperationsHeadRecordKind, recordId: string) {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id || profile.role !== "operations_head_life" || !recordId) {
    throw new Error("operations_head_record_access_denied");
  }

  const allowed = kind === "policy"
    ? await canAccessPolicy(profile.id, "operations_head_life", recordId, "view_policies", true)
    : await canAccessOperationsHeadCase(profile.id, recordId, true);

  if (!allowed) throw new Error("operations_head_record_access_denied");
  return profile;
}
