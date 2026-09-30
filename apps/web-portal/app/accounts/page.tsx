import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { resolveAccountsDashboardFilters, type AccountsDashboardQuery } from "@/lib/accounts-dashboard";
import { loadAccountsDashboardSnapshot } from "@/lib/accounts-business-mis";
import type { AccountsDashboardClientSnapshot, BusinessMisClientCell } from "@/lib/accounts-business-mis-schema";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { AccountsDashboardClient } from "./accounts-dashboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<AccountsDashboardQuery> };

export default async function AccountsPage({ searchParams }: Props) {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");

  const query = await searchParams;
  const filters = resolveAccountsDashboardFilters(query);
  const data = await loadAccountsDashboardSnapshot(profile, filters);
  const initialSnapshot: AccountsDashboardClientSnapshot = {
    ...data,
    rows: data.rows.map((row) => row.map(serializeCell)),
  };

  return <AppShell title="Accounts Dashboard">
    <AccountsDashboardClient initialFilters={filters} initialSnapshot={initialSnapshot} />
  </AppShell>;
}

function serializeCell(value: string | number | Date): BusinessMisClientCell {
  return value instanceof Date ? value.toISOString() : value;
}
