import "server-only";
import { redirect } from "next/navigation";
import { getPartnerWebSession } from "@/lib/partner-web";

export type PartnerReportRole = "group" | "group_associate" | "partner" | "partner_associate" | "branch";
export type PartnerReportScope = {
  role: PartnerReportRole;
  partnerIds: string[];
  intermediaryIds: string[];
  groupIds: string[];
  // The entity identifier is resolved by authenticated database RPCs, never query parameters.
  accountEntityId: string;
};

const uuid = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);

function ids(input: unknown): string[] | null {
  if (!Array.isArray(input) || !input.every(uuid)) return null;
  return Array.from(new Set(input));
}

/**
 * Gate for Partner Portal reporting. A scope's group_ids describes affiliation
 * and must NEVER be treated as permission to read the entire group for a Partner.
 * The actual report data must still come from authenticated scoped RPCs.
 */
export async function requirePartnerReportScope(): Promise<PartnerReportScope> {
  const { identity, scope } = await getPartnerWebSession();
  const access = scope as typeof scope & {
    portal_access_type?: unknown;
    portal_access_entity_id?: unknown;
  };
  const account = identity as typeof identity & {
    account_subtype?: unknown;
    portal_access_type?: unknown;
    portal_access_entity_id?: unknown;
    group_id?: unknown;
  };
  const partnerIds = ids(scope.partner_ids);
  const intermediaryIds = ids(scope.intermediary_ids);
  const groupIds = ids(scope.group_ids);
  if (scope.actor_kind !== "intermediary" || !partnerIds || !intermediaryIds || !groupIds ||
      scope.scope_mode === "none" || scope.scope_mode === "organization") redirect("/access-denied");

  const accessType = access.portal_access_type ?? account.portal_access_type;
  if (accessType === "group") {
    const entityId = access.portal_access_entity_id ?? account.portal_access_entity_id ?? account.group_id;
    if (!uuid(entityId) || !groupIds.includes(entityId) || scope.scope_mode !== "hierarchy")
      redirect("/access-denied");
    return {
      role: account.account_subtype === "group_associate" ? "group_associate" : "group",
      accountEntityId: entityId, partnerIds, intermediaryIds, groupIds,
    };
  }

  if (accessType === "branch") {
    const entityId = access.portal_access_entity_id ?? account.portal_access_entity_id;
    if (!uuid(entityId) || scope.scope_mode !== "self" || partnerIds.length !== 1 || partnerIds[0] !== entityId)
      redirect("/access-denied");
    return { role: "branch", accountEntityId: entityId, partnerIds, intermediaryIds, groupIds };
  }

  if (identity.actor_kind !== "intermediary" || scope.scope_mode !== "partner_family" ||
      !uuid(identity.partner_id) || !partnerIds.includes(identity.partner_id))
    redirect("/access-denied");
  return {
    role: identity.portal_account_source === "associate" ? "partner_associate" : "partner",
    accountEntityId: identity.partner_id,
    partnerIds, intermediaryIds, groupIds,
  };
}
