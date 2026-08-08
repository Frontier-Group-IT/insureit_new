import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { DataError } from "@/components/record-list";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getAccessibleIntermediaryApplicationIds } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";

type QueueRow = { id:string; partner_type:"posp"|"misp"; source:string; status:string; applicant_phone:string|null; applicant_name:string|null; city:string|null; external_onboarding_id:string|null; document_count:number; age_days:number; updated_at:string; total_count:number };
type QueueApplication = { id:string; draft_data:Record<string,unknown>|null; partner_status:string|null; registration_status:string|null; final_type:string|null };
type TypeFilter = "posp"|"misp"|null;
const PAGE_SIZE=20;
const QUEUE_FETCH_LIMIT=1000;
const OPEN_STATUSES=new Set(["submitted","under_review","changes_requested"]);
export const dynamic="force-dynamic";
export const revalidate=0;

export default async function PospMispPage({searchParams}:{searchParams:Promise<{q?:string;type?:string;page?:string}>}){
 const profile=await requirePospMispManager();
 if(!profile) redirect("/access-denied");
 const query=await searchParams;
 const q=query.q?.trim().slice(0,100)||null;
 const typeFilter:TypeFilter=query.type==="posp"||query.type==="misp"?query.type:null;
 const page=Math.max(1,Number.parseInt(query.page??"1",10)||1);
 const accessibleIds=await getAccessibleIntermediaryApplicationIds(profile.id,profile.role);
 const scoped=accessibleIds!==null;
 const supabase=await createServerSupabaseClient();
 const {data,error}=await supabase.rpc("get_intermediary_application_queue",{p_query:q,p_requested_type:null,p_status:null,p_page:1,p_page_size:QUEUE_FETCH_LIMIT});
 const fetchedRows=(Array.isArray(data)?data:[]) as QueueRow[];
 const fetchedIds=fetchedRows.map(row=>row.id);
 const {data:applications,error:applicationsError}=fetchedIds.length
  ?await supabase.from("intermediary_onboarding_applications").select("id,draft_data,partner_status,registration_status,final_type").in("id",fetchedIds).returns<QueueApplication[]>()
  :{data:[] as QueueApplication[],error:null};
 const applicationById=new Map((applications??[]).map(item=>[item.id,item]));
 const onboardingRows=fetchedRows.filter(row=>isPendingOnboardingApplication(applicationById.get(row.id),row.status));
 const allowedRows=scoped?onboardingRows.filter(row=>accessibleIds.includes(row.id)):onboardingRows;
 const typeCounts={all:allowedRows.length,posp:allowedRows.filter(row=>row.partner_type==="posp").length,misp:allowedRows.filter(row=>row.partner_type==="misp").length};
 const filteredRows=typeFilter?allowedRows.filter(row=>row.partner_type===typeFilter):allowedRows;
 const total=filteredRows.length;
 const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
 const safePage=Math.min(page,totalPages);
 const rows=filteredRows.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE);
 const canReview=await hasEffectiveCapability(profile,"review_intermediary_application","edit");
 const loadError=error||applicationsError;
 return <AppShell title="Intermediary Onboarding"><div className="mx-auto max-w-[1480px] pb-5">
  {loadError?<DataError message="The intermediary onboarding register could not be loaded."/>:<div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
   <div className="flex flex-col gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
     <h2 className="shrink-0 text-[12px] font-semibold text-[#0F172A]">Pending Application Register</h2>
     <form method="get" className="w-full sm:max-w-[460px]">
      {typeFilter?<input type="hidden" name="type" value={typeFilter}/>:null}
      <input name="q" defaultValue={q??""} aria-label="Search intermediary applications" placeholder="Search name, mobile or onboarding ID" className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-[11.5px] outline-none transition focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#DBEAFE]"/>
     </form>
    </div>
    <div className="flex shrink-0 items-center gap-1 rounded-xl bg-white p-1 shadow-[0_6px_18px_rgba(15,23,42,0.05)] ring-1 ring-[#E2E8F0]">
     <TypeTab label="All" count={typeCounts.all} active={!typeFilter} href={typeHref(q,null)}/>
     <TypeTab label="POSP" count={typeCounts.posp} active={typeFilter==="posp"} href={typeHref(q,"posp")}/>
     <TypeTab label="MISP" count={typeCounts.misp} active={typeFilter==="misp"} href={typeHref(q,"misp")}/>
    </div>
   </div>
   <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-[11px]"><thead className="border-b border-[#E2E8F0] bg-white text-[9px] uppercase tracking-[0.06em] text-[#64748B]"><tr><th className="px-4 py-3">Application file</th><th className="px-3 py-3">Requested type</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Location</th><th className="px-3 py-3">Documents</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Pending age</th><th className="px-3 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#EEF2F6]">{rows.map(row=><tr key={row.id} className={row.age_days>=7?"bg-red-50/40 hover:bg-red-50/70":"hover:bg-[#FAFCFF]"}><td className="px-4 py-3"><p className="font-semibold text-[#0F172A]">{row.applicant_name??"Name pending verification"}</p><p className="mt-0.5 text-[9.5px] text-[#64748B]">{row.external_onboarding_id??`Ref ${row.id.slice(0,8).toUpperCase()}`}</p></td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.partner_type==='misp'?"bg-[#FFF7D6] text-[#8A6500]":"bg-[#E8F0FF] text-[#174EA6]"}`}>{row.partner_type.toUpperCase()}</span></td><td className="px-3 py-3 tabular-nums">{row.applicant_phone??"-"}</td><td className="px-3 py-3">{row.city??"-"}</td><td className="px-3 py-3"><span className={row.document_count?"font-semibold text-emerald-700":"font-semibold text-amber-700"}>{row.document_count} received</span></td><td className="px-3 py-3">{row.source==='manager_portal'?"Manager portal":"Excel import"}</td><td className="px-3 py-3"><AgeBadge days={row.age_days}/></td><td className="px-3 py-3"><StatusPill status={row.status}/></td><td className="px-4 py-3 text-right"><Link href={`/intermediaries/applications/${row.id}`} className="inline-flex rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-1.5 text-[9.5px] font-semibold text-[#4338CA]">{canReview?"Review file":"Open file"}</Link></td></tr>)}</tbody></table>{!rows.length?<div className="px-4 py-16 text-center"><p className="text-[12px] font-semibold text-[#334155]">No pending onboarding applications found</p><p className="mt-1 text-[10px] text-[#64748B]">Completed Partner and linked POSP/MISP accounts are available in their respective registers.</p></div>:null}</div>
  </div>}
  {!loadError&&totalPages>1?<div className="mt-4 flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white px-3 py-2"><Link href={pageHref(q,typeFilter,Math.max(1,safePage-1))} className={`rounded-md border px-3 py-1.5 text-[10.5px] font-semibold ${safePage<=1?"pointer-events-none text-[#94A3B8]":"text-[#334155]"}`}>Previous</Link><span className="text-[10.5px] font-semibold text-[#475569]">Page {safePage} of {totalPages}</span><Link href={pageHref(q,typeFilter,Math.min(totalPages,safePage+1))} className={`rounded-md border px-3 py-1.5 text-[10.5px] font-semibold ${safePage>=totalPages?"pointer-events-none text-[#94A3B8]":"text-[#334155]"}`}>Next</Link></div>:null}
 </div></AppShell>;
}

