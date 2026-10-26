import { ScopedReportDistribution } from "@/components/partner-portal/scoped-report-distribution";
import { PartnerReportsShell } from "@/components/partner-portal/partner-reports-shell";
import Link from "next/link";
import { requirePartnerReportScope } from "@/lib/reports/partner-report-scope";
import { getPartnerWebPolicySummary, listPartnerWebPolicies } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const number = (value: number | string) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value));

export default async function PartnerPortfolioReport({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const rawPage = (await searchParams).page;
  const page = rawPage && /^[1-9]\d{0,3}$/.test(rawPage) ? Number(rawPage) : 1;
  const offset = (page - 1) * 20;
  const reportScope = await requirePartnerReportScope();
  const [report, recentPolicies] = await Promise.all([getPartnerWebPolicySummary(), listPartnerWebPolicies({ limit: 21, offset })]);
  const fields = [
    ["Total policies", report.total_policies],
    ["In force", report.in_force_policies],
    ["Expiring in 30 days", report.expiring_30_days],
    ["Expired policies", report.expired_policies],
    ["Upcoming policies", report.upcoming_policies],
    ["Motor policies", report.motor_policies],
  ] as const;
  return (
    <PartnerReportsShell active="Portfolio" scope={reportScope}>
      
      <ScopedReportDistribution title="Policy business mix" items={[{label:"Motor",value:Number(report.motor_policies)},{label:"Other business",value:Math.max(0,Number(report.total_policies)-Number(report.motor_policies))}]}/>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {fields.map(([label, value]) => <div key={label} className="rounded-xl border border-[#E2E9F3] bg-white p-3 shadow-sm"><p className="text-xs font-semibold text-[#6D7E9A]">{label}</p><p className="mt-2 text-2xl font-bold">{number(value)}</p></div>)}
      </section>
      <div className="rounded-2xl border border-[#E2E9F3] bg-white p-3 shadow-sm">
        <Link href="/partner/reports/export?type=policies" className="float-right ml-3 rounded-lg border border-[#D7E3F3] px-3 py-2 text-xs font-semibold text-[#2369C5]"> Download policy snapshot (up to 200 rows)</Link>
        <h2 className="font-bold">Authorized policy portfolio</h2>
        <p className="mt-2 text-sm text-[#70809A]">This summary uses the existing signed-in account&apos;s authorized policy scope. Detailed insurer exposure and register exports require separate scoped backend contracts.</p>
        <Link href="/partner/policies" className="mt-4 inline-block text-sm font-bold text-[#2369C5]">Open policies →</Link>
      </div>
      <section className="overflow-hidden rounded-2xl border border-[#E2E9F3] bg-white">
        <div className="border-b border-[#E9EEF6] px-5 py-4"><h2 className="font-bold">Policy register preview</h2><p className="mt-1 text-xs text-[#71809A]">Up to 20 policies from your authorized account scope</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-[#F5F8FC] text-[#697A95]"><tr>{["Policy","Customer","Vehicle","Insurer","Expiry"].map(label=><th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#E9EEF6]">{recentPolicies.slice(0, 20).map(row=><tr key={row.policy_id}><td className="px-4 py-3 font-semibold">{row.policy_no || "—"}</td><td className="px-4 py-3">{row.customer_name}</td><td className="px-4 py-3">{row.vehicle_no || "—"}</td><td className="px-4 py-3">{row.insurer_name || "—"}</td><td className="px-4 py-3">{row.end_date || "—"}</td></tr>)}{!recentPolicies.length && <tr><td colSpan={5} className="px-5 py-8 text-center text-[#70809A]">No policies in your current reporting scope.</td></tr>}</tbody></table></div>
      </section>
      <nav aria-label="Policy register pagination" className="flex items-center justify-end gap-3 text-xs font-semibold">
        {page > 1 ? <Link href={`/partner/reports/portfolio?page=${page - 1}`} className="rounded-lg border border-[#D9E4F3] bg-white px-4 py-2">Previous</Link> : null}
        <span>Page {page}</span>
        {recentPolicies.length > 20 ? <Link href={`/partner/reports/portfolio?page=${page + 1}`} className="rounded-lg border border-[#D9E4F3] bg-white px-4 py-2">Next</Link> : null}
      </nav>
    </PartnerReportsShell>
  );
}
