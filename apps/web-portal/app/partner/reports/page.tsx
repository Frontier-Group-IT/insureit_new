import Link from "next/link";
import { ArrowRight, Info, AlertCircle, Clock3, Download } from "lucide-react";
import { BusinessTrendCard } from "@/components/reports/business-trend-card";
import { PartnerReportsShell } from "@/components/partner-portal/partner-reports-shell";
import { requirePartnerReportScope } from "@/lib/reports/partner-report-scope";
import { getPartnerWebBusinessPerformance, getPartnerWebPolicySummary, getPartnerWebClaimSummary, getPartnerWebRenewalSummary, listPartnerWebPolicies, type PartnerPolicyRow } from "@/lib/partner-web";
import { getInsurerLogo } from "@/lib/insurer-logo";
import Image from "next/image";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const number=(value:number|string|null|undefined)=>new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(Number(value??0));
const money=(value:number|string|null|undefined)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(value??0));
const compactMoney=(value:number|string|null|undefined)=>{const v=Number(value??0);return Math.abs(v)>=1e7?`₹${(v/1e7).toFixed(2)} Cr`:Math.abs(v)>=1e5?`₹${(v/1e5).toFixed(1)} L`:money(v)};
function Kpi({label,value,note}:{label:string;value:string;note:string}){return <div className="ov-kpi"><div className="ov-kpi-label">{label}<Info className="h-3 w-3"/></div><div className="ov-kpi-value">{value}</div><div className="ov-kpi-note">{note}</div></div>}
function AttentionRow({label,count,detail,href,alert}:{label:string;count:number;detail:string;href:string;alert?:boolean}){return <Link prefetch={false} href={href} className="ov-attention-row"><span className={`ov-attention-icon ov-attention-icon--${alert?"danger":"clock"}`}>{alert?<AlertCircle className="h-3.5 w-3.5"/>:<Clock3 className="h-3.5 w-3.5"/>}</span><span className="ov-attention-copy"><strong>{number(count)} {label}</strong><small>{detail}</small></span><ArrowRight className="h-3.5 w-3.5 text-[#7b8ba3]"/></Link>}
type Query = {period?:string;from?:string;to?:string;business?:string};
type Period = "mtd"|"last-month"|"last-6-months"|"custom";
const validDate=(v?:string)=>Boolean(v&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v)));
function boundsFor(day:string,period:Period,from?:string,to?:string){
 const d=new Date(day+"T00:00:00Z");
 const month=(offset:number)=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+offset,1)).toISOString().slice(0,10);
 if(period==="custom"&&validDate(from)&&validDate(to)&&from!>to!) return {from:from!,to:to!};
 if(period==="last-month")return {from:month(-1),to:new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),0)).toISOString().slice(0,10)};
 return {from:month(period==="last-6-months"?-5:0),to:day};
}
function businessLine(row:PartnerPolicyRow){
 const value=String(row.business_type||row.business_line||row.policy_type||"").toLowerCase().trim();
 if(value.includes("non")&&value.includes("motor"))return "non motor";
 if(value.includes("motor"))return "motor";
 if(value.includes("health"))return "health";
 if(value.includes("life"))return "life";
 return "other";
}
async function scopedPolicyRows(){
 const rows:PartnerPolicyRow[]=[];const limit=100;
 for(let offset=0;offset<5000;offset+=limit){
  const batch=await listPartnerWebPolicies({limit,offset,lifecycle:"all"});
  rows.push(...batch);if(batch.length<limit)return rows;
 }
 throw new Error("Authorized report exceeds the supported row limit; cannot display incomplete totals.");
}
export default async function PartnerReportsPage({searchParams}:{searchParams:Promise<Query>}){
 const reportScope=await requirePartnerReportScope();
 const query=await searchParams;
 const period:Period=["mtd","last-month","last-6-months","custom"].includes(query.period||"") ? query.period as Period : "mtd";
 const business=["all","motor","non motor","life","health"].includes(query.business||"")?query.business!:"all";
 const [performance,policies,claims,renewals,allRows]=await Promise.all([
  getPartnerWebBusinessPerformance(),getPartnerWebPolicySummary(),getPartnerWebClaimSummary(),
  getPartnerWebRenewalSummary(),
  scopedPolicyRows(),
 ]);
 const day=/^\d{4}-\d{2}-\d{2}$/.test(performance.generated_at?.slice(0,10)||"")?performance.generated_at.slice(0,10):new Date().toISOString().slice(0,10);
 const bounds=boundsFor(day,period,query.from,query.to);
 const filtered=allRows.filter(row=>{const date=(row.issuance_date||row.start_date||"").slice(0,10);return date>=bounds.from&&date<=bounds.to&&(business==="all"||businessLine(row)===business);});
 const totalPremium=filtered.reduce((sum,row)=>sum+Number(row.premium_amount||0),0);
 const uniqueCustomers=new Set(filtered.map(row=>row.customer_id).filter(Boolean)).size;
 const recent=[...filtered].sort((a,b)=>String(b.issuance_date||b.start_date||"").localeCompare(String(a.issuance_date||a.start_date||""))).slice(0,8);
 const mixMap=new Map<string,{label:string;policies:number;premium:number}>();
 const trendMap=new Map<string,{key:string;label:string;axisLabel:string;policy_count:number;net_premium:number}>();
 for(const row of filtered){
  const label=String(row.business_type||row.policy_type||"Other").trim()||"Other";
  const m=mixMap.get(label)||{label,policies:0,premium:0};m.policies++;m.premium+=Number(row.premium_amount||0);mixMap.set(label,m);
  const key=(row.issuance_date||row.start_date||"").slice(0,7);if(!key)continue;
  const t=trendMap.get(key)||{key,label:key,axisLabel:key,policy_count:0,net_premium:0};
  t.policy_count++;t.net_premium+=Number(row.premium_amount||0);trendMap.set(key,t);
 }
 const mixRows=[...mixMap.values()].sort((a,b)=>b.premium-a.premium);
 const trendPoints=[...trendMap.values()].sort((a,b)=>a.key.localeCompare(b.key));
 const totalMix=mixRows.reduce((sum,row)=>sum+row.premium,0);
 const maxMix=Math.max(1,...mixRows.map(row=>row.premium));
 const filterQuery=new URLSearchParams({period,business,...(period==="custom"?{from:bounds.from,to:bounds.to}:{})});
 return <PartnerReportsShell active="Overview" scope={reportScope} toolbar={
   <form method="get" className="flex flex-wrap items-center justify-end gap-1.5" aria-label="Overview filters">
     <label className="flex items-center text-[0px]">Period<select name="period" defaultValue={period} className="block h-9 min-w-[125px] rounded-lg border border-[#dae2ec] bg-white px-2 text-[11px]"><option value="mtd">MTD</option><option value="last-month">Last Month</option><option value="last-6-months">Last 6 Months</option><option value="custom">Custom</option></select></label>
     <label className="flex items-center text-[0px]">Business<select name="business" defaultValue={business} className="block h-9 min-w-[145px] rounded-lg border border-[#dae2ec] bg-white px-2 text-[11px]"><option value="all">All Business</option><option value="motor">Motor</option><option value="non motor">Non Motor</option><option value="life">Life</option><option value="health">Health</option></select></label>
     <label className="flex items-center text-[0px]">From<input type="date" name="from" defaultValue={bounds.from} className="block h-9 w-[130px] rounded-lg border border-[#dae2ec] px-1 text-[11px]"/></label>
     <label className="flex items-center text-[0px]">To<input type="date" name="to" defaultValue={bounds.to} className="block h-9 w-[130px] rounded-lg border border-[#dae2ec] px-1 text-[11px]"/></label>
     <button type="submit" className="h-9 rounded-lg bg-[#205a97] px-4 text-[11px] font-bold text-white">Apply</button>
     <Link href="/partner/reports" className="flex h-9 items-center rounded-lg border border-[#dae2ec] px-3 text-[11px] font-semibold text-[#305070]">Reset</Link>
     <Link href={`/partner/business/export?${filterQuery.toString()}`} className="flex h-9 items-center gap-1 rounded-lg border border-[#205a97] px-3 text-[11px] font-semibold text-[#205a97]"><Download className="h-3.5 w-3.5"/>Export</Link>
   </form>
 }>
  <div className="reports-v2-page reports-overview-reference">

   <section className="ov-card ov-kpis" aria-label="Overview key performance indicators">
    <Kpi label="Gross Premium" value={compactMoney(totalPremium)} note="Selected period · authorized scope"/>
    <Kpi label="Policies" value={number(filtered.length)} note="Selected period"/>
    <Kpi label="Active Policies" value={number(policies.in_force_policies)} note="Currently in force"/>
    <Kpi label="Customers" value={number(uniqueCustomers)} note="Unique customers in selected period"/>
    <Kpi label="Open Claims" value={number(claims.active_claims)} note="Under processing"/>
    <Kpi label="Renewals 30d" value={number(policies.expiring_30_days)} note="Due within 30 days"/>
   </section>
   <section className="ov-grid ov-grid--top">
    <BusinessTrendCard activePeriod="last_6_months" options={[{value:"last_6_months",label:"Last 6 Months",href:"/partner/reports"}]} points={trendPoints}/>
    <article className="ov-card ov-section"><div className="ov-section-head"><h2>Attention</h2><Link href="/partner/reports" className="ov-view-link">View all <ArrowRight className="h-3 w-3"/></Link></div><div className="ov-attention">
     <AttentionRow label="Renewals due (30 days)" count={Number(policies.expiring_30_days)} detail="Policies requiring renewal attention" href="/partner/renewals" alert/>
     <AttentionRow label="Overdue renewals" count={Number(renewals.overdue_count)} detail="Renewals past expiry" href="/partner/renewals" alert/>
     <AttentionRow label="Active claims" count={Number(claims.active_claims)} detail="Claims currently in process" href="/partner/claims"/>
     <AttentionRow label="Assistance requested" count={Number(claims.assistance_requested)} detail="Claims awaiting assistance" href="/partner/claims"/>
    </div></article>
   </section>
   <section className="ov-grid ov-grid--bottom">
    <article className="ov-card ov-section"><div className="ov-section-head"><h2>Business Mix</h2><span className="text-[10px] text-[#667085]">Authorized business category</span></div>
     <div className="ov-mix"><div className="ov-mix-head"><span>#</span><span>Business</span><span>Gross Premium</span><span>Policies</span><span>Share</span></div>
     {mixRows.map((row,index)=><div key={row.label+index} className="ov-mix-row"><span>{index+1}</span><span className="ov-mix-insurer"><strong>{row.label}</strong></span><span className="ov-mix-bar-wrap"><span className="ov-mix-value-label">{compactMoney(row.premium)}</span><i style={{width:`${Math.max(4,Number(row.premium)/maxMix*100)}%`}}/></span><span className="ov-mix-policy-count">{number(row.policies)}</span><span>{totalMix?(Number(row.premium)/totalMix*100).toFixed(1):"0"}%</span></div>)}
     {!mixRows.length?<div className="r2-empty">No business mix available</div>:null}
     </div>
    </article>
    <article className="ov-card ov-section"><div className="ov-section-head"><h2>Renewal Opportunity</h2><Link href="/partner/renewals" className="ov-view-link">View renewals <ArrowRight className="h-3 w-3"/></Link></div>
      <div className="space-y-2 px-4 py-4">{[["Overdue",renewals.overdue_count],["Due 0–7 days",renewals.due_0_7_count],["Due 8–15 days",renewals.due_8_15_count],["Due 16–30 days",renewals.due_16_30_count]].map(([label,value])=><div key={String(label)} className="flex items-center justify-between border-b border-[#e6ebf2] py-2 text-[12px]"><span className="text-[#526780]">{label}</span><strong className="text-[#183d6b]">{number(value)}</strong></div>)}</div>
    </article>
   </section>
   <section className="ov-card ov-section ov-recent"><div className="ov-section-head"><h2>Recent / filtered records</h2><Link href="/partner/reports/business" className="ov-view-link">View all <ArrowRight className="h-3 w-3"/></Link></div>
    <div className="ov-table-wrap"><table className="ov-table"><thead><tr><th>Customer</th><th>Policy</th><th>Insurer</th><th>Status</th><th className="ov-num">Premium (₹)</th></tr></thead><tbody>
      {recent.map(row=><tr key={row.policy_id}><td><strong>{row.customer_name||"—"}</strong></td><td>{row.policy_no||"—"}</td><td><span className="ov-insurer-cell">{getInsurerLogo(row.insurer_name||"")?<Image src={getInsurerLogo(row.insurer_name||"")!} alt="" width={18} height={18} className="ov-insurer-logo"/>:null}{row.insurer_name||"—"}</span></td><td>{row.lifecycle_status||"—"}</td><td className="ov-num">{row.premium_amount==null?"—":money(row.premium_amount)}</td></tr>)}
      {!recent.length?<tr><td colSpan={5} className="r2-empty">No policy records in your reporting scope</td></tr>:null}
    </tbody></table></div>
   </section>
  </div>
 </PartnerReportsShell>;
}
