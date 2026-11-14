import Link from "next/link";
import { DailyReportQuickFilters } from "@/components/reports/daily-report-quick-filters";
import type { DailyActivityQuery } from "@/lib/reports/daily-activity";
import type { ReportEmployee } from "@/lib/reports/daily-employee-directory";

type Props = {
  people:ReportEmployee[];
  search:string;
  linkFor:(updates:Partial<DailyActivityQuery>)=>string;
};
export function DailyEmployeeDirectory({people,search,linkFor}:Props) {
  const term=search.trim().toLocaleLowerCase("en-IN");
  const filtered=people.filter(p=>!term ||
    (p.full_name??"").toLocaleLowerCase("en-IN").includes(term) ||
    (p.employee_code??"").toLocaleLowerCase("en-IN").includes(term));
  return (
    <section className="overflow-hidden rounded-xl border border-[#dce4ef] bg-white shadow-sm" aria-label="Authorized employee list">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e4e9f1] px-4 py-3">
        <h3 className="shrink-0 text-[12px] font-bold text-[#17365D]">Employee Activity Reports</h3>
        <div className="w-full sm:w-[260px] lg:w-[340px]">
          <DailyReportQuickFilters mode="directory" date="" employeeSearch={search}/>
        </div>
        <span className="ml-auto whitespace-nowrap text-[10px] font-semibold text-[#506483]">{filtered.length} employees</span>
      </div>
      {filtered.length ? (
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {filtered.map(p=>(
            <Link key={p.id} prefetch={false}
              href={linkFor({scope:"all",person:p.id,employee:"",activity:"",page:"1"})}
              className="flex min-w-0 flex-col justify-between gap-2 rounded-lg border border-[#e4e9f1] bg-white px-3 py-3 hover:border-[#b6cbe5] hover:bg-[#f6f9fd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5275AA]">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-[#2f4360]" title={p.full_name||"Unnamed employee"}>{p.full_name||"Unnamed employee"}</p>
                {p.employee_code?<p className="mt-0.5 text-[9px] text-[#8794a6]">{p.employee_code}</p>:null}
              </div>
              <span className="flex items-center justify-between text-[10px] font-semibold text-[#35618e]">View history <span aria-hidden="true">›</span></span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="px-5 py-10 text-center text-[11px] text-[#718096]">No authorized employees match your search.</p>
      )}
    </section>
  );
}
