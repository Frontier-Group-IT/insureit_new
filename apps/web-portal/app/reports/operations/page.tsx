import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { AppShell } from "@/components/shell";
import { ReportExportLink, ReportPageShell } from "@/components/reports/report-page-shell";
import { OperationsReportFilters } from "@/components/reports/operations-report-filters";
import { OperationsInteractiveChart, type OperationsInteractiveVariant } from "@/components/reports/operations-interactive-chart";
import { requireCapability } from "@/lib/master-data-server";
import { getVehicleBrandLogo } from "@/lib/vehicle-brand-logo";
import { emptyOperationsReport, loadOperationsReport, type OperationsFilters, type OperationsQuery, type OperationsReport, type OperationsRow } from "@/lib/reports/operations";

export const dynamic="force-dynamic";
export const revalidate=0;
type Props={searchParams:Promise<OperationsQuery>};
type ChartRow={key:string;label:string;missing:number;expired:number;due:number};

export default async function OperationsReportsPage({searchParams}:Props){
  const profile=await requireCapability("view_reports");
  const query=await searchParams;
  let payload:Awaited<ReturnType<typeof loadOperationsReport>>|null=null;
  let allRows:OperationsRow[]=[];
  let loadError=false;

  try{
    payload=await loadOperationsReport(profile,{...query,page:"1"},200);
    allRows=[...payload.report.register.rows];
    const pages=Math.max(1,Math.ceil(payload.report.register.total_count/Math.max(payload.report.register.page_size,1)));
    for(let page=2;page<=pages;page++){
      const next=await loadOperationsReport(profile,{...query,page:String(page)},200);
      allRows.push(...next.report.register.rows);
    }
  }catch(error){
    console.error("[reports] operations report failed",error instanceof Error?error.message:"unknown error");
    loadError=true;
  }

  const report=payload?.report??emptyOperationsReport();
  const filters=payload?.filters??fallbackFilters();
  const exportHref=href("/reports/export/operations",filters);
  const complianceRows=buildComplianceRows(report);
  const complianceByException=buildComplianceByException(report);
  const agingRows=buildExpiryAging(allRows);
  const agingByDocument=buildExpiryByDocument(allRows);
  const exceptionMix=buildExceptionMix(report,allRows);
  const registerRows=allRows.slice(0,6);

  return <AppShell title="Reports"><ReportPageShell
    title="Operations"
    loadError={loadError}
    actions={<ReportExportLink href={exportHref}/>}
    controls={<OperationsReportFilters horizonDays={filters.horizonDays} exception={filters.exception}/>}
  >
    <div className="operations-ref">
      <section className="operations-kpis operations-card">
        <Kpi label="Vehicles" value={integer(report.summary.vehicle_count)} note="Current vehicle portfolio"/>
        <Kpi label="AuthBridge Verified" value={integer(report.summary.authbridge_verified_count)} note="Verified vehicle records"/>
        <Kpi label="Missing Compliance" value={integer(report.summary.vehicles_missing_compliance_data)} note="Vehicles with missing data"/>
        <Kpi label="Missing Fields" value={integer(report.summary.missing_compliance_fields)} note="Compliance fields missing"/>
        <Kpi label="Expired Documents" value={integer(report.summary.expired_document_count)} note="Expired compliance documents"/>
        <Kpi label={`Due ≤ ${filters.horizonDays}d`} value={integer(report.summary.due_document_count)} note="Due within selected horizon"/>
      </section>

      <section className="operations-grid">
        <article className="operations-card">
          <OperationsInteractiveChart title="Compliance Status" defaultId="document" variants={complianceChartVariants(complianceRows,complianceByException)}/>
        </article>
        <article className="operations-card">
          <OperationsInteractiveChart title="Document Expiry Aging" defaultId="aging" variants={agingChartVariants(agingRows,agingByDocument)}/>
        </article>
      </section>

      <section className="operations-grid">
        <article className="operations-card">
          <CardHead title="Compliance by Document"/>
          <ComplianceBars rows={report.compliance}/>
        </article>
        <article className="operations-card">
          <CardHead title="Vehicle Exception Mix"/>
          <ExceptionMix rows={exceptionMix}/>
        </article>
      </section>

      <section className="operations-card">
        <CardHead title="Customer Documents"/>
        <div className="operations-customer-docs">
          <MiniMetric label="Documents" value={report.customer_documents.document_count}/>
          <MiniMetric label="Verified" value={report.customer_documents.verified_count}/>
          <MiniMetric label="Pending" value={report.customer_documents.pending_count}/>
          <MiniMetric label="Rejected" value={report.customer_documents.rejected_count}/>
          <MiniMetric label="Customers with Exceptions" value={report.customer_documents.customers_with_exceptions}/>
        </div>
      </section>

      <section className="operations-card operations-register">
        <div className="operations-register-head">
          <strong>Vehicle Exception Register</strong>
          <Link className="operations-view-all" href={href("/reports/operations",filters)}>View all <ArrowRight className="h-3.5 w-3.5"/></Link>
        </div>
        <Register rows={registerRows}/>
      </section>
    </div>
  </ReportPageShell></AppShell>;
}

