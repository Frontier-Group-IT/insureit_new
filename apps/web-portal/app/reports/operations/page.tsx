import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/shell";
import { ReportQueryShortcuts } from "@/components/reports/report-query-shortcuts";
import { ReportApplyButton, ReportEmptyState, ReportExportLink, ReportFilterField, ReportPageShell, ReportResetLink, reportInputClass } from "@/components/reports/report-page-shell";
import { requireCapability } from "@/lib/master-data-server";
import { emptyOperationsReport, loadOperationsReport, type OperationsFilters, type OperationsQuery, type OperationsReport } from "@/lib/reports/operations";

export const dynamic="force-dynamic";
export const revalidate=0;
const HORIZONS=[30,60,90,180,365] as const;
const HORIZON_OPTIONS=HORIZONS.map(value=>({value:String(value),label:`${value} days`}));
type Props={searchParams:Promise<OperationsQuery>};

export default async function OperationsReportsPage({searchParams}:Props){
 const profile=await requireCapability("view_reports"); const query=await searchParams;
 let payload:Awaited<ReturnType<typeof loadOperationsReport>>|null=null; let loadError=false;
 try{payload=await loadOperationsReport(profile,query)}catch(error){console.error("[reports] operations report failed",error instanceof Error?error.message:"unknown error");loadError=true}
 const report=payload?.report??emptyOperationsReport(); const filters=payload?.filters??fallbackFilters();
 const pages=Math.max(1,Math.ceil(report.register.total_count/Math.max(report.register.page_size,1)));
 const exportHref=href("/reports/export/operations",filters);
 return <AppShell title="Reports"><ReportPageShell
  title="Operations & compliance"
  loadError={loadError}
  actions={<ReportExportLink href={exportHref}/>} 
  controls={<>
   <ReportQueryShortcuts label="Horizon" param="horizon" activeValue={String(filters.horizonDays)} options={HORIZON_OPTIONS}/>
   <form action="/reports/operations" method="get" className="grid gap-2 sm:grid-cols-[160px_minmax(180px,1fr)_auto_auto]">
    <ReportFilterField label="Horizon"><select name="horizon" defaultValue={String(filters.horizonDays)} className={reportInputClass}>{HORIZONS.map(x=><option key={x} value={x}>{x} days</option>)}</select></ReportFilterField>
    <ReportFilterField label="Exception"><select name="exception" defaultValue={filters.exception??""} className={reportInputClass}><option value="">All vehicles</option><option value="missing">Missing compliance data</option><option value="expired">Expired documents</option><option value="due">Due within horizon</option><option value="unverified">AuthBridge unverified</option></select></ReportFilterField>
    <ReportApplyButton/>
    <ReportResetLink href="/reports/operations"/>
   </form>
  </>}
 >
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Metric label="Vehicles" value={integer(report.summary.vehicle_count)}/><Metric label="AuthBridge verified" value={integer(report.summary.authbridge_verified_count)}/><Metric label="Missing compliance" value={integer(report.summary.vehicles_missing_compliance_data)}/><Metric label="Missing fields" value={integer(report.summary.missing_compliance_fields)}/><Metric label="Expired" value={integer(report.summary.expired_document_count)}/><Metric label={`Due ≤ ${filters.horizonDays}d`} value={integer(report.summary.due_document_count)}/></section>
  <section className="portal-card overflow-hidden"><Header title="Vehicle compliance"/><ComplianceTable rows={report.compliance}/></section>
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Mini label="Customer documents" value={report.customer_documents.document_count}/><Mini label="Verified" value={report.customer_documents.verified_count}/><Mini label="Pending" value={report.customer_documents.pending_count}/><Mini label="Rejected" value={report.customer_documents.rejected_count}/><Mini label="Customers with exceptions" value={report.customer_documents.customers_with_exceptions}/></section>
  <section className="portal-card overflow-hidden"><div className="border-b border-[#e9edf3] px-5 py-4"><h2 className="text-[14px] font-bold text-[#1b2943]">Vehicle exception register</h2></div><Register rows={report.register.rows}/><Pagination page={report.register.page} pages={pages} total={report.register.total_count} prev={href("/reports/operations",filters,Math.max(1,report.register.page-1))} next={href("/reports/operations",filters,report.register.page+1)}/></section>
 </ReportPageShell></AppShell>
}

