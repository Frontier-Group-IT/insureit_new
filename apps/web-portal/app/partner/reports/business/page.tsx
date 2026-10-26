import { PartnerReportsShell } from "@/components/partner-portal/partner-reports-shell";
import { requirePartnerReportScope } from "@/lib/reports/partner-report-scope";
import { getPartnerWebBusinessPerformance } from "@/lib/partner-web";
import { PartnerReportsShell } from "@/components/partner-portal/partner-reports-shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const number = (value: number | string) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value));
const money = (value: number | string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));

export default async function PartnerBusinessReport() {
  const reportScope = await requirePartnerReportScope();
  const report = await getPartnerWebBusinessPerformance();
  return (
    <PartnerReportsShell active="Business" scope={reportScope}>
      <h1 className="text-3xl font-extrabold">Reports</h1>
      
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Premium this month", money(report.premium_this_month)],
          ["Premium last month", money(report.premium_last_month)],
          ["Policies this month", number(report.policies_this_month)],
          ["Lifetime premium", money(report.lifetime_gross_premium)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#E2E9F3] bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold text-[#6C7F9C]">{label}</p>
            <p className="mt-2 break-words text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>
      <section className="rounded-2xl border border-[#E2E9F3] bg-white p-3 shadow-sm">
        <h2 className="text-base font-bold">Business trend</h2>
        <div className="mt-5 space-y-3">
          {report.trend.length ? report.trend.map((point) => (
            <div key={point.month} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 text-xs">
              <span className="font-semibold text-[#58708E]">{point.month}</span>
              <div className="h-3 overflow-hidden rounded-full bg-[#EAF0F9]"><div className="h-full rounded-full bg-[#317AD8]" style={{ width: `${Math.max(0, Math.min(100, Number(point.premium) / Math.max(1, ...report.trend.map((row) => Number(row.premium))) * 100))}%` }} /></div>
              <span className="text-right font-bold">{money(point.premium)}</span>
            </div>
          )) : <p className="text-sm text-[#70809A]">No business trend data for this account.</p>}
        </div>
      </section>
      <section className="rounded-2xl border border-[#E2E9F3] bg-white p-3 shadow-sm">
        <h2 className="text-base font-bold">Business mix</h2>
        <div className="mt-4 divide-y divide-[#EDF1F7]">
          {report.business_mix.length ? report.business_mix.map((item, index) => (
            <div key={`${item.label}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 py-3 text-sm">
              <span className="truncate font-semibold">{item.label}</span>
              <span className="text-[#6D7E9A]">{number(item.policies)} policies</span>
              <span className="font-bold">{money(item.premium)}</span>
            </div>
          )) : <p className="py-4 text-sm text-[#70809A]">No business mix data for this account.</p>}
        </div>
      </section>
    </PartnerReportsShell>
  );
}
