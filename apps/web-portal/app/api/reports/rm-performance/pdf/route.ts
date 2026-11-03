import { NextRequest, NextResponse } from "next/server";
import { requireCapability } from "@/lib/master-data-server";
import { buildRmPerformancePdf } from "@/lib/rm-performance-pdf";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
  const profile=await requireCapability("view_reports");
  if(!profile)return NextResponse.json({error:"Access denied"},{status:403});
  const url=request.nextUrl.searchParams;
  try{
    const {bytes,filename}=await buildRmPerformancePdf(profile,{rm:url.get("rm")??undefined,period:url.get("period")??undefined,from:url.get("from")??undefined,to:url.get("to")??undefined});
    const disposition=request.nextUrl.searchParams.get("inline")==="1"?"inline":"attachment";
    return new NextResponse(Buffer.from(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`${disposition}; filename="${filename}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch{return NextResponse.json({error:"Report could not be generated."},{status:500});}
}
