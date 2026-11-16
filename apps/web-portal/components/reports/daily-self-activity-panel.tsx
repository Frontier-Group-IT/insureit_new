import Link from "next/link";
import { BarChart3, CarFront, ClipboardCheck, FileCheck2, FilePenLine, FilePlus2, FileText, LayoutGrid, PencilLine, ShieldCheck, UserRoundPen, UserRoundPlus, UsersRound } from "lucide-react";
import type { SelfActivity } from "@/lib/reports/daily-self-activity";
import { DailyActivityHistoryRows } from "@/components/reports/daily-activity-history-rows";
import type { DailyActivityQuery } from "@/lib/reports/daily-activity";

type Data = {
  selfName:string;employeeCode:string;categories:{name:string;count:number}[];category:string;rows:SelfActivity[];
  page:number;hasNext:boolean;total:number;selectedCount:number;partial:boolean;day:string;
  unavailableSources:string[];allSourcesUnavailable:boolean;
};
type Props = {data:Data;linkFor:(updates:Partial<DailyActivityQuery>)=>string; reportMode?:"self"|"employee"};

function activityIcon(name:string) {
  if(name==="Customer Add")return UserRoundPlus;
  if(name==="Customer Edit")return UserRoundPen;
  if(name.startsWith("Customer"))return UsersRound;
  if(name==="Vehicle Add")return CarFront;
  if(name==="Vehicle Edit")return PencilLine;
  if(name.startsWith("Vehicle"))return CarFront;
  if(name==="Policy Intake")return FilePlus2;
  if(name==="Policy Add")return FileText;
  if(name==="Policy Edit")return FilePenLine;
  if(name.startsWith("Policy"))return FileCheck2;
  if(name.startsWith("Claim"))return ClipboardCheck;
  return LayoutGrid;
}


