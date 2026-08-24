import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { getReconciliationDraft, listReconciliationDrafts, listReconciliationInsurers } from "./actions";
import { ReconciliationScreen } from "./reconciliation-screen";

type Props = { searchParams: Promise<{ draft?: string }> };

export default async function ReconciliationPage({ searchParams }: Props) {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");
  const { draft } = await searchParams;
  const [insurers, drafts, initialDraft] = await Promise.all([
    listReconciliationInsurers(),
    listReconciliationDrafts(),
    draft ? getReconciliationDraft(draft).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <AppShell title="Insurer Reconciliation">
      <ReconciliationScreen insurers={insurers} drafts={drafts as never[]} initialDraft={initialDraft as never} />
    </AppShell>
  );
}
