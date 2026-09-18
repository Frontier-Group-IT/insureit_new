"use server";

import { resolveAccountsDashboardFilters, type AccountsDashboardQuery, type AccountsDashboardFilters } from "@/lib/accounts-dashboard";
import { loadAccountsDashboardSnapshot } from "@/lib/accounts-business-mis";
import type { AccountsDashboardClientSnapshot, BusinessMisClientCell } from "@/lib/accounts-business-mis-schema";
import { requireCapability } from "@/lib/master-data-server";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";

export async function loadAccountsSnapshotAction(query: AccountsDashboardQuery): Promise<{
  filters: AccountsDashboardFilters;
  snapshot: AccountsDashboardClientSnapshot;
}> {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) throw new Error("Commercial details restricted");

  const filters = resolveAccountsDashboardFilters(query);
  const data = await loadAccountsDashboardSnapshot(profile, filters, { includeInsurers: false });

  return {
    filters,
    snapshot: {
      ...data,
      rows: data.rows.map((row) => row.map(serializeCell)),
    },
  };
}

function serializeCell(value: string | number | Date): BusinessMisClientCell {
  return value instanceof Date ? value.toISOString() : value;
}
