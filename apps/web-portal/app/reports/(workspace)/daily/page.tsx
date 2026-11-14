import Link from "next/link";
import { DailySelfActivityPanel } from "@/components/reports/daily-self-activity-panel";
import { loadSelfActivityHistory } from "@/lib/reports/daily-self-activity";
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
  const isSelf = query.scope !== "all";
  let payload: Awaited<ReturnType<typeof loadDailyActivityReport>> | null = null;
  let selfHistory: Awaited<ReturnType<typeof loadSelfActivityHistory>> | null = null;
  let error = false;
  try {
    if (isSelf) {
      selfHistory = await loadSelfActivityHistory(profile.id, {
        day: query.period === "day" ? query.date : undefined,
        category: query.activity, page: query.page,
      });
    } else {
      payload = await loadDailyActivityReport(profile, query);
    }
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
      ...(isSelf ? {period: query.period === "day" ? "day" : "all",activity:query.activity??""} : {}),
      ...(filters.scope === "all" && filters.employee ? {employee:filters.employee} : {}),
      ...updates,
    });
    return `/reports/daily?${params.toString()}`;
  };
  const formatDate = new Intl.DateTimeFormat("en-IN", {
    timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric",
  });
  const formatTime = new Intl.DateTimeFormat("en-IN", {
    timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:true,
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
          <Link prefetch={false} href={linkFor({scope:"self",page:"1",employee:"",activity:"",period:"all"})} aria-current={filters.scope === "self" ? "page" : undefined}
            className={`min-w-[90px] rounded-lg px-4 py-2 text-center text-[11px] font-bold ${filters.scope === "self" ? "bg-[#17365D] text-white" : "text-[#52627B] hover:bg-white"}`}>Self</Link>
          <Link prefetch={false} href={linkFor({scope:"all",page:"1",activity:""})} aria-current={filters.scope === "all" ? "page" : undefined}
            className={`min-w-[90px] rounded-lg px-4 py-2 text-center text-[11px] font-bold ${filters.scope === "all" ? "bg-[#17365D] text-white" : "text-[#52627B] hover:bg-white"}`}>All</Link>
        </nav>
        <form action="/reports/daily" method="get" className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(160px,180px)_minmax(175px,200px)_minmax(180px,1fr)_auto_auto] xl:items-end">
          <input type="hidden" name="scope" value={filters.scope}/>
          {isSelf ? (
            <div className="space-y-1">
              <label htmlFor="self-history-period" className="block text-[9px] font-bold uppercase tracking-wide text-[#60718A]">History Period</label>
              <select id="self-history-period" name="period" defaultValue={query.period === "day" ? "day" : "all"} className={inputClass}>
                <option value="all">All History</option>
                <option value="day">Selected Date</option>
              </select>
            </div>
          ) : null}
          <label className="block space-y-1 text-[9px] font-bold uppercase tracking-wide text-[#60718A]">Date
            <input className={inputClass} name="date" type="date" defaultValue={filters.date} required={!isSelf || query.period === "day"}/>
          </label>
          {!isSelf ? <label className="block space-y-1 text-[9px] font-bold uppercase tracking-wide text-[#60718A]">Activity Type
            <select name="type" defaultValue={filters.type} className={inputClass}>
              {DAILY_ACTIVITY_GROUPS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label> : null}
          {!isSelf ? <label className="block space-y-1 text-[9px] font-bold uppercase tracking-wide text-[#60718A]">Employee Search
            <input name="employee" type="search" maxLength={80} defaultValue={filters.scope === "all" ? filters.employee : ""}
              placeholder="Employee name or code" className={inputClass}/>
          </label> : null}
          <button type="submit" className="h-9 rounded-lg bg-[#17558E] px-5 text-[11px] font-bold text-white hover:bg-[#17456E]">Apply</button>
          <Link prefetch={false} href="/reports/daily" className="flex h-9 items-center justify-center rounded-lg border border-[#D5DEEA] px-4 text-[11px] font-semibold text-[#435775]">Reset</Link>
        </form>
      </section>
      {isSelf && selfHistory && !error ? (
        <DailySelfActivityPanel data={selfHistory} linkFor={linkFor}/>
      ) : !isSelf || error ? <section className="overflow-hidden rounded-xl border border-[#dce4ef] bg-white shadow-sm" aria-label="Daily activity register">
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
                  const occurredAt = new Date(row.occurredAt);
                  const date = formatDate.format(occurredAt);
                  const time = formatTime.format(occurredAt);
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
        {!error && payload?.truncated ? (
          <p role="status" className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-[10px] font-semibold text-amber-900">
            This day exceeds the safe report pagination limit. Earlier activities may not be shown. Use a narrower employee or activity filter to see additional entries.
          </p>
        ) : null}
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
      </section> : null}
      <p className="px-1 text-[10px] leading-5 text-[#7B8799]">
        Reports show existing recorded events and attributable creation/finalization history. Some older events, unlogged workflow changes, and actions with no verified employee identity may be absent. System records are never attributed to an employee by guesswork.
      </p>
    </div>
  );
}
