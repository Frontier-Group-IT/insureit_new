import Link from "next/link";
import { AppShell } from "@/components/shell";
import { ReportQueryShortcuts } from "@/components/reports/report-query-shortcuts";
import { ReportApplyButton, ReportEmptyState, ReportFilterField, ReportPageShell, ReportResetLink, reportInputClass } from "@/components/reports/report-page-shell";
import { requireCapability } from "@/lib/master-data-server";
import { loadGovernanceReport, type GovernanceQuery, type GovernanceReport } from "@/lib/reports/governance";

export const dynamic="force-dynamic";
export const revalidate=0;
const PERIODS=[{value:"30d",label:"Last 30 days"},{value:"90d",label:"Last 90 days"},{value:"ytd",label:"Year to date"},{value:"all",label:"All time"}] as const;
type Props={searchParams:Promise<GovernanceQuery>};

export default async function GovernancePage({searchParams}:Props){
 await requireCapability("manage_users"); const query=await searchParams;
 let payload:Awaited<ReturnType<typeof loadGovernanceReport>>|null=null; let loadError=false;
 try{payload=await loadGovernanceReport(query)}catch(error){console.error("[reports] governance report failed",error instanceof Error?error.message:"unknown error");loadError=true}
 const report=payload?.report??emptyReport(); const filters=payload?.filters??{period:"30d" as const,fromDate:null,toDate:null,action:null,page:1};
 const pages=Math.max(1,Math.ceil(report.audit_register.total_count/Math.max(report.audit_register.page_size,1)));
 return <AppShell title="Governance"><ReportPageShell
  title="Audit & Governance"
  loadError={loadError}
  controls={<>
   <ReportQueryShortcuts label="Period" param="period" activeValue={filters.period} options={PERIODS}/>
   <form action="/reports/governance" method="get" className="grid gap-2 md:grid-cols-2 xl:grid-cols-[150px_150px_minmax(220px,1fr)_auto_auto]">
    <input type="hidden" name="period" value="custom"/>
    <ReportFilterField label="From"><input name="from" type="date" defaultValue={filters.fromDate??""} className={reportInputClass}/></ReportFilterField>
    <ReportFilterField label="To"><input name="to" type="date" defaultValue={filters.toDate??""} className={reportInputClass}/></ReportFilterField>
    <ReportFilterField label="Audit action"><select name="action" defaultValue={filters.action??""} className={reportInputClass}><option value="">All actions</option>{report.audit_actions.map(x=><option key={x.action} value={x.action}>{label(x.action)} ({integer(x.event_count)})</option>)}</select></ReportFilterField>
    <ReportApplyButton/>
    <ReportResetLink href="/reports/governance"/>
   </form>
  </>}
 >
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Metric label="Profiles" value={integer(report.summary.profile_count)}/><Metric label="Active" value={integer(report.summary.active_profile_count)}/><Metric label="Inactive" value={integer(report.summary.inactive_profile_count)}/><Metric label="Employee overrides" value={integer(report.summary.active_employee_override_count)}/><Metric label="Permission changes" value={integer(report.summary.permission_change_count)}/><Metric label="Audit events" value={integer(report.summary.audit_event_count)}/></section>
  <section className="grid gap-4 xl:grid-cols-2"><Card title="Role distribution"><SimpleRows rows={report.role_distribution.map(x=>[roleLabel(x.role),integer(x.profile_count)])}/></Card><Card title="Active override mix"><SimpleRows rows={report.override_breakdown.map(x=>[`${label(x.access_level)} · ${label(x.scope_type)}`,integer(x.override_count)])}/></Card></section>
  <section className="portal-card overflow-hidden"><Header title="Active employee overrides"/><Overrides rows={report.active_overrides}/></section>
  <section className="portal-card overflow-hidden"><Header title="Permission changes"/><PermissionChanges rows={report.permission_changes}/></section>
  <section className="portal-card overflow-hidden"><Header title="Audit activity"/><AuditRows rows={report.audit_register.rows}/><Pagination page={report.audit_register.page} pages={pages} total={report.audit_register.total_count} prev={pageHref(filters,Math.max(1,report.audit_register.page-1))} next={pageHref(filters,report.audit_register.page+1)}/></section>
 </ReportPageShell></AppShell>
}

