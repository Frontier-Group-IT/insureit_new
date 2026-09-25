import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { PortfolioInteractiveChart, type PortfolioChartVariant } from "@/components/reports/portfolio-interactive-chart";
import { AppShell } from "@/components/shell";
import { ReportQueryShortcuts } from "@/components/reports/report-query-shortcuts";
import { ReportCompactFilters } from "@/components/reports/report-compact-filters";
import { ReportExportLink, ReportPageShell } from "@/components/reports/report-page-shell";
import { getInsurerLogo } from "@/lib/insurer-logo";
import { requireCapability } from "@/lib/master-data-server";
import { emptyClaimsReport, loadClaimsReport, type ClaimsReport, type ClaimsRow } from "@/lib/reports/claims";
import { loadRenewalReport, type RenewalBucket, type RenewalFilters, type RenewalQuery, type RenewalReport, type RenewalRow } from "@/lib/reports/renewals";

export const dynamic="force-dynamic";
export const revalidate=0;

const HORIZONS=[{value:"30",label:"30 days"},{value:"60",label:"60 days"},{value:"90",label:"90 days"},{value:"180",label:"180 days"},{value:"365",label:"365 days"}] as const;
type Props={searchParams:Promise<RenewalQuery&{register?:string}>};
type ChartRow={key:string;label:string;count:number;amount:number;secondary:number};

