import { NextRequest } from "next/server";
import { requireCapability } from "@/lib/master-data-server";
import { loadRenewalExport, type RenewalQuery } from "@/lib/reports/renewals";

export async function GET(request:NextRequest){
  const profile=await requireCapability("view_reports");
  try{
    const {rows,truncated}=await loadRenewalExport(profile,toQuery(request.nextUrl.searchParams));
    if(truncated)return new Response("This export contains more than 10,000 rows. Narrow the report filters before exporting.",{status:422,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
    const headers=["Expiry Date","Days to Expiry","Bucket","Policy No","Policy Type","Customer","Customer Code","Vehicle No","Insurance Company","Relationship Manager","Intermediary Type","Intermediary Code","Gross Premium","Status"];
    const lines=[headers.map(csv).join(",")];
    for(const r of rows)lines.push([r.end_date,r.days_to_expiry,r.renewal_bucket,r.policy_no,r.policy_type,r.customer_name,r.customer_code,r.vehicle_no,r.insurer_name,r.rm_name,r.intermediary_type??"",r.intermediary_code??"",r.gross_premium,r.status].map(csv).join(","));
    return new Response(`\uFEFF${lines.join("\r\n")}`,{status:200,headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="insureit-renewals-${indiaDate(new Date())}.csv"`,"Cache-Control":"private, no-store, max-age=0"}});
  }catch(error){console.error("[reports-export] renewals failed",error instanceof Error?error.message:"unknown error");return new Response("The report export is temporarily unavailable.",{status:500,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}})}
}
function toQuery(s:URLSearchParams):RenewalQuery{return{horizon:s.get("horizon")??undefined,insurer:s.get("insurer")??undefined,rm:s.get("rm")??undefined,intermediary:s.get("intermediary")??undefined,bucket:s.get("bucket")??undefined}}
function csv(v:unknown){const text=v==null?"":String(v);return `"${text.replace(/"/g,'""')}"`}
function indiaDate(d:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