function Metric({label:metricLabel,value}:{label:string;value:string}){return <article className="portal-card px-4 py-4 sm:px-5"><p className="text-[9px] font-black uppercase tracking-[.1em] text-[#7c899b]">{metricLabel}</p><p className="mt-2 text-[23px] font-semibold tracking-[-.03em] text-[#14213c]">{value}</p></article>}
function Card({title,children}:{title:string;children:React.ReactNode}){return <article className="portal-card overflow-hidden"><Header title={title}/>{children}</article>}
function Header({title}:{title:string}){return <div className="border-b border-[#e9edf3] px-5 py-4"><h2 className="text-[14px] font-bold text-[#1b2943]">{title}</h2></div>}
function SimpleRows({rows}:{rows:string[][]}){if(!rows.length)return <Empty/>;return <div className="divide-y divide-[#edf0f4]">{rows.map((x,i)=><div key={`${x[0]}-${i}`} className="flex items-center justify-between px-5 py-3.5 text-[10.5px]"><span className="font-semibold text-[#34445e]">{x[0]}</span><span className="font-bold tabular-nums text-[#1f304d]">{x[1]}</span></div>)}</div>}
function Overrides({rows}:{rows:GovernanceReport["active_overrides"]}){if(!rows.length)return <Empty/>;return <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-[10px]"><thead className="bg-[#f8fafc] text-[#758296]"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Permission</th><th className="px-4 py-3">Access</th><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Expires</th></tr></thead><tbody>{rows.map(x=><tr key={x.id} className="border-t border-[#edf0f4]"><td className="px-4 py-3 font-semibold text-[#273955]">{x.employee_name||x.employee_code||"—"}</td><td className="px-4 py-3">{x.permission_name||x.permission_key}</td><td className="px-4 py-3">{label(x.access_level)}</td><td className="px-4 py-3">{label(x.scope_type)}</td><td className="max-w-[260px] px-4 py-3 text-[#69768a]">{x.reason||"—"}</td><td className="px-4 py-3">{dateTime(x.expires_at)}</td></tr>)}</tbody></table></div>}
function PermissionChanges({rows}:{rows:GovernanceReport["permission_changes"]}){if(!rows.length)return <Empty/>;return <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-[10px]"><thead className="bg-[#f8fafc] text-[#758296]"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Permission</th><th className="px-4 py-3">Change</th><th className="px-4 py-3">Actor</th></tr></thead><tbody>{rows.map(x=><tr key={x.id} className="border-t border-[#edf0f4]"><td className="px-4 py-3">{dateTime(x.changed_at)}</td><td className="px-4 py-3 font-semibold text-[#273955]">{x.target_name||x.target_code||"—"}</td><td className="px-4 py-3">{x.permission_name||x.permission_key}</td><td className="px-4 py-3">{label(x.old_access)} → {label(x.new_access)}</td><td className="px-4 py-3">{x.actor_name||"—"}</td></tr>)}</tbody></table></div>}
function AuditRows({rows}:{rows:GovernanceReport["audit_register"]["rows"]}){if(!rows.length)return <ReportEmptyState/>;return <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left text-[10px]"><thead className="bg-[#f8fafc] text-[#758296]"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Record</th></tr></thead><tbody>{rows.map(x=><tr key={x.id} className="border-t border-[#edf0f4]"><td className="px-4 py-3">{dateTime(x.occurred_at)}</td><td className="px-4 py-3 font-semibold text-[#273955]">{label(x.action)}</td><td className="px-4 py-3">{x.actor_name||"—"}</td><td className="px-4 py-3">{label(x.entity_type)}</td><td className="px-4 py-3">{x.entity_id||"—"}</td></tr>)}</tbody></table></div>}
function Empty(){return <ReportEmptyState/>}
function Pagination({page,pages,total,prev,next}:{page:number;pages:number;total:number;prev:string;next:string}){return <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0f4] px-4 py-3 text-[9.5px] text-[#738095]"><span>{integer(total)} records · Page {page} of {pages}</span><div className="flex gap-1.5"><Link className={`rounded-md border px-2.5 py-1.5 font-semibold ${page<=1?"pointer-events-none border-[#edf0f4] text-[#b1bac7]":"border-[#dfe5ee] text-[#425777]"}`} href={prev}>Previous</Link><Link className={`rounded-md border px-2.5 py-1.5 font-semibold ${page>=pages?"pointer-events-none border-[#edf0f4] text-[#b1bac7]":"border-[#dfe5ee] text-[#425777]"}`} href={next}>Next</Link></div></div>}
function pageHref(filters:{period:string;fromDate:string|null;toDate:string|null;action:string|null},page:number){const p=new URLSearchParams();p.set("period",filters.period);if(filters.fromDate)p.set("from",filters.fromDate);if(filters.toDate)p.set("to",filters.toDate);if(filters.action)p.set("action",filters.action);p.set("page",String(page));return `/reports/governance?${p.toString()}`}
function label(value:string|null){return value?value.replace(/_/g," ").replace(/\b\w/g,x=>x.toUpperCase()):"—"}
function roleLabel(value:string|null){return value?label(value):"No role"}
function integer(value:number){return new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(value)}
function dateTime(value:string|null){return value?new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):"—"}
function emptyReport():GovernanceReport{return{summary:{profile_count:0,active_profile_count:0,inactive_profile_count:0,active_employee_override_count:0,active_role_override_count:0,permission_change_count:0,audit_event_count:0},role_distribution:[],override_breakdown:[],active_overrides:[],permission_changes:[],audit_actions:[],audit_register:{rows:[],total_count:0,page:1,page_size:25}}}