import type { ReactNode } from "react";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";

export default async function ManagementPackLayout({ children }: { children: ReactNode }) {
  const profile = await requireCapability("view_reports");
  if (canAccessPolicyCommercials(profile)) return children;

  return (
    <AppShell title="Reports">
      <div className="mx-auto max-w-[900px] rounded-2xl border border-[#D9E2F0] bg-white px-5 py-8 shadow-sm">
        <h1 className="text-[16px] font-semibold text-[#17365D]">Month-End Management Pack</h1>
        <div className="mt-4 rounded-xl border border-dashed border-[#D7DDE6] bg-[#F8FAFC] px-4 py-5 text-[10px] font-semibold text-[#667085]">
          Commercial details restricted
        </div>
      </div>
    </AppShell>
  );
}
