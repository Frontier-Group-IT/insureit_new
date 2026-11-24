import { PolicyIntakeForm } from "@/components/policy-intake-form";
import { PartnerAppPromo } from "@/components/partner-app-promo";
import { AppShell } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { requireCapability } from "@/lib/master-data-server";
import { loadEligiblePolicyIntakeSources, requirePolicyIntakeCreator } from "@/lib/policy-intake-server";

export const dynamic = "force-dynamic";

export default async function NewPolicyIntakePage() {
  const { profile: requester } = await getAuthenticatedProfile(await getServerAccessToken());
  const profile = requester?.role === "operations_head_life" ? await requireCapability("view_policies") : await requirePolicyIntakeCreator();
  const sources = await loadEligiblePolicyIntakeSources(profile);
  return <AppShell title="New Policy Intake">
    <div className="mx-auto grid w-full max-w-[1500px] items-stretch gap-4 xl:grid-cols-2">
      <div className="flex min-w-0 flex-col">
        <PolicyIntakeForm sources={sources} />
        {!sources.length ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] text-amber-900">No active Partner, POSP or MISP is assigned inside your permitted sales scope. Ask Sales Operations to assign at least one lead source.</div> : null}
      </div>
      <PartnerAppPromo />
    </div>
  </AppShell>;
}
