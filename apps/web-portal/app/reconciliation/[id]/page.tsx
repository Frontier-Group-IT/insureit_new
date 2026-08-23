import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { getReconciliationCycle } from "../actions";
import { CycleDetailClient } from "../cycle-detail-client";

type Props = { params: Promise<{ id: string }> };

export default async function ReconciliationCyclePage({ params }: Props) {
  const profile = await requireCapability("view_reports");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");
  const { id } = await params;
  const data = await getReconciliationCycle(id);
  return <AppShell title="Reconciliation Review"><CycleDetailClient initialCycle={data.cycle as never} initialLines={data.lines as never} initialEvents={data.events as never} /></AppShell>;
}