export default async function RenewalReportsPage({searchParams}:Props){
  const profile=await requireCapability("view_reports");
  const query=await searchParams;
  let renewalPayload:Awaited<ReturnType<typeof loadRenewalReport>>|null=null;
  let claimsReport:ClaimsReport=emptyClaimsReport();
  let claimRows:ClaimsRow[]=[];
  let loadError=false;

  try{
    const [renewal,claims]=await Promise.all([
      loadRenewalReport(profile,query),
      loadClaimsReport(profile,{period:"all"},200),
    ]);
    renewalPayload=renewal;
    claimsReport=claims.report;
    claimRows=[...claims.report.register.rows];

    const claimPages=Math.max(1,Math.ceil(claims.report.register.total_count/Math.max(claims.report.register.page_size,1)));
    for(let page=2;page<=claimPages;page++){
      const next=await loadClaimsReport(profile,{period:"all",page:String(page)},200);
      claimRows.push(...next.report.register.rows);
    }
  }catch(error){
    console.error("[reports] portfolio dashboard failed",error instanceof Error?error.message:"unknown error");
    loadError=true;
  }

  const report=renewalPayload?.report??emptyRenewalReport();
  const filters=renewalPayload?.filters??fallbackFilters();
  const registerTab=query.register==="claims"?"claims":"renewals";
  const exportHref=href("/reports/export/renewals",filters);
  const renewalPipeline=buildRenewalPipeline(report);
  const renewalByInsurer=buildRenewalByInsurer(report);
  const renewalByRm=buildRenewalByRm(report);
  const claimsAging=buildClaimsAging(claimRows);
  const claimsByStatus=buildClaimsByStatus(claimsReport);
  const claimsByInsurer=buildClaimsByInsurer(claimsReport);
  const claimStatuses=buildClaimStatuses(claimsReport);
  const insurerExposure=buildInsurerExposure(report,claimsReport);
  const claimExposure=claimsReport.summary.estimated_loss;
  const renewalRows=report.register.rows.slice(0,5);
  const claimsRows=claimRows.slice(0,5);

  return <AppShell title="Reports"><ReportPageShell
    title="Portfolio"
    loadError={loadError}
    actions={<ReportExportLink href={exportHref}/>}
    controls={<ReportQueryShortcuts
      label="Horizon"
      param="horizon"
      activeValue={String(filters.horizonDays)}
      options={HORIZONS}
      showActiveFilterCount={false}
      trailing={<ReportCompactFilters
        path="/reports/renewals"
        businessLine={filters.businessLine}
        category={filters.category}
        categories={report.filters.categories}
        period=""
        fromDate={null}
        toDate={null}
        fields={[
          {name:"insurer",label:"Insurance company",value:filters.insurerId??"",options:report.filters.insurers.map((x)=>({value:x.id,label:x.name}))},
          {name:"rm",label:"Relationship manager",value:filters.rmEmployeeId??"",options:report.filters.rms.map((x)=>({value:x.id,label:x.name}))},
          {name:"intermediary",label:"Partner / intermediary",value:filters.intermediaryCode??"",options:report.filters.intermediaries.map((x)=>({value:x.code,label:x.name!==x.code?`${x.name} · ${x.code}`:x.name}))},
        ]}
      />}
    />}
  >
    <div className="portfolio-ref">
      <section className="portfolio-kpis portfolio-card">
        <Kpi label="Active Policies" value={integer(report.summary.upcoming_policy_count)} note="Current renewal portfolio"/>
        <Kpi label="Renewal Premium at Risk" value={compactMoney(report.summary.premium_at_risk)} note="Current renewal horizon"/>
        <Kpi label="Renewals 30d" value={integer(report.summary.due_30_count)} note="Due in next 30 days"/>
        <Kpi label="Open Claims" value={integer(claimsReport.summary.open_claim_count)} note="Current open claims"/>
        <Kpi label="Claim Exposure" value={compactMoney(claimExposure)} note="Estimated loss exposure"/>
        <Kpi label="Avg Claim Age" value={integer(claimsReport.summary.average_open_age_days)+" days"} note="Open claims"/>
      </section>

      <section className="portfolio-grid portfolio-grid-top">
        <article className="portfolio-card">
          <PortfolioInteractiveChart title="Renewal Pipeline" defaultId="bucket" variants={renewalChartVariants(renewalPipeline,renewalByInsurer,renewalByRm)}/>
        </article>
        <article className="portfolio-card">
          <PortfolioInteractiveChart title="Claims Aging" defaultId="aging" variants={claimsChartVariants(claimsAging,claimsByStatus,claimsByInsurer)}/>
        </article>
      </section>

      <section className="portfolio-grid portfolio-grid-bottom">
        <article className="portfolio-card">
          <div className="portfolio-card-head"><h2>Claim Status</h2></div>
          <ClaimStatus rows={claimStatuses}/>
        </article>
        <article className="portfolio-card">
          <PortfolioInteractiveChart title="Portfolio Exposure by Insurer" defaultId="top5" variants={insurerExposureVariants(insurerExposure)}/>
        </article>
      </section>

      <section className="portfolio-card portfolio-register">
        <div className="portfolio-register-head">
          <div className="portfolio-register-tabs">
            <Link className={registerTab==="renewals"?"active":""} href={registerHref(filters,"renewals")}>Renewals Register</Link>
            <Link className={registerTab==="claims"?"active":""} href={registerHref(filters,"claims")}>Claims Register</Link>
          </div>
          <Link className="portfolio-view-all" href={registerTab==="claims"?"/reports/claims":"/reports/renewals"}>View all <ArrowRight className="h-3.5 w-3.5"/></Link>
        </div>
        {registerTab==="renewals"?<RenewalRegister rows={renewalRows}/>:<ClaimsRegister rows={claimsRows}/>}
      </section>
    </div>
  </ReportPageShell></AppShell>;
}

function Kpi({label,value,note}:{label:string;value:string;note:string}){
  return <article className="portfolio-kpi">
    <div className="portfolio-kpi-label">{label}<Info className="h-3 w-3"/></div>
    <div className="portfolio-kpi-value">{value}</div>
    <div className="portfolio-kpi-note">{note}</div>
  </article>;
}

function ClaimStatus({rows}:{rows:Array<{status:string;count:number;share:number}>}){
  if(!rows.length)return <div className="portfolio-empty">No claim status data available</div>;
  const max=Math.max(...rows.map(x=>x.count),1);
  return <div className="portfolio-status">
    <div className="portfolio-status-head"><span>#</span><span>Status</span><span>Claims (Count)</span><span>Share</span></div>
    {rows.map((row,index)=><div className="portfolio-status-row" key={row.status}>
      <span>{index+1}</span>
      <strong>{pretty(row.status)}</strong>
      <div className="portfolio-status-bar"><i style={{width:`${Math.max(4,(row.count/max)*100)}%`}}/><em>{integer(row.count)}</em></div>
      <span>{row.share.toFixed(1)}%</span>
    </div>)}
  </div>;
}

