import { NextRequest } from "next/server";
import { requireCapability } from "@/lib/master-data-server";
import { loadClaimsReport, type ClaimsQuery } from "@/lib/reports/claims";

export async function GET(request:NextRequest){
  const profile=await requireCapability("view_reports"); const base=toQuery(request.nextUrl.searchParams);
  try{
    const first=await loadClaimsReport(profile,{...base,page:"1"}); const total=first.report.register.total_count;
    if(total>10000)return new Response("This export contains more than 10,000 rows. Narrow the report filters before exporting.",{status:422,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
    const rows=[...first.report.register.rows]; const pages=Math.ceil(total/Math.max(first.report.register.page_size,1));
    for(let page=2;page<=pages;page++){const next=await loadClaimsReport(profile,{...base,page:String(page)});rows.push(...next.report.register.rows)}
    const headers=["Created","Claim No","Customer","Customer Code","Vehicle No","Policy No","Insurance Company","Status","Service Mode","Age Days","Estimated Loss","Approved Amount","Settlement Amount","Documents","Pending Documents","Rejected Documents","RM","Intermediary Code"];
    const lines=[headers.map(csvCell).join(",")];
    for(const row of rows)lines.push([row.created_at,row.claim_no,row.customer_name,row.customer_code,row.vehicle_no,row.policy_no,row.insurer_name,row.status,row.service_mode??"",row.age_days,row.estimated_loss,row.approved_amount,row.settlement_amount,row.document_count,row.pending_documents,row.rejected_documents,row.rm_name,row.intermediary_code].map(csvCell).join(","));
    return new Response(`\uFEFF${lines.join("\r\n")}`,{status:200,headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="insureit-claims-${indiaDate(new Date())}.csv"`,"Cache-Control":"private, no-store, max-age=0"}});
  }catch(error){console.error("[reports-export] claims export failed",error instanceof Error?error.message:"unknown error");return new Response("The report export is temporarily unavailable.",{status:500,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}})}
}
function toQuery(search:URLSearchParams):ClaimsQuery{return{period:search.get("period")??undefined,from:search.get("from")??undefined,to:search.get("to")??undefined,insurer:search.get("insurer")??undefined,status:search.get("status")??undefined,mode:search.get("mode")??undefined}}
function csvCell(value:unknown){const text=value==null?"":String(value);return `"${text.replace(/"/g,'""')}"`}
function indiaDate(date:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(date)}
