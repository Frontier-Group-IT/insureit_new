import Link from "next/link";
import { requirePartnerReportScope } from "@/lib/reports/partner-report-scope";
import { getPartnerWebPolicySummary } from "@/lib/partner-web";
import { PartnerReportTabs } from "@/components/partner-portal/partner-report-tabs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const number = (value: number | string) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value));

export default async function PartnerPortfolioReport() {
  await requirePartnerReportScope();
  const report = await getPartnerWebPolicySummary();
  const fields = [
    ["Total policies", report.total_policies],
    ["In force", report.in_force_policies],
    ["Expiring in 30 days", report.expiring_30_days],
    ["Expired policies", report.expired_policies],
    ["Upcoming policies", report.upcoming_policies],
    ["Motor policies", report.motor_policies],
  ] as const;
  return (
    <main className="mx-auto min-h-screen max-w-[1500px] space-y-5 bg-[#F6F8FC] px-4 pb-28 pt-6 text-[#11254A] lg:ml-[268px] lg:px-8 lg:pb-12">
      <h1 className="text-3xl font-extrabold">Reports</h1>
      <PartnerReportTabs active="Portfolio" />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {fields.map(([label, value]) => <div key={label} className="rounded-xl border border-[#E2E9F3] bg-white p-5"><p className="text-xs font-semibold text-[#6D7E9A]">{label}</p><p className="mt-2 text-2xl font-bold">{number(value)}</p></div>)}
      </section>
      <div className="rounded-2xl border border-[#E2E9F3] bg-white p-5">
        <a href="/partner/reports/export?type=policies" className="float-right ml-3 rounded-lg border border-[#D7E3F3] px-3 py-2 text-xs font-semibold text-[#2369C5]"> Download policy snapshot (up to 200 rows)</a>
        <h2 className="font-bold">Authorized policy portfolio</h2>
        <p className="mt-2 text-sm text-[#70809A]">This summary uses the existing signed-in account's authorized policy scope. Detailed insurer exposure and register exports require separate scoped backend contracts.</p>
        <Link href="/partner/policies" className="mt-4 inline-block text-sm font-bold text-[#2369C5]">Open policies →</Link>
      </div>
    </main>
  );
}
