import { PolicyIntakeForm } from "@/components/policy-intake-form";
import { AppShell } from "@/components/shell";
import { loadEligiblePolicyIntakeSources, requirePolicyIntakeCreator } from "@/lib/policy-intake-server";

export const dynamic = "force-dynamic";

export default async function NewPolicyIntakePage() {
  const profile = await requirePolicyIntakeCreator();
  const sources = await loadEligiblePolicyIntakeSources(profile);
  return <AppShell title="New Policy Intake">
    <PolicyIntakeForm sources={sources} />
    {!sources.length ? <div className="mx-auto -mt-20 max-w-[560px] rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] text-amber-900">No active Partner, POSP or MISP is assigned inside your permitted sales scope. Ask Sales Operations to assign at least one lead source.</div> : null}
  </AppShell>;
}
