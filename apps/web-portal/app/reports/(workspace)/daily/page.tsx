import Link from "next/link";
import { requireCapability } from "@/lib/master-data-server";
import {
  DAILY_ACTIVITY_GROUPS, loadDailyActivityReport,
  type DailyActivityQuery,
} from "@/lib/reports/daily-activity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<DailyActivityQuery> };
const inputClass = "h-9 w-full rounded-lg border border-[#d9e0e8] bg-white px-3 text-[11px] font-medium text-[#344054] outline-none focus:border-[#5275AA] focus:ring-2 focus:ring-[#e9f0f7]";

export default async function DailyReportPage({ searchParams }: Props) {
  const profile = await requireCapability("view_reports");
  const query = await searchParams;
  let payload: Awaited<ReturnType<typeof loadDailyActivityReport>> | null = null;
  let error = false;
  try {
    payload = await loadDailyActivityReport(profile, query);
  } catch (caught) {
    console.error("[daily-report] read-only report load failed", caught instanceof Error ? caught.message : "Unknown error");
    error = true;
  }
  const filters = payload?.filters ?? {
    scope: query.scope === "all" ? "all" : "self" as const,
    type: DAILY_ACTIVITY_GROUPS.find(item => item.value === query.type)?.value ?? "all",
    date: query.date ?? "",
    employee: query.employee ?? "",
    page: 1,
  };
  const linkFor = (updates: Partial<DailyActivityQuery>) => {
    const params = new URLSearchParams({
      scope: filters.scope, type: filters.type, date: filters.date,
      ...(filters.scope === "all" && filters.employee ? {employee:filters.employee} : {}),
      ...updates,
    });
    return `/reports/daily?${params.toString()}`;
  };
  const format = new Intl.DateTimeFormat("en-IN", {
    timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric",
    hour:"2-digit",minute:"2-digit",hour12:true,
  });
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-[#dce4ef] bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-[#17365D]">Daily Report</h2>
            <p className="mt-1 text-[10px] text-[#66758B]">Recorded employee activities · India Standard Time</p>
          </div>
          <span className="rounded-full border border-[#E3EAF4] bg-[#F7F9FC] px-2.5 py-1 text-[9px] font-semibold text-[#60718A]">Read-only</span>
        </div>
        <nav aria-label="Daily Report visibility" className="mt-3 flex w-fit gap-1 rounded-xl border border-[#d9e4f2] bg-[#F6F9FE] p-1">
          <Link prefetch={false} href={linkFor({scope:"self",page:"1",employee:""})} aria-current={filters.scope === "self" ? "page" : undefined}
            className={`min-w-[90px] rounded-lg px-4 py-2 text-center text-[11px] font-bold ${filters.scope === "self" ? "bg-[#17365D] text-white" : "text-[#52627B] hover:bg-white"}`}>Self</Link>
          <Link prefetch={false} href={linkFor({scope:"all",page:"1"})} aria-current={filters.scope === "all" ? "page" : undefined}
            className={`min-w-[90px] rounded-lg px-4 py-2 text-center text-[11px] font-bold ${filters.scope === "all" ? "bg-[#17365D] text-white" : "text-[#52627B] hover:bg-white"}`}>All</Link>
        </nav>
        <form action="/reports/daily" method="get" className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-[180px_200px_minmax(180px,1fr)_auto_auto] xl:items-end">
          <input type="hidden" name="scope" value={filters.scope}/>
          <label className="block space-y-1 text-[9px] font-bold uppercase tracking-wide text-[#60718A]">Date
            <input className={inputClass} name="date" type="date" defaultValue={filters.date} required/>
          </label>
          <label className="block space-y-1 text-[9px] font-bold uppercase tracking-wide text-[#60718A]">Activity Type
            <select name="type" defaultValue={filters.type} className={inputClass}>
              {DAILY_ACTIVITY_GROUPS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block space-y-1 text-[9px] font-bold uppercase tracking-wide text-[#60718A]">Employee Search
            <input name="employee" type="search" maxLength={80} defaultValue={filters.scope === "all" ? filters.employee : ""}
              disabled={filters.scope === "self"} placeholder={filters.scope === "self" ? "Your activities only" : "Employee name or code"} className={inputClass}/>
          </label>
          <button type="submit" className="h-9 rounded-lg bg-[#17558E] px-5 text-[11px] font-bold text-white hover:bg-[#17456E]">Apply</button>
          <Link prefetch={false} href="/reports/daily" className="flex h-9 items-center justify-center rounded-lg border border-[#D5DEEA] px-4 text-[11px] font-semibold text-[#435775]">Reset</Link>
        </form>
      </section>
      <section className="overflow-hidden rounded-xl border border-[#dce4ef] bg-white shadow-sm" aria-label="Daily activity register">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e9f1] px-4 py-3">
          <h3 className="text-[12px] font-bold text-[#17365D]">Activity Register</h3>
          <p className="text-[10px] text-[#697A90]">{filters.scope === "self" ? "Your recorded activity" : "Reporting-scope activity"} · {payload?.rows.length ?? 0} displayed</p>
        </header>
        {error ? (
          <p role="alert" className="px-5 py-8 text-center text-[11px] font-semibold text-red-700">Daily Report is temporarily unavailable. No records have been changed.</p>
        ) : !payload?.rows.length ? (
          <p className="px-5 py-10 text-center text-[11px] text-[#718096]">No recorded activity matches these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[910px] text-left">
              <thead className="bg-[#F7F9FC] text-[9px] font-bold uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">Employee Name</th>
                  <th className="px-3 py-3">Activity Type</th>
                  <th className="px-3 py-3">Reference Number</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f6]">
                {payload.rows.map(row=>{
                  const parts = format.formatToParts(new Date(row.occurredAt));
                  const date = parts.filter(p=>["day","month","year"].includes(p.type)).map(p=>p.value).join(" ");
                  const time = parts.filter(p=>["hour","minute","dayPeriod"].includes(p.type)).map(p=>p.value).join(" ");
                  return (
                    <tr key={row.id} className="text-[11px] text-[#30435D] hover:bg-[#F9FBFF]">
                      <td className="px-4 py-3"><span className="font-bold">{row.employeeName}</span>{row.employeeCode?<span className="block text-[9px] text-[#8794A6]">{row.employeeCode}</span>:null}</td>
                      <td className="px-3 py-3 font-semibold">{row.type}</td>
                      <td className="max-w-[240px] break-all px-3 py-3 font-medium">{row.reference}</td>
                      <td className="whitespace-nowrap px-3 py-3">{date}</td>
                      <td className="whitespace-nowrap px-3 py-3">{time}</td>
                      <td className="px-3 py-3"><span className="rounded-md bg-[#EDF3FA] px-2 py-1 text-[9px] font-bold text-[#35587E]">{row.status}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-[10px] text-[#718096]">{row.source}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!error && payload ? (
          <div className="flex items-center justify-between border-t border-[#e4e9f1] px-4 py-3 text-[10px] text-[#66758B]">
            <span>Page {filters.page} · {payload.pageSize} per page</span>
            <div className="flex gap-2">
              <Link prefetch={false} aria-disabled={filters.page <= 1} href={filters.page <= 1 ? "#" : linkFor({page:String(filters.page-1)})}
                className={`rounded-lg border px-3 py-1.5 font-bold ${filters.page<=1?"pointer-events-none opacity-40":"hover:bg-[#F5F8FC]"}`}>Previous</Link>
              <Link prefetch={false} aria-disabled={!payload.hasNext} href={!payload.hasNext ? "#" : linkFor({page:String(filters.page+1)})}
                className={`rounded-lg border px-3 py-1.5 font-bold ${!payload.hasNext?"pointer-events-none opacity-40":"hover:bg-[#F5F8FC]"}`}>Next</Link>
            </div>
          </div>
        ) : null}
      </section>
      <p className="px-1 text-[10px] leading-5 text-[#7B8799]">
        Phase 1 shows existing recorded events and attributable creation/finalization history. Some older events, unlogged workflow changes, and actions with no verified employee identity may be absent. System records are never attributed to an employee by guesswork.
      </p>
    </div>
  );
}
