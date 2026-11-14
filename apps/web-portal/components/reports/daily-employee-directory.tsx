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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e9f1] px-4 py-3">
        <div>
          <h3 className="text-[12px] font-bold text-[#17365D]">Employee Activity Reports</h3>
          <p className="mt-1 text-[10px] text-[#718096]">Select an authorized employee to view their activity summary and history</p>
        </div>
        <div className="flex items-center gap-3">
          <DailyReportQuickFilters mode="directory" date="" employeeSearch={search}/>
          <span className="whitespace-nowrap text-[10px] font-semibold text-[#506483]">{filtered.length} employees</span>
        </div>
      </div>
      {filtered.length ? (
        <div className="divide-y divide-[#edf1f6]">
          {filtered.map(p=>(
            <Link key={p.id} prefetch={false}
              href={linkFor({scope:"all",person:p.id,employee:"",activity:"",page:"1",period:"all"})}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#f6f9fd]">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-[#2f4360]">{p.full_name||"Unnamed employee"}</p>
                {p.employee_code?<p className="mt-0.5 text-[9px] text-[#8794a6]">{p.employee_code}</p>:null}
              </div>
              <span className="flex items-center gap-2 text-[10px] font-semibold text-[#35618e]">View history <span aria-hidden="true">›</span></span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="px-5 py-10 text-center text-[11px] text-[#718096]">No authorized employees match your search.</p>
      )}
    </section>
  );
}