function Kpi({label,value,note}:{label:string;value:string;note:string}){
  return <article className="operations-kpi">
    <div className="operations-kpi-label">{label}<Info className="h-3 w-3"/></div>
    <div className="operations-kpi-value">{value}</div>
    <div className="operations-kpi-note">{note}</div>
  </article>;
}

function MiniMetric({label,value}:{label:string;value:number}){
  return <div className="operations-mini"><span>{label}</span><strong>{integer(value)}</strong></div>;
}

function CardHead({title,action}:{title:string;action?:string}){
  return <div className="operations-card-head"><h2>{title}</h2>{action?<button type="button">{action} <span>⌄</span></button>:null}</div>;
}

function ComplianceBars({rows}:{rows:OperationsReport["compliance"]}){
  if(!rows.length)return <div className="operations-empty">No compliance data available</div>;
  const max=Math.max(...rows.map(r=>r.vehicle_count),1);
  return <div className="operations-status">
    <div className="operations-status-head"><span>#</span><span>Document</span><span>Coverage / Exceptions</span><span>Missing</span></div>
    {rows.map((row,index)=>{
      const complete=Math.max(0,row.vehicle_count-row.missing_count);
      return <div className="operations-status-row" key={row.label}>
        <span>{index+1}</span>
        <strong>{row.label}</strong>
        <div className="operations-status-bar"><i style={{width:`${Math.max(4,(complete/max)*100)}%`}}/><em>{integer(complete)}</em></div>
        <span>{integer(row.missing_count)}</span>
      </div>;
    })}
  </div>;
}

function ExceptionMix({rows}:{rows:Array<{label:string;count:number}>}){
  const max=Math.max(...rows.map(r=>r.count),1);
  return <div className="operations-status">
    <div className="operations-status-head"><span>#</span><span>Exception</span><span>Vehicles</span><span>Count</span></div>
    {rows.map((row,index)=><div className="operations-status-row" key={row.label}>
      <span>{index+1}</span>
      <strong>{row.label}</strong>
      <div className="operations-status-bar"><i style={{width:`${Math.max(4,(row.count/max)*100)}%`}}/><em>{integer(row.count)}</em></div>
      <span>{integer(row.count)}</span>
    </div>)}
  </div>;
}

function Register({rows}:{rows:OperationsRow[]}){
  if(!rows.length)return <div className="operations-empty">No vehicle exception records available</div>;
  return <div className="operations-table-wrap"><table className="operations-table"><thead><tr><th>Vehicle</th><th>Customer</th><th>Exception</th><th>AuthBridge</th><th>Nearest Expiry</th><th>Make / Model</th><th/></tr></thead><tbody>
    {rows.map(row=>{const logo=getVehicleBrandLogo(row.make);return <tr key={row.id}>
      <td><span className="operations-vehicle">{logo?<Image src={logo} alt="" width={20} height={20}/>:null}<strong>{row.vehicle_no||"—"}</strong></span></td>
      <td><strong>{row.customer_name}</strong><small>{row.customer_code}</small></td>
      <td><span className={exceptionClass(row)}>{exceptionLabel(row)}</span></td>
      <td>{row.authbridge_verified?"Verified":"Unverified"}</td>
      <td>{date(row.nearest_expiry_date)}</td>
      <td>{[row.make,row.model].filter(Boolean).join(" · ")||"—"}</td>
      <td className="arrow"><Link href={`/vehicles/${row.id}`}><ArrowRight className="h-3.5 w-3.5"/></Link></td>
    </tr>})}
  </tbody></table></div>;
}

function buildComplianceRows(report:OperationsReport):ChartRow[]{
  return report.compliance.map((row,index)=>({key:String(index),label:shortLabel(row.label),missing:row.missing_count,expired:row.expired_count,due:row.due_count}));
}

function buildComplianceByException(report:OperationsReport){
  const missing=report.compliance.reduce((sum,row)=>sum+row.missing_count,0);
  const expired=report.compliance.reduce((sum,row)=>sum+row.expired_count,0);
  const due=report.compliance.reduce((sum,row)=>sum+row.due_count,0);
  return [
    {key:"missing",label:"Missing",count:missing},
    {key:"expired",label:"Expired",count:expired},
    {key:"due",label:"Due",count:due},
  ];
}

