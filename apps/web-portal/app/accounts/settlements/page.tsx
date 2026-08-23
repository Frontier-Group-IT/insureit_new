import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { listSettlementWorkbench } from "./actions";
import { SettlementWorkbench } from "./workbench";

export default async function SettlementsPage() {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");
  const data = await listSettlementWorkbench();
  return <AppShell title="Receipts & TDS"><SettlementWorkbench data={data} /></AppShell>;
}
