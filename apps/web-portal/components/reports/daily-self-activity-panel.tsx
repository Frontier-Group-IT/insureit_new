import Link from "next/link";
import { BarChart3, CarFront, ClipboardCheck, FileCheck2, FilePenLine, FilePlus2, FileText, LayoutGrid, PencilLine, ShieldCheck, UserRoundPen, UserRoundPlus, UsersRound } from "lucide-react";
import type { SelfActivity } from "@/lib/reports/daily-self-activity";
import { DailyActivityHistoryRows } from "@/components/reports/daily-activity-history-rows";
import { DailyReportHeaderScopes, DailyReportHeaderPeriod } from "@/components/reports/daily-report-header-controls";
import type { DailyActivityQuery } from "@/lib/reports/daily-activity";

type Data = {
  selfName:string;employeeCode:string;categories:{name:string;count:number}[];category:string;rows:SelfActivity[];
  page:number;hasNext:boolean;total:number;selectedCount:number;partial:boolean;day:string;
  unavailableSources:string[];allSourcesUnavailable:boolean;
};
type Props = {data:Data;linkFor:(updates:Partial<DailyActivityQuery>)=>string; reportMode?:"self"|"employee"; canViewAll?:boolean};

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


function DailyReportEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center" role="status">
      <svg width="236" height="150" viewBox="0 0 236 150" fill="none" aria-hidden="true" className="mb-1 max-w-full">
        <ellipse cx="116" cy="132" rx="93" ry="7" fill="#E6F0FA"/>
        <circle cx="58" cy="62" r="31" fill="#E8F2FF"/>
        <circle cx="183" cy="70" r="39" fill="#ECF6FF"/>
        <path d="M34 89V79M29 84h10M202 34v-6M199 31h6" stroke="#B6D5F5" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="203" cy="34" r="2" fill="#B9D9FA"/>
        <circle cx="32" cy="108" r="2" fill="#B9D9FA"/>
        <rect x="80" y="15" width="96" height="112" rx="10" fill="white" stroke="#B3D4F6" strokeWidth="2"/>
        <rect x="108" y="10" width="41" height="13" rx="5" fill="#4598E4"/>
        <rect x="112" y="13" width="33" height="4" rx="2" fill="#9ACCF4"/>
        <path d="m98 46 5 5 8-10m-13 29 5 5 8-10" stroke="#20B6BF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M120 46h40M120 53h30M120 70h40M120 77h26M98 97h59" stroke="#A9C9ED" strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M106 102h40a5 5 0 0 1 5 5v8h-50v-8a5 5 0 0 1 5-5Z" fill="#DEEDFF"/>
        <path d="M115 103h20l5 9h-30l5-9Z" fill="#6AB7EE"/>
        <circle cx="114" cy="115" r="5" fill="#287DD0"/><circle cx="139" cy="115" r="5" fill="#287DD0"/>
        <path d="M62 47 79 40l17 7v19c0 14-9 23-17 27-9-5-17-14-17-27V47Z" fill="#39BFCB" stroke="white" strokeWidth="3"/>
        <path d="m70 65 7 7 12-16" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="172" cy="92" r="21" stroke="#3C91D7" strokeWidth="4" fill="white" fillOpacity=".88"/>
        <path d="m186 107 17 17" stroke="#2874C3" strokeWidth="6" strokeLinecap="round"/>
        <path d="m163 92 7 7 12-17" stroke="#35BDD0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <h4 className="text-[16px] font-bold text-[#17365D]">No activities yet</h4>
      <p className="mt-1 text-[12px] text-[#8193B0]">Your activities will appear here once they are recorded.</p>
    </div>
  );
}

