import Link from "next/link";
import { DailySelfActivityPanel } from "@/components/reports/daily-self-activity-panel";
import { DailyEmployeeDirectory } from "@/components/reports/daily-employee-directory";
import { DailyReportQuickFilters } from "@/components/reports/daily-report-quick-filters";
import { loadDailyReportEmployeeDirectory, assertDailyReportEmployeeAllowed } from "@/lib/reports/daily-employee-directory";
import { loadSelfActivityHistory } from "@/lib/reports/daily-self-activity";
import { requireCapability } from "@/lib/master-data-server";
import {
  type DailyActivityQuery,
} from "@/lib/reports/daily-activity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<DailyActivityQuery> };

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
        <nav aria-label="Daily Report visibility" className="flex w-fit gap-1 rounded-xl border border-[#d9e4f2] bg-[#F6F9FE] p-1">
          <Link prefetch={false} href={linkFor({scope:"self",page:"1",employee:"",activity:"",period:"all",person:""})} aria-current={filters.scope === "self" ? "page" : undefined}
            className={`min-w-[90px] rounded-lg px-4 py-2 text-center text-[11px] font-bold ${filters.scope === "self" ? "bg-[#17365D] text-white" : "text-[#52627B] hover:bg-white"}`}>Self</Link>
          <Link prefetch={false} href={linkFor({scope:"all",page:"1",activity:"",employee:"",person:"",period:"all"})} aria-current={filters.scope === "all" ? "page" : undefined}
            className={`min-w-[90px] rounded-lg px-4 py-2 text-center text-[11px] font-bold ${filters.scope === "all" ? "bg-[#17365D] text-white" : "text-[#52627B] hover:bg-white"}`}>All</Link>
        </nav>
        <div className="mt-3">
          <DailyReportQuickFilters
            mode={isSelf ? "self" : chosenPerson ? "employee" : "directory"}
            date={query.period === "day" ? filters.date : ""}
            employeeSearch={filters.employee}
          />
        </div>
      </section>
      {(isSelf || chosenPerson) && selfHistory && !error ? (
        <DailySelfActivityPanel data={selfHistory} linkFor={linkFor}
          reportMode={isSelf ? "self" : "employee"}/>
      ) : !isSelf && !chosenPerson && employeeDirectory && !error ? (
        <DailyEmployeeDirectory people={employeeDirectory.people} search={query.employee??""} linkFor={linkFor}/>
      ) : error ? (
        <section role="alert" className="rounded-xl border border-red-200 bg-white px-5 py-8 text-center text-[11px] font-semibold text-red-700">
          The authorized employee report could not be loaded. No records were changed.
        </section>
      ) : null}
    </div>
  );
}