function RenewalRegister({rows}:{rows:RenewalRow[]}){
  if(!rows.length)return <div className="portfolio-empty">No renewal records available</div>;
  return <div className="portfolio-table-wrap"><table className="portfolio-table"><thead><tr><th>Expiry Date</th><th>Customer / Risk</th><th>Insurer</th><th>Status / Bucket</th><th className="num">Premium at Risk (₹)</th><th>Policy #</th><th/></tr></thead><tbody>
    {rows.map(row=><tr key={row.id}>
      <td>{date(row.end_date)}</td>
      <td><strong>{row.customer_name}</strong><small>{row.risk_reference||row.vehicle_no||"—"}</small></td>
      <td><InsurerCell name={row.insurer_name}/></td>
      <td><span className={bucketClass(row.renewal_bucket)}>{bucketLabel(row.renewal_bucket)}</span></td>
      <td className="num">{currency(row.net_premium)}</td>
      <td>{row.policy_no}</td>
      <td className="arrow"><Link href={`/policies/${row.id}`}><ArrowRight className="h-3.5 w-3.5"/></Link></td>
    </tr>)}
  </tbody></table></div>;
}

function ClaimsRegister({rows}:{rows:ClaimsRow[]}){
  if(!rows.length)return <div className="portfolio-empty">No claim records available</div>;
  return <div className="portfolio-table-wrap"><table className="portfolio-table"><thead><tr><th>Claim Date</th><th>Customer / Risk</th><th>Insurer</th><th>Status</th><th className="num">Exposure (₹)</th><th>Claim #</th><th/></tr></thead><tbody>
    {rows.map(row=><tr key={row.id}>
      <td>{dateTime(row.accident_at||row.created_at)}</td>
      <td><strong>{row.customer_name}</strong><small>{row.vehicle_no||row.policy_no||"—"}</small></td>
      <td><InsurerCell name={row.insurer_name}/></td>
      <td><span className="portfolio-pill portfolio-pill-blue">{pretty(row.status)}</span></td>
      <td className="num">{currency(row.estimated_loss)}</td>
      <td>{row.claim_no||"—"}</td>
      <td className="arrow"><Link href={`/claims/${row.id}`}><ArrowRight className="h-3.5 w-3.5"/></Link></td>
    </tr>)}
  </tbody></table></div>;
}

function InsurerCell({name}:{name:string}){
  const logo=getInsurerLogo(name);
  return <span className="portfolio-insurer">{logo?<Image src={logo} alt="" width={20} height={20} className="portfolio-insurer-logo"/>:null}<span>{name||"Unassigned"}</span></span>;
}

function buildRenewalPipeline(report:RenewalReport):ChartRow[]{
  const map=new Map(report.buckets.map(x=>[x.key,x]));
  const get=(key:RenewalBucket)=>map.get(key)??{policy_count:0,net_premium:0};
  const expired=get("expired"),d30=get("due_30"),d60=get("due_31_60"),d90=get("due_61_90"),d180=get("due_91_180"),d365=get("due_181_365");
  return [
    row("expired","Expired",expired.policy_count,expired.net_premium),
    row("0_30","0 – 30 days",d30.policy_count,d30.net_premium),
    row("31_60","31 – 60 days",d60.policy_count,d60.net_premium),
    row("61_90","61 – 90 days",d90.policy_count,d90.net_premium),
    row("90_plus","90+ days",d180.policy_count+d365.policy_count,d180.net_premium+d365.net_premium),
  ];
}

function buildRenewalByInsurer(report:RenewalReport):ChartRow[]{
  return report.insurers
    .map((item,index)=>row(item.id??`insurer-${index}`,shortName(item.insurer_name),item.upcoming_policy_count,item.premium_at_risk))
    .sort((a,b)=>b.amount-a.amount)
    .slice(0,5);
}

function buildRenewalByRm(report:RenewalReport):ChartRow[]{
  return report.rms
    .map((item,index)=>row(`rm-${index}`,item.rm_name||"Unassigned",item.upcoming_policy_count,item.premium_at_risk))
    .sort((a,b)=>b.amount-a.amount)
    .slice(0,5);
}