export function DailySelfActivityPanel({data,linkFor,reportMode="self",canViewAll=false}:Props) {
  // Keep each activity family together instead of mixing Customer, Vehicle,
  // Policy and Claims cards within a single five-column row.
  const isCustomerActivity=data.category.startsWith("Customer ");
  const isClaimActivity=data.category==="Claims"||data.category.startsWith("Claim ");
  const vehicleMode=data.category.startsWith("Vehicle ");
  const isOtherActivity=data.category==="Other Activities";
  const gridColumnsFor=(count:number)=>count>=5?"xl:grid-cols-5":count===4?"xl:grid-cols-4":count===3?"xl:grid-cols-3":count===2?"xl:grid-cols-2":"xl:grid-cols-1";
  const categoryGroups=[
    {name:"Customer", items:data.categories.filter(item=>item.name.startsWith("Customer "))},
    {name:"Vehicle", items:data.categories.filter(item=>item.name.startsWith("Vehicle "))},
    {name:"Policies", items:data.categories.filter(item=>item.name.startsWith("Policy "))},
    {name:"Claims", items:data.categories.filter(item=>item.name==="Claims"||item.name.startsWith("Claim "))},
    {name:"Other", items:data.categories.filter(item=>!item.name.startsWith("Customer ")&&!item.name.startsWith("Vehicle ")&&!item.name.startsWith("Policy ")&&item.name!=="Claims"&&!item.name.startsWith("Claim "))},
  ].filter(group=>group.items.length>0);
  return (
    <section className="daily-report-panel flex min-h-[calc(100dvh-175px)] w-full flex-col overflow-hidden rounded-xl border border-[#dce4ef] bg-white shadow-sm md:min-h-[calc(100dvh-135px)]" aria-label="Self activity summary and register">
      <div className="daily-report-panel-title flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e4e9f1] px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h3 className="flex items-center gap-2 text-[12px] font-bold text-[#17365D]"><BarChart3 size={19} strokeWidth={2.1} aria-hidden="true"/>
            {data.category ? `${data.category} (${data.selfName})` : (reportMode==="self" ? "My Activity Summary" : "Activity Summary")}
          </h3>
          <DailyReportHeaderScopes canViewAll={canViewAll} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data.category ? <Link prefetch={false} href={linkFor({activity:"",page:"1"})}
            className="rounded-lg border border-[#d8e1ec] bg-white px-3 py-2 text-[10px] font-bold text-[#174b80]">
            Back to summary
          </Link> : <span className="daily-report-total-badge inline-flex shrink-0 items-center gap-2 text-[11px] font-extrabold tracking-wide text-white"><FileText size={16} strokeWidth={2.4} aria-hidden="true"/>{data.total.toLocaleString("en-IN")} RECORDS</span>}
          <DailyReportHeaderPeriod />
        </div>
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
          <div className="daily-report-groups flex-1 space-y-4 p-3">
            {categoryGroups.map(group=>(
              <section key={group.name} data-activity-group={group.name.toLowerCase()} className="daily-report-category" aria-label={`${group.name} activities`}>
                <h4 className="daily-report-category-heading mb-2 px-1 text-[10px] font-bold uppercase tracking-wide text-[#61748E]">{group.name==="Claims"?"Claim":group.name}</h4>
                <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 ${gridColumnsFor(group.items.length)}`}>
                  {group.items.map(item=>(
              <Link key={item.name} prefetch={false} href={linkFor({activity:item.name,page:"1"})}
                className="daily-report-activity-card group flex min-h-[54px] min-w-0 items-center justify-between gap-2 rounded-xl border border-[#dce5f1] bg-white px-3 py-2.5 shadow-[0_1px_3px_rgba(23,54,93,0.05)] transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#7ba7dc] hover:bg-white hover:shadow-[0_5px_14px_rgba(23,54,93,0.13)] active:translate-y-0 active:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315b9a] motion-reduce:transform-none motion-reduce:transition-none">
                {(() => {const Icon=activityIcon(item.name);return <Icon className="daily-report-activity-icon shrink-0" size={24} strokeWidth={2.4} aria-hidden="true"/>;})()}
                <span className="min-w-0 flex-1 text-[11px] font-semibold leading-4 text-[#234368] transition-colors duration-200 group-hover:text-[#123c70]">{item.name}</span>
                <span className="daily-report-count-badge shrink-0 px-1 text-center text-[12px] font-extrabold tabular-nums">{item.count.toLocaleString("en-IN")}</span>
              </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : <div className="flex flex-1 items-center justify-center"><DailyReportEmptyState /></div>
      ) : (
        <>
          <div className={`min-h-0 flex-1 ${data.rows.length ? "overflow-x-auto" : "flex items-center justify-center"}`}>
             {data.rows.length ? <table className="w-full text-left">
              <thead className="bg-[#f7f9fc] text-[10px] font-extrabold uppercase tracking-wide text-[#243752]">
                <tr><th className="px-4 py-3">Activity</th>
                  {isCustomerActivity ? (
                    <>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Customer Type</th>
                      <th className="px-3 py-3">Mobile</th>
                    </>
                  ) : vehicleMode ? (
                    <>
                      <th className="px-3 py-3">Vehicle</th>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Make / model</th>
                      <th className="px-3 py-3">Registration</th>
                    </>
                  ) : isClaimActivity ? (
                    <>
                      <th className="px-3 py-3">Control No.</th>
                      
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Vehicle No.</th>
                    </>
                  ) : isOtherActivity ? (
                    <th className="px-3 py-3">Employee Name</th>
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
              <DailyActivityHistoryRows rows={data.rows} isCustomerActivity={isCustomerActivity} isClaimActivity={isClaimActivity} vehicleMode={vehicleMode} isOtherActivity={isOtherActivity} />
            </table> : <DailyReportEmptyState />}
          </div>
          <div className="mt-auto flex shrink-0 items-center justify-between border-t border-[#e4e9f1] px-4 py-3 text-[10px] text-[#66758b]">
            <span>Page {data.page} · 30 per page</span>
            <div className="flex gap-2">
              <Link prefetch={false} aria-disabled={data.page<=1} href={data.page<=1?"#":linkFor({page:String(data.page-1)})}
                className={`rounded-lg border px-3 py-1.5 font-bold ${data.page<=1?"pointer-events-none border-[#dae1eb] bg-[#f0f3f8] text-[#263b57]":"border-[#9eaec3] bg-white text-[#102846] hover:bg-[#e9eff7]"}`}>Previous</Link>
              <Link prefetch={false} aria-disabled={!data.hasNext} href={!data.hasNext?"#":linkFor({page:String(data.page+1)})}
                className={`rounded-lg border px-3 py-1.5 font-bold ${!data.hasNext?"pointer-events-none border-[#dae1eb] bg-[#f0f3f8] text-[#263b57]":"border-[#9eaec3] bg-white text-[#102846] hover:bg-[#e9eff7]"}`}>Next</Link>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
