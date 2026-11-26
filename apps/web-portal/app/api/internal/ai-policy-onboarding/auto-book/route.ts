import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { autoBookingEnabled,runAutoBookingBatch } from "@/lib/ai-policy-auto-booking-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=180;

function authenticated(request:NextRequest,secret:string){
  if(secret.length<32||secret.length>256)return false;
  const token=request.headers.get("authorization")??"";
  if(!token.startsWith("Bearer "))return false;
  const supplied=Buffer.from(token.slice(7),"utf8");
  const expected=Buffer.from(secret,"utf8");
  return supplied.length===expected.length&&timingSafeEqual(supplied,expected);
}
async function execute(){
  if(!autoBookingEnabled())return NextResponse.json({enabled:false,error:"auto_booking_disabled"},{status:503});
  try{
    const result=await runAutoBookingBatch();
    return NextResponse.json(result,{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    // Report only enumerated control-flow codes. Never log raw error messages,
    // credentials, extracted policy values or session tokens.
    const raw=error instanceof Error?error.message:"";
    const code=/^auto_booking_[a-z0-9_]{1,60}$/.test(raw)?raw:"unexpected_worker_exception";
    console.error("[ai-auto-booking] worker unavailable",{code});
    return NextResponse.json({error:"auto_booking_worker_unavailable"},{status:503});
  }
}
/** Existing Vercel scheduler sends CRON_SECRET in Authorization header. */
export async function GET(request:NextRequest){
  if(!authenticated(request,process.env.CRON_SECRET??""))
    return NextResponse.json({error:"Unauthorized"},{status:401});
  return execute();
}
/** Optional manually initiated service-only scheduler; no user-controlled IDs. */
export async function POST(request:NextRequest){
  if(!authenticated(request,process.env.INSUREIT_AI_AUTO_BOOKING_WORKER_TOKEN??""))
    return NextResponse.json({error:"Unauthorized"},{status:401});
  return execute();
}
