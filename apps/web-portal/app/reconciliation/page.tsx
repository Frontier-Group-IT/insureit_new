import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { listReconciliationInsurers } from "./actions";
import { ReconciliationWorkspace } from "./reconciliation-workspace";

export default async function ReconciliationPage() {
  const profile = await requireCapability("view_reports");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");
  const insurers = await listReconciliationInsurers();

  return (
    <AppShell title="Reconciliation">
      <ReconciliationWorkspace insurers={insurers} />
    </AppShell>
  );
}