function buildClaimsAging(rows:ClaimsRow[]):ChartRow[]{
  const defs=[
    {key:"0_7",label:"0 – 7 days",min:0,max:7},
    {key:"8_15",label:"8 – 15 days",min:8,max:15},
    {key:"16_30",label:"16 – 30 days",min:16,max:30},
    {key:"31_60",label:"31 – 60 days",min:31,max:60},
    {key:"60_plus",label:"60+ days",min:61,max:Number.POSITIVE_INFINITY},
  ];
  return defs.map(def=>{
    const matches=rows.filter(r=>r.age_days>=def.min&&r.age_days<=def.max);
    return row(def.key,def.label,matches.length,matches.reduce((sum,r)=>sum+(r.estimated_loss||0),0));
  });
}

function buildClaimsByStatus(report:ClaimsReport):ChartRow[]{
  return [...report.statuses]
    .map((item,index)=>row(`status-${index}`,pretty(item.status),item.claim_count,item.estimated_loss))
    .sort((a,b)=>b.count-a.count)
    .slice(0,5);
}

function buildClaimsByInsurer(report:ClaimsReport):ChartRow[]{
  return [...report.insurers]
    .map((item,index)=>row(item.id??`claim-insurer-${index}`,shortName(item.insurer_name),item.claim_count,item.estimated_loss))
    .sort((a,b)=>b.count-a.count)
    .slice(0,5);
}

function buildClaimStatuses(report:ClaimsReport){
  const total=Math.max(report.statuses.reduce((sum,row)=>sum+row.claim_count,0),1);
  return [...report.statuses].sort((a,b)=>b.claim_count-a.claim_count).slice(0,5).map(x=>({status:x.status,count:x.claim_count,share:(x.claim_count/total)*100}));
}

function buildInsurerExposure(renewals:RenewalReport,claims:ClaimsReport):ChartRow[]{
  const map=new Map<string,{name:string;renewal:number;claims:number}>();
  for(const r of renewals.insurers){const key=r.insurer_name.trim().toLowerCase();map.set(key,{name:r.insurer_name||"Unassigned",renewal:r.premium_at_risk||0,claims:0});}
  for(const c of claims.insurers){const key=c.insurer_name.trim().toLowerCase();const current=map.get(key)??{name:c.insurer_name||"Unassigned",renewal:0,claims:0};current.claims+=c.estimated_loss||0;map.set(key,current);}
  return [...map.entries()].map(([key,v])=>({key,label:shortName(v.name),count:0,amount:v.renewal/100000,secondary:v.claims/100000})).sort((a,b)=>(b.amount+b.secondary)-(a.amount+a.secondary));
}

function renewalChartVariants(bucket:ChartRow[],insurer:ChartRow[],rm:ChartRow[]):PortfolioChartVariant[]{
  return [
    chartVariant("bucket","By Renewal Bucket",bucket,"Policies (Count)","Premium at Risk (₹ L)","count","number"),
    chartVariant("insurer","By Insurer",insurer,"Policies (Count)","Premium at Risk (₹ L)","count","number"),
    chartVariant("rm","By RM",rm,"Policies (Count)","Premium at Risk (₹ L)","count","number"),
  ];
}

function claimsChartVariants(aging:ChartRow[],status:ChartRow[],insurer:ChartRow[]):PortfolioChartVariant[]{
  return [
    chartVariant("aging","By Aging Bucket",aging,"Claims (Count)","Exposure (₹ L)","count","number"),
    chartVariant("status","By Claim Status",status,"Claims (Count)","Exposure (₹ L)","count","number"),
    chartVariant("insurer","By Insurer",insurer,"Claims (Count)","Exposure (₹ L)","count","number"),
  ];
}

function insurerExposureVariants(rows:ChartRow[]):PortfolioChartVariant[]{
  return [
    chartVariant("top5","Top 5 Insurers",rows.slice(0,5),"Renewal at Risk (₹ L)","Claim Exposure (₹ L)","number","number","amount","secondary"),
    chartVariant("top10","Top 10 Insurers",rows.slice(0,10),"Renewal at Risk (₹ L)","Claim Exposure (₹ L)","number","number","amount","secondary"),
    chartVariant("all","All Insurers",rows,"Renewal at Risk (₹ L)","Claim Exposure (₹ L)","number","number","amount","secondary"),
  ];
}

