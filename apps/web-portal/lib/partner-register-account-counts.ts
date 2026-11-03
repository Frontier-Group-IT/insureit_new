import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PartnerAccountCounts = { associateCount: number | null; branchCount: number | null };

const BATCH_SIZE = 80;
const PAGE_SIZE = 500;
const chunk = <T,>(items: T[]): T[][] => {
  const parts: T[][] = [];
  for (let offset = 0; offset < items.length; offset += BATCH_SIZE) parts.push(items.slice(offset, offset + BATCH_SIZE));
  return parts;
};

/**
 * Read-only account counts, scoped to the Partner records already authorized
 * in the Partner Register. Account status (active, invited, disabled) does not
 * change whether the account exists and is counted.
 */
export async function loadPartnerAccountCounts(
  partners: Array<{ partnerId: string; intermediaryId: string }>,
): Promise<Map<string, PartnerAccountCounts>> {
  const result = new Map<string, PartnerAccountCounts>();
  if (!partners.length) return result;
  const admin = createSupabaseAdminClient();
  const partnerIds = [...new Set(partners.map(item => item.partnerId))];
  const intermediaryIds = [...new Set(partners.map(item => item.intermediaryId))];
  const associatesByIntermediary = new Map<string, Set<string>>();
  const childrenByParent = new Map<string, Set<string>>();
  let associateFailure = false;
  let branchFailure = false;

  try {
    for (const batch of chunk(intermediaryIds)) {
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await admin.from("partner_portal_associate_accounts")
          .select("id,intermediary_id").in("intermediary_id", batch)
          .order("id").range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        for (const row of data ?? []) {
          if (!associatesByIntermediary.has(row.intermediary_id)) associatesByIntermediary.set(row.intermediary_id, new Set());
          associatesByIntermediary.get(row.intermediary_id)!.add(row.id);
        }
        if ((data?.length ?? 0) < PAGE_SIZE) break;
      }
    }
  } catch (error) {
    associateFailure = true;
    console.error("[partner-register] Associate count unavailable", error instanceof Error ? error.message : "unknown");
  }

  try {
    const children = new Map<string, string>();
    for (const batch of chunk(partnerIds)) {
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await admin.from("partners")
          .select("id,parent_partner_id").in("parent_partner_id", batch)
          .order("id").range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        for (const row of data ?? []) {
          children.set(row.id, row.parent_partner_id);
        }
        if ((data?.length ?? 0) < PAGE_SIZE) break;
      }
    }
    // The Branch Register only counts child Partner records with a registered
    // partner_branch_profiles row. Do not count unregistered children.
    for (const batch of chunk([...children.keys()])) {
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await admin.from("partner_branch_profiles")
          .select("partner_id").in("partner_id", batch)
          .order("partner_id").range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        for (const row of data ?? []) {
          const parentId = children.get(row.partner_id);
          if (!parentId) continue;
          if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, new Set());
          childrenByParent.get(parentId)!.add(row.partner_id);
        }
        if ((data?.length ?? 0) < PAGE_SIZE) break;
      }
    }
  } catch (error) {
    branchFailure = true;
    console.error("[partner-register] Branch count unavailable", error instanceof Error ? error.message : "unknown");
  }

  for (const { partnerId, intermediaryId } of partners) {
    result.set(partnerId, {
      associateCount: associateFailure ? null : associatesByIntermediary.get(intermediaryId)?.size ?? 0,
      branchCount: branchFailure ? null : childrenByParent.get(partnerId)?.size ?? 0,
    });
  }
  return result;
}