function TypeTab({label,count,active,href}:{label:string;count:number;active:boolean;href:string}){
 return <Link href={href} aria-current={active?"page":undefined} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition ${active?"bg-gradient-to-r from-[#6757F6] to-[#4F8DF7] text-white shadow-[0_6px_14px_rgba(99,87,246,0.22)]":"text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F2A55]"}`}><span>{label}</span><span className={active?"text-white/85":"text-[#64748B]"}>{count}</span></Link>;
}
function isPendingOnboardingApplication(application:QueueApplication|undefined,rowStatus:string){
 if(!application||!OPEN_STATUSES.has(rowStatus))return false;
 if(application.partner_status==="active_partner")return false;
 if(accountContext(application.draft_data)!=="partner")return false;
 if(application.final_type==="partner")return false;
 const registrationStatus=application.registration_status?.trim().toLowerCase()??"";
 if(registrationStatus&&!["documents_pending","pending","not_started"].includes(registrationStatus))return false;
 return true;
}
function StatusPill({status}:{status:string}){const attention=status==='changes_requested';const className=attention?"border-red-200 bg-red-50 text-red-700":status==='under_review'?"border-blue-200 bg-blue-50 text-blue-700":"border-amber-200 bg-amber-50 text-amber-700";return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold capitalize ${className}`}>{status.replaceAll('_',' ')}</span>}
function AgeBadge({days}:{days:number}){const className=days>=7?"bg-red-100 text-red-700":days>=3?"bg-amber-100 text-amber-700":"bg-slate-100 text-slate-600";return <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${className}`}>{days===0?"Today":`${days} days`}</span>}
function typeHref(q:string|null,type:TypeFilter){const params=new URLSearchParams();if(q)params.set('q',q);if(type)params.set('type',type);return `/customers/posp-misp${params.size?`?${params.toString()}`:''}`}
function pageHref(q:string|null,type:TypeFilter,page:number){const params=new URLSearchParams();if(q)params.set('q',q);if(type)params.set('type',type);if(page>1)params.set('page',String(page));return `/customers/posp-misp${params.size?`?${params.toString()}`:''}`}
function accountContext(draft:Record<string,unknown>|null|undefined){const context=draft?.account_context;return context==="posp"||context==="misp"?context:"partner"}
