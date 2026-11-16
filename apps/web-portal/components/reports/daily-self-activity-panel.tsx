import Link from "next/link";
import type { SelfActivity } from "@/lib/reports/daily-self-activity";
import { DailyActivityHistoryRows } from "@/components/reports/daily-activity-history-rows";
import type { DailyActivityQuery } from "@/lib/reports/daily-activity";

type Data = {
  selfName:string;employeeCode:string;categories:{name:string;count:number}[];category:string;rows:SelfActivity[];
  page:number;hasNext:boolean;total:number;selectedCount:number;partial:boolean;day:string;
  unavailableSources:string[];allSourcesUnavailable:boolean;
};
type Props = {data:Data;linkFor:(updates:Partial<DailyActivityQuery>)=>string; reportMode?:"self"|"employee"};


export function DailySelfActivityPanel({data,linkFor,reportMode="self"}:Props) {
  // Keep each activity family together instead of mixing Customer, Vehicle,
  // Policy and Claims cards within a single five-column row.
  const categoryGroups=[
    {name:"Customer", items:data.categories.filter(item=>item.name.startsWith("Customer "))},
    {name:"Vehicle", items:data.categories.filter(item=>item.name.startsWith("Vehicle "))},
    {name:"Policies", items:data.categories.filter(item=>item.name.startsWith("Policy "))},
    {name:"Claims", items:data.categories.filter(item=>item.name==="Claims"||item.name.startsWith("Claim "))},
    {name:"Other", items:data.categories.filter(item=>!item.name.startsWith("Customer ")&&!item.name.startsWith("Vehicle ")&&!item.name.startsWith("Policy ")&&item.name!=="Claims"&&!item.name.startsWith("Claim "))},
  ].filter(group=>group.items.length>0);
  return (
    <section className="min-h-[calc(100dvh-300px)] overflow-hidden rounded-xl border border-[#dce4ef] bg-white shadow-sm" aria-label="Self activity summary and register">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e9f1] px-4 py-3">
        <div>
          <h3 className="text-[12px] font-bold text-[#17365D]">
            {data.category || (reportMode==="self" ? "My Activity Summary" : `${data.selfName} — Activity Summary`)}
          </h3>
        </div>
        {data.category ? <Link prefetch={false} href={linkFor({activity:"",page:"1"})}
          className="rounded-lg border border-[#d8e1ec] bg-white px-3 py-2 text-[10px] font-bold text-[#174b80]">
          Back to summary
        </Link> : <span className="text-[10px] font-semibold text-[#506483]">{data.total.toLocaleString("en-IN")} recorded activities</span>}
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
          <div className="space-y-4 p-3">
            {categoryGroups.map(group=>(
              <section key={group.name} aria-label={`${group.name} activities`}>
                <h4 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wide text-[#61748E]">{group.name}</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {group.items.map(item=>(
              <Link key={item.name} prefetch={false} href={linkFor({activity:item.name,page:"1"})}
                className="group flex min-h-[54px] min-w-0 items-center justify-between gap-2 rounded-xl border border-[#dce5f1] bg-gradient-to-br from-white to-[#f7faff] px-3 py-2.5 shadow-[0_1px_3px_rgba(23,54,93,0.05)] transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#7ba7dc] hover:from-[#f5f9ff] hover:to-[#e9f2ff] hover:shadow-[0_5px_14px_rgba(23,54,93,0.13)] active:translate-y-0 active:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315b9a] motion-reduce:transform-none motion-reduce:transition-none">
                <span className="min-w-0 text-[11px] font-semibold leading-4 text-[#234368] transition-colors duration-200 group-hover:text-[#123c70]">{item.name}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="min-w-[32px] rounded-lg border border-[#dce6f3] bg-[#edf3fa] px-2 py-1 text-center text-[12px] font-bold tabular-nums text-[#17365d] transition-colors duration-200 group-hover:border-[#abc9ec] group-hover:bg-[#dcecff]">{item.count.toLocaleString("en-IN")}</span>
                  <span aria-hidden="true" className="text-[14px] font-bold text-[#50719d] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#174b80] motion-reduce:transform-none">›</span>
                </span>
              </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : <p className="px-5 py-10 text-center text-[11px] text-[#718096]">No attributable recorded activity for the selected period.</p>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-[#edf1f6] px-4 py-2 text-[10px] text-[#718096]">
            <span>{data.selectedCount.toLocaleString("en-IN")} {data.category} activities</span>
            <span>{reportMode==="self" ? "Only your records" : `Only ${data.selfName} records`}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-[#f7f9fc] text-[9px] font-bold uppercase tracking-wide text-[#64748b]">
                <tr><th className="px-4 py-3">Employee Name</th><th className="px-3 py-3">Activity Type</th><th className="px-3 py-3">Reference Number</th>
                <th className="px-3 py-3">Date</th><th className="px-3 py-3">Time</th>
                <th className="px-3 py-3">Status</th><th className="px-3 py-3">Source</th></tr>
              </thead>
              <DailyActivityHistoryRows rows={data.rows} employeeName={data.selfName} />
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
