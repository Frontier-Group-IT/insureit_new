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
function Overrides({rows}:{rows:GovernanceReport["active_overrides"]}){if(!rows.length)return <Empty/>;return <div className="overflow-x-auto"><table className="w-full min-w-[900px]"><thead><tr className="bg-[#f8fafc] text-[8.5px] font-black uppercase tracking-[.07em] text-[#7c899b]"><th className="px-5 py-3 text-left">Employee</th><th className="px-3 py-3 text-left">Capability</th><th className="px-3 py-3 text-left">Access</th><th className="px-3 py-3 text-left">Scope</th><th className="px-3 py-3 text-left">Expires</th><th className="px-5 py-3 text-left">Reason</th></tr></thead><tbody className="divide-y divide-[#edf0f4]">{rows.map(x=><tr key={x.id} className="text-[10px]"><td className="px-5 py-3.5"><p className="font-bold text-[#26364f]">{x.profile_name}</p><p className="text-[8.5px] text-[#8792a3]">{roleLabel(x.profile_role)}</p></td><td className="px-3 py-3.5 font-semibold">{label(x.capability)}</td><td className="px-3 py-3.5">{label(x.access_level)}</td><td className="px-3 py-3.5">{label(x.scope_type)}</td><td className="px-3 py-3.5">{x.expires_at?dateTime(x.expires_at):"No expiry"}</td><td className="px-5 py-3.5 text-[#5f6c7e]">{x.reason??"—"}</td></tr>)}</tbody></table></div>}
function PermissionChanges({rows}:{rows:GovernanceReport["permission_changes"]}){if(!rows.length)return <Empty/>;return <div className="overflow-x-auto"><table className="w-full min-w-[1120px]"><thead><tr className="bg-[#f8fafc] text-[8.5px] font-black uppercase tracking-[.07em] text-[#7c899b]"><th className="px-5 py-3 text-left">Time</th><th className="px-3 py-3 text-left">Target</th><th className="px-3 py-3 text-left">Capability</th><th className="px-3 py-3 text-left">Access</th><th className="px-3 py-3 text-left">Scope</th><th className="px-3 py-3 text-left">Changed by</th><th className="px-5 py-3 text-left">Reason</th></tr></thead><tbody className="divide-y divide-[#edf0f4]">{rows.map(x=><tr key={x.id} className="text-[10px]"><td className="px-5 py-3.5">{dateTime(x.created_at)}</td><td className="px-3 py-3.5"><p className="font-bold">{x.target_name}</p><p className="text-[8.5px] text-[#8792a3]">{roleLabel(x.target_role??"")}</p></td><td className="px-3 py-3.5">{label(x.capability??x.change_type??"change")}</td><td className="px-3 py-3.5">{transition(x.previous_access,x.new_access)}</td><td className="px-3 py-3.5">{transition(x.previous_scope,x.new_scope)}</td><td className="px-3 py-3.5">{x.changed_by_name}</td><td className="px-5 py-3.5 text-[#5f6c7e]">{x.reason??"—"}</td></tr>)}</tbody></table></div>}
function AuditRows({rows}:{rows:GovernanceReport["audit_register"]["rows"]}){if(!rows.length)return <Empty/>;return <div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead><tr className="bg-[#f8fafc] text-[8.5px] font-black uppercase tracking-[.07em] text-[#7c899b]"><th className="px-5 py-3 text-left">Time</th><th className="px-3 py-3 text-left">Action</th><th className="px-3 py-3 text-left">Area</th><th className="px-5 py-3 text-left">Actor</th></tr></thead><tbody className="divide-y divide-[#edf0f4]">{rows.map(x=><tr key={x.id} className="text-[10px]"><td className="px-5 py-3.5">{dateTime(x.created_at)}</td><td className="px-3 py-3.5 font-bold">{label(x.action)}</td><td className="px-3 py-3.5">{label(x.table_name??"system")}</td><td className="px-5 py-3.5">{x.actor_name}</td></tr>)}</tbody></table></div>}
function Pagination({page,pages,total,prev,next}:{page:number;pages:number;total:number;prev:string;next:string}){return <div className="flex items-center justify-between border-t border-[#edf0f4] px-5 py-3 text-[9.5px] text-[#738095]"><span>{integer(total)} records</span><div className="flex items-center gap-2"><Link href={page<=1?"#":prev} className={`rounded-md border px-3 py-1.5 font-bold ${page<=1?"pointer-events-none opacity-40":""}`}>Previous</Link><span>{page} / {pages}</span><Link href={page>=pages?"#":next} className={`rounded-md border px-3 py-1.5 font-bold ${page>=pages?"pointer-events-none opacity-40":""}`}>Next</Link></div></div>}
function Empty(){return <ReportEmptyState/>}
function emptyReport():GovernanceReport{return{summary:{profile_count:0,active_profile_count:0,inactive_profile_count:0,active_employee_override_count:0,role_override_count:0,permission_change_count:0,audit_event_count:0},role_distribution:[],override_breakdown:[],active_overrides:[],permission_changes:[],audit_actions:[],audit_register:{rows:[],total_count:0,page:1,page_size:25}}}
function pageHref(filters:{period:string;fromDate:string|null;toDate:string|null;action:string|null},page:number){const p=new URLSearchParams();p.set("period","custom");if(filters.fromDate)p.set("from",filters.fromDate);if(filters.toDate)p.set("to",filters.toDate);if(filters.action)p.set("action",filters.action);p.set("page",String(page));return `/reports/governance?${p.toString()}`}
function integer(v:number){return new Intl.NumberFormat("en-IN").format(v)}
function dateTime(v:string){return v?new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v)):"—"}
function label(v:string){return v.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
function roleLabel(v:string){return label(v||"Unknown")}
function transition(a:string|null,b:string|null){if(!a&&!b)return"—";if(a===b)return label(b??a??"");return `${a?label(a):"—"} → ${b?label(b):"—"}`}
