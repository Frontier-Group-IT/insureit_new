import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { getReconciliationCycle } from "../actions";
import { CycleDetailClient } from "../cycle-detail-client";
import { UnmatchedCorrections } from "../unmatched-corrections";

type Props = { params: Promise<{ id: string }> };
type CorrectionLine = { id: string; source_row_no: number; input_policy_no: string; match_status: string };

export default async function ReconciliationCyclePage({ params }: Props) {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");
  const { id } = await params;
  const data = await getReconciliationCycle(id);
  const cycle = data.cycle as { id: string; status: string };
  const correctionLines = data.lines as CorrectionLine[];
  return <AppShell title="Reconciliation Review">
    <div className="space-y-4">
      <UnmatchedCorrections cycleId={cycle.id} cycleStatus={cycle.status} lines={correctionLines} />
      <CycleDetailClient initialCycle={data.cycle as never} initialLines={data.lines as never} initialEvents={data.events as never} />
    </div>
  </AppShell>;
}
