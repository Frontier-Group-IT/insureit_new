import { DailySelfActivityPanel } from "@/components/reports/daily-self-activity-panel";
import { DailyEmployeeDirectory } from "@/components/reports/daily-employee-directory";
import { loadDailyReportEmployeeDirectory, assertDailyReportEmployeeAllowed } from "@/lib/reports/daily-employee-directory";
import { loadSelfActivityHistory } from "@/lib/reports/daily-self-activity";
import { requireCapability } from "@/lib/master-data-server";
import { resolveDailyReportPeriod } from "@/lib/reports/daily-report-period";
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
  const periodRange = resolveDailyReportPeriod(query);
  let selfHistory: Awaited<ReturnType<typeof loadSelfActivityHistory>> | null = null;
  let employeeDirectory: Awaited<ReturnType<typeof loadDailyReportEmployeeDirectory>> | null = null;
  const chosenPerson = !isSelf ? (query.person ?? "") : "";
  let error = false;
  try {
    if (!periodRange.valid) throw new Error("Invalid requested reporting date range");
    if (isSelf) {
      selfHistory = await loadSelfActivityHistory(profile.id, {
        day: query.period === "day" ? query.date : undefined,
        from: periodRange.from, to: periodRange.to,
        category: query.activity, page: query.page,
      });
    } else {
      employeeDirectory = await loadDailyReportEmployeeDirectory(profile);
      if (chosenPerson) {
        assertDailyReportEmployeeAllowed(chosenPerson, employeeDirectory);
        selfHistory = await loadSelfActivityHistory(chosenPerson, {
          day: query.period === "day" ? query.date : undefined,
          from: periodRange.from, to: periodRange.to,
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
      period: periodRange.period,
      ...(periodRange.period === "custom" ? {from:periodRange.from ?? "",to:periodRange.to ?? ""} : {}),
      ...(isSelf || chosenPerson ? {activity:query.activity??""} : {}),
      ...(chosenPerson ? {person:chosenPerson} : {}),
      ...(filters.scope === "all" && filters.employee ? {employee:filters.employee} : {}),
      ...updates,
    });
    return `/reports/daily?${params.toString()}`;
  };
  return (
    <div className="space-y-3">
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
