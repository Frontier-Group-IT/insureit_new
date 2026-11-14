import Link from "next/link";
import { DailySelfActivityPanel } from "@/components/reports/daily-self-activity-panel";
import { DailyEmployeeDirectory } from "@/components/reports/daily-employee-directory";
import { loadDailyReportEmployeeDirectory, assertDailyReportEmployeeAllowed } from "@/lib/reports/daily-employee-directory";
import { loadSelfActivityHistory } from "@/lib/reports/daily-self-activity";
import { requireCapability } from "@/lib/master-data-server";
import {
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
  let selfHistory: Awaited<ReturnType<typeof loadSelfActivityHistory>> | null = null;
  let employeeDirectory: Awaited<ReturnType<typeof loadDailyReportEmployeeDirectory>> | null = null;
  const chosenPerson = !isSelf ? (query.person ?? "") : "";
  let error = false;
  try {
    if (isSelf) {
      selfHistory = await loadSelfActivityHistory(profile.id, {
        day: query.period === "day" ? query.date : undefined,
        category: query.activity, page: query.page,
      });
    } else {
      employeeDirectory = await loadDailyReportEmployeeDirectory(profile);
      if (chosenPerson) {
        assertDailyReportEmployeeAllowed(chosenPerson, employeeDirectory);
        selfHistory = await loadSelfActivityHistory(chosenPerson, {
          day: query.period === "day" ? query.date : undefined,
          category: query.activity, page:query.page,
        });
      }
    }
  } catch (caught) {
    console.error("[daily-report] read-only report load failed", caught instanceof Error ? caught.message : "Unknown error");
    error = true;
  }
  const filters = {
    scope: query.scope === "all" ? "all" : "self" as const,
    type: "all",
    date: query.date ?? "",
    employee: query.employee ?? "",
    page: 1,
  };
  const linkFor = (updates: Partial<DailyActivityQuery>) => {
    const params = new URLSearchParams({
      scope: filters.scope, type: filters.type, date: filters.date,
      ...((isSelf || chosenPerson) ? {period: query.period === "day" ? "day" : "all",activity:query.activity??""} : {}),
      ...(chosenPerson ? {person:chosenPerson} : {}),
      ...(filters.scope === "all" && filters.employee ? {employee:filters.employee} : {}),
      ...updates,
    });
    return `/reports/daily?${params.toString()}`;
  };
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
          <Link prefetch={false} href={linkFor({scope:"self",page:"1",employee:"",activity:"",period:"all",person:""})} aria-current={filters.scope === "self" ? "page" : undefined}
            className={`min-w-[90px] rounded-lg px-4 py-2 text-center text-[11px] font-bold ${filters.scope === "self" ? "bg-[#17365D] text-white" : "text-[#52627B] hover:bg-white"}`}>Self</Link>
          <Link prefetch={false} href={linkFor({scope:"all",page:"1",activity:"",employee:"",person:"",period:"all"})} aria-current={filters.scope === "all" ? "page" : undefined}
            className={`min-w-[90px] rounded-lg px-4 py-2 text-center text-[11px] font-bold ${filters.scope === "all" ? "bg-[#17365D] text-white" : "text-[#52627B] hover:bg-white"}`}>All</Link>
        </nav>
        <form action="/reports/daily" method="get" className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(160px,180px)_minmax(175px,200px)_minmax(180px,1fr)_auto_auto] xl:items-end">
          <input type="hidden" name="scope" value={filters.scope}/>
          {chosenPerson ? <input type="hidden" name="person" value={chosenPerson}/> : null}
          {chosenPerson && query.activity ? <input type="hidden" name="activity" value={query.activity}/> : null}
          {(isSelf || chosenPerson) ? (
            <div className="space-y-1">
              <label htmlFor="self-history-period" className="block text-[9px] font-bold uppercase tracking-wide text-[#60718A]">History Period</label>
              <select id="self-history-period" name="period" defaultValue={query.period === "day" ? "day" : "all"} className={inputClass}>
                <option value="all">All History</option>
                <option value="day">Selected Date</option>
              </select>
            </div>
          ) : null}
          {(isSelf || chosenPerson) ? <label className="block space-y-1 text-[9px] font-bold uppercase tracking-wide text-[#60718A]">Date
            <input className={inputClass} name="date" type="date" defaultValue={query.period !== "day" ? "" : filters.date} required={query.period === "day"}/>
          </label> : null}

          {!isSelf && !chosenPerson ? <label className="block space-y-1 text-[9px] font-bold uppercase tracking-wide text-[#60718A]">Employee Search
            <input name="employee" type="search" maxLength={80} defaultValue={filters.scope === "all" ? filters.employee : ""}
              placeholder="Employee name or code" className={inputClass}/>
          </label> : null}
          <button type="submit" className="h-9 rounded-lg bg-[#17558E] px-5 text-[11px] font-bold text-white hover:bg-[#17456E]">Apply</button>
          <Link prefetch={false} href="/reports/daily" className="flex h-9 items-center justify-center rounded-lg border border-[#D5DEEA] px-4 text-[11px] font-semibold text-[#435775]">Reset</Link>
        </form>
      </section>
      {(isSelf || chosenPerson) && selfHistory && !error ? (
        <DailySelfActivityPanel data={selfHistory} linkFor={linkFor}
          reportMode={isSelf ? "self" : "employee"}
          backToEmployees={isSelf ? undefined : linkFor({scope:"all",person:"",activity:"",period:"all",page:"1"})}/>
      ) : !isSelf && !chosenPerson && employeeDirectory && !error ? (
        <DailyEmployeeDirectory people={employeeDirectory.people} search={query.employee??""} linkFor={linkFor}/>
      ) : error ? (
        <section role="alert" className="rounded-xl border border-red-200 bg-white px-5 py-8 text-center text-[11px] font-semibold text-red-700">
          The authorized employee report could not be loaded. No records were changed.
        </section>
      ) : null}
      <p className="px-1 text-[10px] leading-5 text-[#7B8799]">
        Reports show existing recorded events and attributable creation/finalization history. Some older events, unlogged workflow changes, and actions with no verified employee identity may be absent. System records are never attributed to an employee by guesswork.
      </p>
    </div>
  );
}
