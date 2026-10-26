import Link from "next/link";
import { BusinessTrendCard } from "@/components/reports/business-trend-card";
import { PartnerReportsShell } from "@/components/partner-portal/partner-reports-shell";
import { requirePartnerReportScope } from "@/lib/reports/partner-report-scope";
import { getPartnerWebBusinessPerformance, getPartnerWebBusinessRange } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const number = (value: number | string) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value));
const money = (value: number | string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));

type Period = "mtd" | "last_month" | "last_6_months" | "1_year";
const periods: { key: Period; label: string }[] = [{key:"mtd",label:"MTD"},{key:"last_month",label:"Last month"},{key:"last_6_months",label:"Last 6 months"},{key:"1_year",label:"1 year"}];
function reportDates(period: Period) {
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get = (key:string) => Number(parts.find(part=>part.type===key)?.value);
  const year=get("year"), month=get("month")-1, day=get("day");
  const iso = (d:Date) => d.toISOString().slice(0,10);
  const start=(offset:number)=>new Date(Date.UTC(year,month+offset,1));
  if(period==="last_month") return {from:iso(start(-1)),to:iso(new Date(Date.UTC(year,month,0)))};
  return {from:iso(start(period==="mtd"?0:period==="last_6_months"?-5:-11)),to:iso(new Date(Date.UTC(year,month,day)))};
}
export default async function PartnerBusinessReport({searchParams}:{searchParams:Promise<{period?:string}>}) {
  const reportScope = await requirePartnerReportScope();
  const requested = (await searchParams).period;
  const period:Period = periods.some(item=>item.key===requested) ? requested as Period : "last_6_months";
  const dates=reportDates(period);
  const [report, range] = await Promise.all([getPartnerWebBusinessPerformance(),getPartnerWebBusinessRange(dates.from,dates.to)]);
  return (
    <PartnerReportsShell active="Business" scope={reportScope}>
      <nav aria-label="Business report period" className="flex flex-wrap gap-1 rounded-xl border border-[#dde7f4] bg-white p-2">{periods.map(item=><Link key={item.key} href={`/partner/reports/business?period=${item.key}`} prefetch={false} aria-current={period===item.key?"page":undefined} className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${period===item.key?"bg-[#173e6d] text-white":"text-[#536885] hover:bg-[#edf4fb]"}`}>{item.label}</Link>)}<span className="ml-auto self-center text-[10px] text-slate-500">{dates.from} — {dates.to}</span></nav>
      
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Selected period premium", money(range.premium)],
          ["Selected period policies", number(range.policies)],
          ["Selected period customers", number(range.customers)],
          ["Premium change", `${Number(range.premium_change_percent).toFixed(1)}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#E2E9F3] bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold text-[#6C7F9C]">{label}</p>
            <p className="mt-2 break-words text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>
      <p className="px-1 text-[10px] text-[#70809A]">The chart and business mix below reflect the existing six-month scoped summary; the period selector applies to the KPI cards above.</p>
      <BusinessTrendCard activePeriod="last_6_months" options={[{value:"last_6_months",label:"Last 6 Months",href:"/partner/reports/business"}]} points={report.trend.map(point=>({key:point.month,label:point.month,axisLabel:point.month,policy_count:Number(point.policies),net_premium:Number(point.premium)}))}/>
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