export function DailySelfActivityPanel({data,linkFor,reportMode="self"}:Props) {
  // Keep each activity family together instead of mixing Customer, Vehicle,
  // Policy and Claims cards within a single five-column row.
  const isCustomerActivity=data.category.startsWith("Customer ");
  const categoryGroups=[
    {name:"Customer", items:data.categories.filter(item=>item.name.startsWith("Customer "))},
    {name:"Vehicle", items:data.categories.filter(item=>item.name.startsWith("Vehicle "))},
    {name:"Policies", items:data.categories.filter(item=>item.name.startsWith("Policy "))},
    {name:"Claims", items:data.categories.filter(item=>item.name==="Claims"||item.name.startsWith("Claim "))},
    {name:"Other", items:data.categories.filter(item=>!item.name.startsWith("Customer ")&&!item.name.startsWith("Vehicle ")&&!item.name.startsWith("Policy ")&&item.name!=="Claims"&&!item.name.startsWith("Claim "))},
  ].filter(group=>group.items.length>0);
  return (
    <section className="daily-report-panel min-h-[calc(100dvh-300px)] overflow-hidden rounded-xl border border-[#dce4ef] bg-white shadow-sm" aria-label="Self activity summary and register">
      <div className="daily-report-panel-title flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e9f1] px-4 py-3">
        <div>
          <h3 className="flex items-center gap-2 text-[12px] font-bold text-[#17365D]"><BarChart3 size={19} strokeWidth={2.1} aria-hidden="true"/>
            {data.category ? `${data.category} (${data.selfName})` : (reportMode==="self" ? "My Activity Summary" : `${data.selfName} — Activity Summary`)}
          </h3>
        </div>
        {data.category ? <Link prefetch={false} href={linkFor({activity:"",page:"1"})}
          className="rounded-lg border border-[#d8e1ec] bg-white px-3 py-2 text-[10px] font-bold text-[#174b80]">
          Back to summary
        </Link> : <span className="daily-report-total-badge inline-flex items-center gap-2 text-[10px] font-semibold text-[#506483]"><FileText size={16} strokeWidth={2.4} aria-hidden="true"/>{data.total.toLocaleString("en-IN")} recorded activities</span>}
      </div>
      {data.partial ? (
        <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[10px] text-amber-900">
          {data.unavailableSources.length ? (
            <>
              {data.allSourcesUnavailable
                ? "Activity history is temporarily unavailable. Please retry. No records were changed."
                : "Some activity sources are temporarily unavailable."}
              {" "}Unavailable: {data.unavailableSources.join(", ")}. Counts may be incomplete.
            </>
          ) : (
            <>Historical activity exceeds the safe read limit. These counts may be incomplete; use the selected-day filter to narrow the report.</>
          )}
        </div>
      ) : null}
      {!data.category ? (
        data.categories.length ? (
          <div className="daily-report-groups space-y-4 p-3">
            {categoryGroups.map(group=>(
              <section key={group.name} data-activity-group={group.name.toLowerCase()} className="daily-report-category" aria-label={`${group.name} activities`}>
                <h4 className="daily-report-category-heading mb-2 px-1 text-[10px] font-bold uppercase tracking-wide text-[#61748E]">{group.name==="Claims"?"Claim":group.name}</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {group.items.map(item=>(
              <Link key={item.name} prefetch={false} href={linkFor({activity:item.name,page:"1"})}
                className="daily-report-activity-card group flex min-h-[54px] min-w-0 items-center justify-between gap-2 rounded-xl border border-[#dce5f1] bg-gradient-to-br from-white to-[#f7faff] px-3 py-2.5 shadow-[0_1px_3px_rgba(23,54,93,0.05)] transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#7ba7dc] hover:from-[#f5f9ff] hover:to-[#e9f2ff] hover:shadow-[0_5px_14px_rgba(23,54,93,0.13)] active:translate-y-0 active:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315b9a] motion-reduce:transform-none motion-reduce:transition-none">
                {(() => {const Icon=activityIcon(item.name);return <Icon className="daily-report-activity-icon shrink-0" size={24} strokeWidth={2.4} aria-hidden="true"/>;})()}
                <span className="min-w-0 flex-1 text-[11px] font-semibold leading-4 text-[#234368] transition-colors duration-200 group-hover:text-[#123c70]">{item.name}</span>
                <span className="daily-report-count-badge shrink-0 px-1 text-center text-[12px] font-extrabold tabular-nums">{item.count.toLocaleString("en-IN")}</span>
              </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : <p className="px-5 py-10 text-center text-[11px] text-[#718096]">No attributable recorded activity for the selected period.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f7f9fc] text-[9px] font-bold uppercase tracking-wide text-[#64748b]">
                <tr><th className="px-4 py-3">Activity</th>
                  {isCustomerActivity ? (
                    <>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Customer Type</th>
                      <th className="px-3 py-3">Mobile</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-3">Policy / Case No.</th>
                      <th className="px-3 py-3">Customer / Vehicle</th>
                      <th className="px-3 py-3">Insurance Company</th>
                    </>
                  )}
                  <th className="whitespace-nowrap px-3 py-3">Date &amp; Time</th>
                  <th className="px-3 py-3">Status</th></tr>
              </thead>
              <DailyActivityHistoryRows rows={data.rows} isCustomerActivity={isCustomerActivity} />
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#e4e9f1] px-4 py-3 text-[10px] text-[#66758b]">
            <span>Page {data.page} · 30 per page</span>
            <div className="flex gap-2">
              <Link prefetch={false} aria-disabled={data.page<=1} href={data.page<=1?"#":linkFor({page:String(data.page-1)})}
                className={`rounded-lg border px-3 py-1.5 font-bold ${data.page<=1?"pointer-events-none opacity-40":"hover:bg-[#f5f8fc]"}`}>Previous</Link>
              <Link prefetch={false} aria-disabled={!data.hasNext} href={!data.hasNext?"#":linkFor({page:String(data.page+1)})}
                className={`rounded-lg border px-3 py-1.5 font-bold ${!data.hasNext?"pointer-events-none opacity-40":"hover:bg-[#f5f8fc]"}`}>Next</Link>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
