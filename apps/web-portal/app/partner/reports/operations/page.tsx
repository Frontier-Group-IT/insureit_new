import { ScopedReportDistribution } from "@/components/partner-portal/scoped-report-distribution";
import { PartnerReportsShell } from "@/components/partner-portal/partner-reports-shell";
import Link from "next/link";
import { requirePartnerReportScope } from "@/lib/reports/partner-report-scope";
import { getPartnerWebClaimSummary, getPartnerWebRenewalSummary, listPartnerWebClaims } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const number = (value: number | string) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value));

export default async function PartnerOperationsReport({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const rawPage = (await searchParams).page;
  const page = rawPage && /^[1-9]\d{0,3}$/.test(rawPage) ? Number(rawPage) : 1;
  const offset = (page - 1) * 20;
  const reportScope = await requirePartnerReportScope();
  const [claims, renewals, recentClaims] = await Promise.all([getPartnerWebClaimSummary(), getPartnerWebRenewalSummary(), listPartnerWebClaims({ limit: 21, offset })]);
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
    <PartnerReportsShell active="Operations" scope={reportScope}>
      
      <ScopedReportDistribution title="Claim status distribution" items={[{label:"Active claims",value:Number(claims.active_claims)},{label:"Completed claims",value:Number(claims.completed_claims)},{label:"Other claims",value:Math.max(0,Number(claims.total_claims)-Number(claims.active_claims)-Number(claims.completed_claims))}]}/>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {fields.map(([label, value]) => <div key={label} className="rounded-xl border border-[#E2E9F3] bg-white p-3 shadow-sm"><p className="text-xs font-semibold text-[#6D7E9A]">{label}</p><p className="mt-2 text-2xl font-bold">{number(value)}</p></div>)}
      </section>
      <section className="rounded-2xl border border-[#E2E9F3] bg-white p-3 shadow-sm">
        <Link href="/partner/reports/export?type=claims" className="float-right ml-3 rounded-lg border border-[#D7E3F3] px-3 py-2 text-xs font-semibold text-[#2369C5]"> Download claims snapshot (up to 200 rows)</Link>
        <h2 className="font-bold">Operations registers</h2>
        <p className="mt-2 text-sm text-[#70809A]">Access claim and renewal records within your existing portal permissions. Detailed operations exports remain unavailable pending server-side scope verification.</p>
        <div className="mt-4 flex flex-wrap gap-3"><Link href="/partner/claims" className="text-sm font-bold text-[#2369C5]">View claims →</Link><Link href="/partner/renewals" className="text-sm font-bold text-[#2369C5]">View renewals →</Link></div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-[#E2E9F3] bg-white">
        <div className="border-b border-[#E9EEF6] px-5 py-4"><h2 className="font-bold">Claims register preview</h2><p className="mt-1 text-xs text-[#71809A]">Up to 20 claims from your authorized account scope</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-[#F5F8FC] text-[#697A95]"><tr>{["Claim","Customer","Vehicle","Insurer","Status"].map(label=><th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#E9EEF6]">{recentClaims.slice(0, 20).map(row=><tr key={row.claim_id}><td className="px-4 py-3 font-semibold">{row.claim_no || "—"}</td><td className="px-4 py-3">{row.customer_name}</td><td className="px-4 py-3">{row.vehicle_no || "—"}</td><td className="px-4 py-3">{row.insurer_name || "—"}</td><td className="px-4 py-3">{row.current_status || "—"}</td></tr>)}{!recentClaims.length && <tr><td colSpan={5} className="px-5 py-8 text-center text-[#70809A]">No claims in your current reporting scope.</td></tr>}</tbody></table></div>
      </section>
      <nav aria-label="Claims register pagination" className="flex items-center justify-end gap-3 text-xs font-semibold">
        {page > 1 ? <Link href={`/partner/reports/operations?page=${page - 1}`} className="rounded-lg border border-[#D9E4F3] bg-white px-4 py-2">Previous</Link> : null}
        <span>Page {page}</span>
        {recentClaims.length > 20 ? <Link href={`/partner/reports/operations?page=${page + 1}`} className="rounded-lg border border-[#D9E4F3] bg-white px-4 py-2">Next</Link> : null}
      </nav>
    </PartnerReportsShell>
  );
}