function chartVariant(
  id:string,
  label:string,
  rows:ChartRow[],
  primaryLabel:string,
  secondaryLabel:string,
  primaryFormat:"count"|"number",
  secondaryFormat:"count"|"number",
  primaryKey:"count"|"amount"="count",
  secondaryKey:"amount"|"secondary"="amount",
):PortfolioChartVariant{
  return {
    id,
    label,
    primaryLabel,
    secondaryLabel,
    primaryFormat,
    secondaryFormat,
    rows:rows.map((item)=>({key:item.key,label:item.label,primary:item[primaryKey],secondary:item[secondaryKey]})),
  };
}

function row(key:string,label:string,count:number,amount:number):ChartRow{return{key,label,count,amount:amount/100000,secondary:0}}
function compactMoney(v:number){const n=Math.abs(v||0);if(n>=1e7)return "₹"+new Intl.NumberFormat("en-IN",{maximumFractionDigits:1}).format(n/1e7)+"Cr";if(n>=1e5)return "₹"+new Intl.NumberFormat("en-IN",{maximumFractionDigits:1}).format(n/1e5)+"L";return currency(n)}
function shortName(name:string){const cleaned=name.replace(/General Insurance Company Limited|Insurance Company Limited|General Insurance Co\. Limited|Limited/gi,"").trim();return cleaned.split(" ").slice(0,2).join(" ")||name}
function pretty(value:string){return value.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase())}
function bucketLabel(key:RenewalBucket){return ({expired:"Expired",due_30:"0 – 30 days",due_31_60:"31 – 60 days",due_61_90:"61 – 90 days",due_91_180:"91 – 180 days",due_181_365:"181 – 365 days"} as Record<RenewalBucket,string>)[key]}
function bucketClass(key:RenewalBucket){if(key==="due_30")return"portfolio-pill portfolio-pill-green";if(key==="due_31_60")return"portfolio-pill portfolio-pill-amber";if(key==="expired")return"portfolio-pill portfolio-pill-red";return"portfolio-pill portfolio-pill-orange"}
function registerHref(f:RenewalFilters,tab:"renewals"|"claims"){const p=new URLSearchParams();p.set("horizon",String(f.horizonDays));if(f.insurerId)p.set("insurer",f.insurerId);if(f.rmEmployeeId)p.set("rm",f.rmEmployeeId);if(f.intermediaryCode)p.set("intermediary",f.intermediaryCode);if(f.businessLine)p.set("business",f.businessLine);if(f.category)p.set("category",f.category);if(tab==="claims")p.set("register","claims");return `/reports/renewals?${p.toString()}`}
function href(base:string,f:RenewalFilters){const p=new URLSearchParams();p.set("horizon",String(f.horizonDays));if(f.insurerId)p.set("insurer",f.insurerId);if(f.rmEmployeeId)p.set("rm",f.rmEmployeeId);if(f.intermediaryCode)p.set("intermediary",f.intermediaryCode);if(f.businessLine)p.set("business",f.businessLine);if(f.category)p.set("category",f.category);return `${base}?${p.toString()}`}
function date(v:string|null){if(!v)return"—";const d=new Date(`${v}T00:00:00+05:30`);return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(d)}
function dateTime(v:string|null){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(d)}
function currency(v:number){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(v||0)}
function integer(v:number){return new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(v||0)}
function emptyRenewalReport():RenewalReport{return{summary:{upcoming_policy_count:0,expired_policy_count:0,due_30_count:0,due_90_count:0,customer_count:0,premium_at_risk:0,premium_due_30:0,nearest_expiry:null},buckets:[],insurers:[],rms:[],filters:{insurers:[],rms:[],intermediaries:[],categories:[]},register:{rows:[],total_count:0,page:1,page_size:25}}}
function fallbackFilters():RenewalFilters{return{horizonDays:365,insurerId:null,rmEmployeeId:null,intermediaryCode:null,businessLine:null,category:null,bucket:null,page:1}}
