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
              className="group flex min-h-[54px] min-w-0 flex-col justify-center gap-1 rounded-xl border border-[#dce5f1] bg-gradient-to-br from-white to-[#f7faff] px-3 py-2.5 shadow-[0_1px_3px_rgba(23,54,93,0.05)] transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#7ba7dc] hover:from-[#f5f9ff] hover:to-[#e9f2ff] hover:shadow-[0_5px_14px_rgba(23,54,93,0.13)] active:translate-y-0 active:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315b9a] motion-reduce:transform-none motion-reduce:transition-none">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-[#234368] transition-colors duration-200 group-hover:text-[#123c70]" title={p.full_name||"Unnamed employee"}>{p.full_name||"Unnamed employee"}</p>
                {p.employee_code?<p className="mt-0.5 text-[9px] text-[#8794a6]">{p.employee_code}</p>:null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="px-5 py-10 text-center text-[11px] text-[#718096]">No authorized employees match your search.</p>
      )}
    </section>
  );
}
