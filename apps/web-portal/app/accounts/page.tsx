import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";

export default async function AccountsPage() {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");

  return (
    <AppShell title="Accounts Dashboard">
      <div className="mx-auto max-w-[1560px] space-y-2.5 pb-6">
        <section className="flex items-center rounded-2xl border border-[#dbe3ee] bg-white px-4 py-2.5 shadow-sm">
          <span className="mr-2.5 grid h-8 w-8 place-items-center rounded-lg bg-[#e8f5f3] text-[#0f766e]">
            <Landmark className="h-4 w-4" />
          </span>
          <h1 className="text-[17px] font-semibold text-[#17365D]">Accounts Dashboard</h1>
        </section>
      </div>
    </AppShell>
  );
}