function Metric({label,value}:{label:string;value:string}){return <article className="portal-card px-4 py-4"><p className="text-[8.5px] font-black uppercase tracking-[.08em] text-[#7c899b]">{label}</p><p className="mt-2 text-[21px] font-semibold text-[#14213c]">{value}</p></article>}
function Mini({label,value}:{label:string;value:number}){return <article className="rounded-xl border border-[#e2e7ee] bg-white px-4 py-3"><p className="text-[8px] font-black uppercase tracking-[.08em] text-[#8994a5]">{label}</p><p className="mt-1.5 text-[18px] font-semibold text-[#1e2d49]">{integer(value)}</p></article>}
function Header({title}:{title:string}){return <div className="border-b border-[#e9edf3] px-5 py-4"><h2 className="text-[14px] font-bold text-[#1b2943]">{title}</h2></div>}
function ComplianceTable({rows}:{rows:OperationsReport["compliance"]}){if(!rows.length)return <Empty/>;return <div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead><tr className="bg-[#f8fafc] text-[8px] font-black uppercase tracking-[.07em] text-[#7c899b]"><th className="px-5 py-3 text-left">Document</th><th className="px-3 py-3 text-right">Vehicles</th><th className="px-3 py-3 text-right">Missing</th><th className="px-3 py-3 text-right">Expired</th><th className="px-3 py-3 text-right">Due</th><th className="px-5 py-3 text-right">Nearest expiry</th></tr></thead><tbody className="divide-y divide-[#edf0f4]">{rows.map(x=><tr key={x.label} className="text-[10px]"><td className="px-5 py-3.5 font-semibold">{x.label}</td><td className="px-3 py-3.5 text-right">{integer(x.vehicle_count)}</td><td className="px-3 py-3.5 text-right font-bold text-amber-700">{integer(x.missing_count)}</td><td className="px-3 py-3.5 text-right font-bold text-red-700">{integer(x.expired_count)}</td><td className="px-3 py-3.5 text-right font-bold text-[#3559a8]">{integer(x.due_count)}</td><td className="px-5 py-3.5 text-right">{date(x.nearest_expiry_date)}</td></tr>)}</tbody></table></div>}
function Register({rows}:{rows:OperationsReport["register"]["rows"]}){if(!rows.length)return <Empty/>;return <div className="overflow-x-auto"><table className="w-full min-w-[1450px]"><thead><tr className="bg-[#f8fafc] text-[8px] font-black uppercase tracking-[.07em] text-[#7c899b]"><th className="px-5 py-3 text-left">Vehicle</th><th className="px-3 py-3 text-left">Customer</th><th className="px-3 py-3 text-left">Registration</th><th className="px-3 py-3 text-left">AuthBridge</th><th className="px-3 py-3 text-right">Fitness</th><th className="px-3 py-3 text-right">PUC</th><th className="px-3 py-3 text-right">Road tax</th><th className="px-3 py-3 text-right">National permit</th><th className="px-3 py-3 text-right">Local permit</th><th className="px-3 py-3 text-right">Missing</th><th className="px-3 py-3 text-right">Expired</th><th className="px-3 py-3 text-right">Due</th><th className="px-5 py-3 text-center">Open</th></tr></thead><tbody className="divide-y divide-[#edf0f4]">{rows.map(x=><tr key={x.id} className="text-[9.5px] hover:bg-[#fbfcfe]"><td className="px-5 py-3.5"><p className="font-bold">{x.vehicle_no}</p><p className="text-[8px] text-[#8490a1]">{[x.make,x.model].filter(Boolean).join(" · ")||x.vehicle_type||"—"}</p></td><td className="px-3 py-3.5"><p className="font-semibold">{x.customer_name}</p><p className="text-[8px] text-[#8490a1]">{x.customer_code}</p></td><td className="px-3 py-3.5">{label(x.registration_status)}</td><td className="px-3 py-3.5 font-semibold">{x.authbridge_verified?"Verified":"Unverified"}</td><td className="px-3 py-3.5 text-right">{date(x.fitness_expiry_date)}</td><td className="px-3 py-3.5 text-right">{date(x.puc_expiry_date)}</td><td className="px-3 py-3.5 text-right">{date(x.road_tax_expiry_date)}</td><td className="px-3 py-3.5 text-right">{date(x.national_permit_expiry_date)}</td><td className="px-3 py-3.5 text-right">{date(x.local_permit_expiry_date)}</td><td className="px-3 py-3.5 text-right font-bold text-amber-700">{integer(x.missing_compliance_count)}</td><td className="px-3 py-3.5 text-right font-bold text-red-700">{integer(x.expired_compliance_count)}</td><td className="px-3 py-3.5 text-right font-bold text-[#3559a8]">{integer(x.due_compliance_count)}</td><td className="px-5 py-3.5 text-center"><Link href={`/vehicles/${x.id}`} className="inline-grid h-8 w-8 place-items-center rounded-lg border border-[#d9e1ec] text-[#425b8f]"><ExternalLink className="h-3.5 w-3.5"/></Link></td></tr>)}</tbody></table></div>}
function Pagination({page,pages,total,prev,next}:{page:number;pages:number;total:number;prev:string;next:string}){return <div className="flex items-center justify-between border-t border-[#edf0f4] px-5 py-3 text-[9.5px] text-[#738095]"><span>{integer(total)} records</span><div className="flex items-center gap-2"><Link href={page<=1?"#":prev} className={`rounded-md border px-3 py-1.5 font-bold ${page<=1?"pointer-events-none opacity-40":""}`}>Previous</Link><span>{page} / {pages}</span><Link href={page>=pages?"#":next} className={`rounded-md border px-3 py-1.5 font-bold ${page>=pages?"pointer-events-none opacity-40":""}`}>Next</Link></div></div>}
function Empty(){return <ReportEmptyState/>}
function href(path:string,f:OperationsFilters,page?:number){const s=new URLSearchParams();s.set("horizon",String(f.horizonDays));if(f.exception)s.set("exception",f.exception);if(page)s.set("page",String(page));return `${path}?${s}`}
function date(v:string|null){if(!v)return "—";return new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(new Date(`${v}T00:00:00+05:30`))}
function integer(v:number){return new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(v||0)}
function label(v:string|null){return v?v.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase()):"—"}
function fallbackFilters():OperationsFilters{return{horizonDays:90,exception:null,page:1}}
