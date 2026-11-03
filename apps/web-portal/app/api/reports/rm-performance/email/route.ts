import { NextRequest, NextResponse } from "next/server";
import { requireCapability } from "@/lib/master-data-server";
import { buildRmPerformancePdf } from "@/lib/rm-performance-pdf";
import { sendResendEmail } from "@/lib/resend-email";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
  const profile=await requireCapability("view_reports");
  if(!profile)return NextResponse.json({error:"Access denied"},{status:403});
  const origin=request.headers.get("origin");
  if(!origin||origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin"},{status:403});
  let input:Record<string,unknown>;
  try{input=await request.json() as Record<string,unknown>;}catch{return NextResponse.json({error:"Invalid input"},{status:400});}
  const recipient=String(input.to??"").trim();
  if(recipient.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))return NextResponse.json({error:"Enter a valid email address."},{status:400});
  const fields=["rm","period","from","to"] as const;
  const query:Record<string,string>={};
  for(const field of fields)if(typeof input[field]==="string")query[field]=String(input[field]).slice(0,80);
  try{
    const {bytes,filename,period}=await buildRmPerformancePdf(profile,query);
    if(bytes.length>10_000_000)return NextResponse.json({error:"Report exceeds email attachment limit; use PDF download."},{status:413});
    await sendResendEmail({to:recipient,subject:"INSUREIT RM Business Performance - "+period,text:"Attached is your authorized INSUREIT RM Business Performance report for Today and "+period+".",idempotencyKey:"rm-report-"+profile.id+"-"+crypto.randomUUID(),attachments:[{filename,content:Buffer.from(bytes).toString("base64")}]});
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({error:"Email could not be sent. Check mail configuration or try downloading the PDF."},{status:503});}
}
