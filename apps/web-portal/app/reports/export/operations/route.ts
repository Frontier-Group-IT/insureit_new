import { NextRequest } from "next/server";
import { requireCapability } from "@/lib/master-data-server";
import { loadOperationsReport, type OperationsQuery } from "@/lib/reports/operations";

export async function GET(request:NextRequest){
 const profile=await requireCapability("view_reports"); const base=toQuery(request.nextUrl.searchParams);
 try{
  const first=await loadOperationsReport(profile,{...base,page:"1"}); const total=first.report.register.total_count;
  if(total>10000)return new Response("This export contains more than 10,000 rows. Narrow the report filters before exporting.",{status:422,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  const rows=[...first.report.register.rows]; const pages=Math.ceil(total/Math.max(first.report.register.page_size,1));
  for(let page=2;page<=pages;page++){const next=await loadOperationsReport(profile,{...base,page:String(page)});rows.push(...next.report.register.rows)}
  const headers=["Vehicle No","Customer","Customer Code","Vehicle Type","Make","Model","Registration Status","AuthBridge Verified","Fitness Expiry","PUC Expiry","Road Tax Expiry","National Permit Expiry","Local Permit Expiry","Missing Compliance Fields","Expired Documents","Due Documents","Nearest Expiry"];
  const lines=[headers.map(csvCell).join(",")];
  for(const row of rows)lines.push([row.vehicle_no,row.customer_name,row.customer_code,row.vehicle_type??"",row.make??"",row.model??"",row.registration_status??"",row.authbridge_verified?"Yes":"No",row.fitness_expiry_date??"",row.puc_expiry_date??"",row.road_tax_expiry_date??"",row.national_permit_expiry_date??"",row.local_permit_expiry_date??"",row.missing_compliance_count,row.expired_compliance_count,row.due_compliance_count,row.nearest_expiry_date??""].map(csvCell).join(","));
  return new Response(`\uFEFF${lines.join("\r\n")}`,{status:200,headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="insureit-operations-compliance-${indiaDate(new Date())}.csv"`,"Cache-Control":"private, no-store, max-age=0"}});
 }catch(error){console.error("[reports-export] operations export failed",error instanceof Error?error.message:"unknown error");return new Response("The report export is temporarily unavailable.",{status:500,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}})}
}
function toQuery(search:URLSearchParams):OperationsQuery{return{horizon:search.get("horizon")??undefined,exception:search.get("exception")??undefined}}
function csvCell(value:unknown){const text=value==null?"":String(value);return `"${text.replace(/"/g,'""')}"`}
function indiaDate(date:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(date)}