function buildExceptionMix(report:OperationsReport,rows:OperationsRow[]){
  return [
    {label:"Missing Compliance",count:report.summary.vehicles_missing_compliance_data},
    {label:"Expired Documents",count:rows.filter(r=>r.expired_compliance_count>0).length},
    {label:"Due in Horizon",count:rows.filter(r=>r.due_compliance_count>0).length},
    {label:"AuthBridge Unverified",count:report.summary.authbridge_unverified_count},
  ];
}

function buildExpiryAging(rows:OperationsRow[]){
  const today=indiaStart();
  const defs=[
    {key:"expired",label:"Expired",min:Number.NEGATIVE_INFINITY,max:-1},
    {key:"0_30",label:"0 – 30 days",min:0,max:30},
    {key:"31_60",label:"31 – 60 days",min:31,max:60},
    {key:"61_90",label:"61 – 90 days",min:61,max:90},
    {key:"90_plus",label:"90+ days",min:91,max:Number.POSITIVE_INFINITY},
  ];
  const dates:string[]=[];
  for(const row of rows){
    for(const value of [row.fitness_expiry_date,row.puc_expiry_date,row.road_tax_expiry_date,row.national_permit_expiry_date,row.local_permit_expiry_date])if(value)dates.push(value);
  }
  return defs.map(def=>({key:def.key,label:def.label,count:dates.filter(value=>{const days=daysFrom(today,value);return days>=def.min&&days<=def.max}).length}));
}

function buildExpiryByDocument(rows:OperationsRow[]){
  const defs=[
    {key:"fitness",label:"Fitness",pick:(row:OperationsRow)=>row.fitness_expiry_date},
    {key:"puc",label:"PUC",pick:(row:OperationsRow)=>row.puc_expiry_date},
    {key:"road_tax",label:"Road Tax",pick:(row:OperationsRow)=>row.road_tax_expiry_date},
    {key:"national",label:"National",pick:(row:OperationsRow)=>row.national_permit_expiry_date},
    {key:"local",label:"Local",pick:(row:OperationsRow)=>row.local_permit_expiry_date},
  ];
  return defs.map(def=>({key:def.key,label:def.label,count:rows.filter(row=>Boolean(def.pick(row))).length}));
}

function complianceChartVariants(byDocument:ChartRow[],byException:Array<{key:string;label:string;count:number}>):OperationsInteractiveVariant[]{
  return [
    {
      id:"document",
      label:"By Document",
      series:["Missing","Expired","Due"],
      rows:byDocument.map(row=>({key:row.key,label:row.label,values:[row.missing,row.expired,row.due]})),
    },
    {
      id:"exception",
      label:"By Exception Type",
      series:["Documents"],
      rows:byException.map(row=>({key:row.key,label:row.label,values:[row.count]})),
    },
  ];
}

function agingChartVariants(byAging:Array<{key:string;label:string;count:number}>,byDocument:Array<{key:string;label:string;count:number}>):OperationsInteractiveVariant[]{
  return [
    {
      id:"aging",
      label:"By Expiry Bucket",
      series:["Documents (Count)"],
      rows:byAging.map(row=>({key:row.key,label:row.label,values:[row.count]})),
    },
    {
      id:"document",
      label:"By Document",
      series:["Documents with Expiry Date"],
      rows:byDocument.map(row=>({key:row.key,label:row.label,values:[row.count]})),
    },
  ];
}

function exceptionLabel(row:OperationsRow){
  if(row.expired_compliance_count>0)return"Expired";
  if(row.due_compliance_count>0)return"Due";
  if(row.missing_compliance_count>0)return"Missing";
  if(!row.authbridge_verified)return"Unverified";
  return"Clear";
}

function exceptionClass(row:OperationsRow){
  const label=exceptionLabel(row);
  if(label==="Expired")return"operations-pill operations-pill-red";
  if(label==="Due")return"operations-pill operations-pill-amber";
  if(label==="Missing")return"operations-pill operations-pill-orange";
  if(label==="Unverified")return"operations-pill operations-pill-blue";
  return"operations-pill operations-pill-green";
}

function shortLabel(value:string){return value.replace("National permit","National").replace("Local permit","Local").replace("Road tax","Road Tax")}
function indiaStart(){const ymd=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());return new Date(`${ymd}T00:00:00+05:30`)}
function daysFrom(today:Date,value:string){const d=new Date(`${value}T00:00:00+05:30`);return Math.floor((d.getTime()-today.getTime())/86400000)}
function href(path:string,f:OperationsFilters){const s=new URLSearchParams();s.set("horizon",String(f.horizonDays));if(f.exception)s.set("exception",f.exception);return `${path}?${s}`}
function date(v:string|null){if(!v)return"—";const d=new Date(`${v}T00:00:00+05:30`);return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(d)}
function integer(v:number){return new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(v||0)}
function fallbackFilters():OperationsFilters{return{horizonDays:90,exception:null,page:1}}
