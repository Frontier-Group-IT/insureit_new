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
  // Subtle, consistent family accents make activity groups recognizable at a glance.
  // Keep complete Tailwind utility names so the production CSS build includes them.
  const familyStyles:Record<string,{card:string;label:string;count:string;heading:string}>={
    Customer:{
      card:"border-[#cee0f7] border-l-[#3979ce] bg-gradient-to-br from-white to-[#edf5ff] hover:border-[#7ba7dc] hover:to-[#dcecff]",
      label:"text-[#20548c]",count:"border-[#c4daf5] bg-[#e3efff] text-[#174b87] group-hover:bg-[#d2e5ff]",heading:"text-[#2b65ac]",
    },
    Vehicle:{
      card:"border-[#c8e7e3] border-l-[#159589] bg-gradient-to-br from-white to-[#ecfaf6] hover:border-[#75c9bc] hover:to-[#d9f5ed]",
      label:"text-[#14665f]",count:"border-[#b4e3db] bg-[#ddf6ef] text-[#12665d] group-hover:bg-[#c7efe4]",heading:"text-[#188579]",
    },
    Policies:{
      card:"border-[#ded6f6] border-l-[#7461c9] bg-gradient-to-br from-white to-[#f3f0ff] hover:border-[#b2a4ea] hover:to-[#e9e3ff]",
      label:"text-[#514394]",count:"border-[#d8cdf5] bg-[#ece7ff] text-[#57469f] group-hover:bg-[#ded5ff]",heading:"text-[#6d56b2]",
    },
    Claims:{
      card:"border-[#f4dccb] border-l-[#d38a48] bg-gradient-to-br from-white to-[#fff6ed] hover:border-[#e3b17e] hover:to-[#ffecd8]",
      label:"text-[#8d5829]",count:"border-[#f2d6ba] bg-[#fff0df] text-[#925822] group-hover:bg-[#ffe2c1]",heading:"text-[#b97636]",
    },
    Other:{
      card:"border-[#d7e1eb] border-l-[#63839d] bg-gradient-to-br from-white to-[#f2f6fa] hover:border-[#9eb4c9] hover:to-[#e7eff6]",
      label:"text-[#48657e]",count:"border-[#d2dfeb] bg-[#e8f0f7] text-[#3d5b76] group-hover:bg-[#dce9f4]",heading:"text-[#667f98]",
    },
  };
  return (
    <section className="min-h-[calc(100dvh-300px)] overflow-hidden rounded-xl border border-[#dce4ef] bg-white shadow-sm" aria-label="Self activity summary and register">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e9f1] px-4 py-3">
        <div>
          <h3 className="text-[12px] font-bold text-[#17365D]">
            {data.category ? `${data.category} (${data.selfName})` : (reportMode==="self" ? "My Activity Summary" : `${data.selfName} — Activity Summary`)}
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
                <h4 className={`mb-2 px-1 text-[10px] font-bold uppercase tracking-wide ${familyStyles[group.name].heading}`}>{group.name}</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {group.items.map(item=>(
              <Link key={item.name} prefetch={false} href={linkFor({activity:item.name,page:"1"})}
                className={`group flex min-h-[54px] min-w-0 items-center justify-between gap-2 rounded-xl border border-l-[3px] px-3 py-2.5 shadow-[0_1px_3px_rgba(23,54,93,0.05)] transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_5px_14px_rgba(23,54,93,0.13)] active:translate-y-0 active:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315b9a] motion-reduce:transform-none motion-reduce:transition-none ${familyStyles[group.name].card}`}>
                <span className={`min-w-0 text-[11px] font-semibold leading-4 transition-colors duration-200 ${familyStyles[group.name].label}`}>{item.name}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className={`min-w-[32px] rounded-lg border px-2 py-1 text-center text-[12px] font-bold tabular-nums transition-colors duration-200 ${familyStyles[group.name].count}`}>{item.count.toLocaleString("en-IN")}</span>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f7f9fc] text-[9px] font-bold uppercase tracking-wide text-[#64748b]">
                <tr><th className="px-4 py-3">Activity</th>
                  <th className="px-3 py-3">Policy / Case No.</th>
                  <th className="px-3 py-3">Customer / Vehicle</th>
                  <th className="px-3 py-3">Insurance Company</th>
                  <th className="whitespace-nowrap px-3 py-3">Date &amp; Time</th>
                  <th className="px-3 py-3">Status</th></tr>
              </thead>
              <DailyActivityHistoryRows rows={data.rows} />
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
