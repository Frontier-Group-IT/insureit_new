import Link from "next/link";
import { ArrowRight, Info, AlertCircle, Clock3 } from "lucide-react";
import { BusinessTrendCard } from "@/components/reports/business-trend-card";
import { PartnerReportsShell } from "@/components/partner-portal/partner-reports-shell";
import { requirePartnerReportScope } from "@/lib/reports/partner-report-scope";
import { getPartnerWebBusinessPerformance, getPartnerWebPolicySummary, getPartnerWebClaimSummary, getPartnerWebRenewalSummary, getPartnerWebPayoutSummary, listPartnerWebPolicies } from "@/lib/partner-web";
import { getInsurerLogo } from "@/lib/insurer-logo";
import Image from "next/image";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const number=(value:number|string|null|undefined)=>new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(Number(value??0));
const money=(value:number|string|null|undefined)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(value??0));
const compactMoney=(value:number|string|null|undefined)=>{const v=Number(value??0);return Math.abs(v)>=1e7?`₹${(v/1e7).toFixed(2)} Cr`:Math.abs(v)>=1e5?`₹${(v/1e5).toFixed(1)} L`:money(v)};
function Kpi({label,value,note}:{label:string;value:string;note:string}){return <div className="ov-kpi"><div className="ov-kpi-label">{label}<Info className="h-3 w-3"/></div><div className="ov-kpi-value">{value}</div><div className="ov-kpi-note">{note}</div></div>}
function AttentionRow({label,count,detail,href,alert}:{label:string;count:number;detail:string;href:string;alert?:boolean}){return <Link prefetch={false} href={href} className="ov-attention-row"><span className={`ov-attention-icon ov-attention-icon--${alert?"danger":"clock"}`}>{alert?<AlertCircle className="h-3.5 w-3.5"/>:<Clock3 className="h-3.5 w-3.5"/>}</span><span className="ov-attention-copy"><strong>{number(count)} {label}</strong><small>{detail}</small></span><ArrowRight className="h-3.5 w-3.5 text-[#7b8ba3]"/></Link>}
export default async function PartnerReportsPage(){
 const reportScope=await requirePartnerReportScope();
 const canShowPayout=reportScope.role==="partner"||reportScope.role==="partner_associate";
 const [performance,policies,claims,renewals,payout,recent]=await Promise.all([
  getPartnerWebBusinessPerformance(), getPartnerWebPolicySummary(), getPartnerWebClaimSummary(),
  getPartnerWebRenewalSummary(),canShowPayout?getPartnerWebPayoutSummary():Promise.resolve({available:false as const}),
  listPartnerWebPolicies({limit:8,offset:0}),
 ]);
 const totalMix=performance.business_mix.reduce((total,row)=>total+Number(row.premium),0);
 const maxMix=Math.max(1,...performance.business_mix.map(row=>Number(row.premium)));
 return <PartnerReportsShell active="Overview" scope={reportScope}>
  <div className="reports-v2-page reports-overview-reference">
   <section className="ov-card ov-kpis" aria-label="Overview key performance indicators">
    <Kpi label="Gross Premium" value={compactMoney(performance.premium_this_month)} note="Month to date · authorized scope"/>
    <Kpi label="Policies" value={number(performance.policies_this_month)} note="Month to date"/>
    <Kpi label="Active Policies" value={number(policies.in_force_policies)} note="Currently in force"/>
    <Kpi label="Customers" value={number(performance.total_customers)} note="Authorized network"/>
    <Kpi label="Open Claims" value={number(claims.active_claims)} note="Under processing"/>
    <Kpi label="Renewals 30d" value={number(policies.expiring_30_days)} note="Due within 30 days"/>
   </section>
   <section className="ov-grid ov-grid--top">
    <BusinessTrendCard activePeriod="last_6_months" options={[{value:"last_6_months",label:"Last 6 Months",href:"/partner/reports"}]} points={performance.trend.map(point=>({key:point.month,label:point.month,axisLabel:point.month,policy_count:Number(point.policies),net_premium:Number(point.premium)}))}/>
    <article className="ov-card ov-section"><div className="ov-section-head"><h2>Attention</h2><Link href="/partner/reports/operations" className="ov-view-link">View all <ArrowRight className="h-3 w-3"/></Link></div><div className="ov-attention">
     <AttentionRow label="Renewals due (30 days)" count={Number(policies.expiring_30_days)} detail="Policies requiring renewal attention" href="/partner/renewals" alert/>
     <AttentionRow label="Overdue renewals" count={Number(renewals.overdue_count)} detail="Renewals past expiry" href="/partner/renewals" alert/>
     <AttentionRow label="Active claims" count={Number(claims.active_claims)} detail="Claims currently in process" href="/partner/claims"/>
     <AttentionRow label="Assistance requested" count={Number(claims.assistance_requested)} detail="Claims awaiting assistance" href="/partner/claims"/>
    </div></article>
   </section>
   <section className="ov-grid ov-grid--bottom">
    <article className="ov-card ov-section"><div className="ov-section-head"><h2>Business Mix</h2><span className="text-[10px] text-[#667085]">Authorized business category</span></div>
     <div className="ov-mix"><div className="ov-mix-head"><span>#</span><span>Business</span><span>Gross Premium</span><span>Policies</span><span>Share</span></div>
     {performance.business_mix.map((row,index)=><div key={row.label+index} className="ov-mix-row"><span>{index+1}</span><span className="ov-mix-insurer"><strong>{row.label}</strong></span><span className="ov-mix-bar-wrap"><span className="ov-mix-value-label">{compactMoney(row.premium)}</span><i style={{width:`${Math.max(4,Number(row.premium)/maxMix*100)}%`}}/></span><span className="ov-mix-policy-count">{number(row.policies)}</span><span>{totalMix?(Number(row.premium)/totalMix*100).toFixed(1):"0"}%</span></div>)}
     {!performance.business_mix.length?<div className="r2-empty">No business mix available</div>:null}
     </div>
    </article>
    <article className="ov-card ov-section"><div className="ov-section-head"><h2>Renewal Opportunity</h2><Link href="/partner/renewals" className="ov-view-link">View renewals <ArrowRight className="h-3 w-3"/></Link></div>
      <div className="space-y-2 px-4 py-4">{[["Overdue",renewals.overdue_count],["Due 0–7 days",renewals.due_0_7_count],["Due 8–15 days",renewals.due_8_15_count],["Due 16–30 days",renewals.due_16_30_count]].map(([label,value])=><div key={String(label)} className="flex items-center justify-between border-b border-[#e6ebf2] py-2 text-[12px]"><span className="text-[#526780]">{label}</span><strong className="text-[#183d6b]">{number(value)}</strong></div>)}</div>
    </article>
   </section>
   <section className="ov-card ov-section ov-recent"><div className="ov-section-head"><h2>Recent / filtered records</h2><Link href="/partner/reports/portfolio" className="ov-view-link">View all <ArrowRight className="h-3 w-3"/></Link></div>
    <div className="ov-table-wrap"><table className="ov-table"><thead><tr><th>Customer</th><th>Policy</th><th>Insurer</th><th>Status</th><th className="ov-num">Premium (₹)</th></tr></thead><tbody>
      {recent.map(row=><tr key={row.policy_id}><td><strong>{row.customer_name||"—"}</strong></td><td>{row.policy_no||"—"}</td><td><span className="ov-insurer-cell">{getInsurerLogo(row.insurer_name||"")?<Image src={getInsurerLogo(row.insurer_name||"")!} alt="" width={18} height={18} className="ov-insurer-logo"/>:null}{row.insurer_name||"—"}</span></td><td>{row.lifecycle_status||"—"}</td><td className="ov-num">{row.premium_amount==null?"—":money(row.premium_amount)}</td></tr>)}
      {!recent.length?<tr><td colSpan={5} className="r2-empty">No policy records in your reporting scope</td></tr>:null}
    </tbody></table></div>
   </section>
   {payout.available && canShowPayout?<section className="ov-card ov-section p-3"><h2 className="text-[12px] font-bold">Authorized partner payout</h2><p className="text-[11px] text-slate-600">Recorded {money(payout.recorded_amount)} · Pending {money(payout.pending_amount)}</p></section>:null}
  </div>
 </PartnerReportsShell>;
}
