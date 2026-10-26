import Link from "next/link";
import { requirePartnerReportScope } from "@/lib/reports/partner-report-scope";
import { getPartnerWebClaimSummary, getPartnerWebRenewalSummary } from "@/lib/partner-web";
import { PartnerReportTabs } from "@/components/partner-portal/partner-report-tabs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const number = (value: number | string) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value));

export default async function PartnerOperationsReport() {
  await requirePartnerReportScope();
  const [claims, renewals] = await Promise.all([getPartnerWebClaimSummary(), getPartnerWebRenewalSummary()]);
  const fields = [
    ["Active claims", claims.active_claims],
    ["Completed claims", claims.completed_claims],
    ["Assistance requested", claims.assistance_requested],
    ["Renewals due in 7 days", renewals.due_0_7_count],
    ["Renewals due in 8–15 days", renewals.due_8_15_count],
    ["Renewals due in 16–30 days", renewals.due_16_30_count],
    ["Overdue renewals", renewals.overdue_count],
  ] as const;
  return (
    <main className="mx-auto min-h-screen max-w-[1500px] space-y-5 bg-[#F6F8FC] px-4 pb-28 pt-6 text-[#11254A] lg:ml-[268px] lg:px-8 lg:pb-12">
      <h1 className="text-3xl font-extrabold">Reports</h1>
      <PartnerReportTabs active="Operations" />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {fields.map(([label, value]) => <div key={label} className="rounded-xl border border-[#E2E9F3] bg-white p-5"><p className="text-xs font-semibold text-[#6D7E9A]">{label}</p><p className="mt-2 text-2xl font-bold">{number(value)}</p></div>)}
      </section>
      <section className="rounded-2xl border border-[#E2E9F3] bg-white p-5">
        <h2 className="font-bold">Operations registers</h2>
        <p className="mt-2 text-sm text-[#70809A]">Access claim and renewal records within your existing portal permissions. Detailed operations exports remain unavailable pending server-side scope verification.</p>
        <div className="mt-4 flex flex-wrap gap-3"><Link href="/partner/claims" className="text-sm font-bold text-[#2369C5]">View claims →</Link><Link href="/partner/renewals" className="text-sm font-bold text-[#2369C5]">View renewals →</Link></div>
      </section>
    </main>
  );
}
