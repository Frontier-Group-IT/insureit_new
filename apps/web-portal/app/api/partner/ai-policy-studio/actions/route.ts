import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { withVerifiedPartnerApiToken } from "@/lib/partner-ai-studio-api-context";
import {
  reparseAndReplaceAiPolicyIntakeDraft,
  convertVerifiedAiIntake,
} from "@/app/development/ai-policy-onboarding/actions";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function respond(data:Record<string,unknown>,status=200){
  return NextResponse.json(data,{status,headers:{
    "Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff",
  }});
}

/**
 * This handler is served by the dedicated, path-restricted Windows backend
 * published through the Cloudflare Tunnel, NOT the paused Vercel frontend.
 * It reuses the exact existing canonical website actions and booking engine.
 *
 * No caller may supply editable OCR fields, draft JSON, storage paths,
 * arbitrary n8n URLs, customer decisions or a policy payload.
 */
export async function POST(request:NextRequest){
  // Keep this route inert on Vercel and every other web runtime by default.
  // The separately hosted Studio backend must opt in explicitly.
  if(process.env.INSUREIT_AI_STUDIO_BACKEND_ENABLED!=="true")
    return respond({ok:false,error:"service_not_enabled"},503);
  // The reverse proxy forwards the dedicated hostname; disallow arbitrary Host
  // headers so internal web routes are not accidentally used as a public API.
  if(request.headers.get("host")!=="studio.nishant.uk")
    return respond({ok:false,error:"invalid_service_host"},403);
  const bearer=request.headers.get("authorization")??"";
  const jwt=/^Bearer ([A-Za-z0-9._-]{100,8192})$/.exec(bearer)?.[1];
  if(!jwt)return respond({ok:false,error:"not_authenticated"},401);
  const size=Number(request.headers.get("content-length")||0);
  if(!Number.isFinite(size)||size>1024)return respond({ok:false,error:"invalid_request"},400);
  const body:unknown=await request.json().catch(()=>null);
  if(!body||typeof body!=="object"||Array.isArray(body))return respond({ok:false,error:"invalid_request"},400);
  const input=body as Record<string,unknown>;
  if(Object.keys(input).sort().join(",")!=="action,confirm,intake_id"
     ||(input.action!=="reparse"&&input.action!=="convert")
     ||input.confirm!==true||typeof input.intake_id!=="string"||!UUID.test(input.intake_id)){
    return respond({ok:false,error:"invalid_request"},400);
  }

  // A Supabase-authenticated IT operator with existing Studio scope is
  // required for every call. The SQL function independently resolves active
  // employment, role, live permissions, and the requested private intake.
  let client:ReturnType<typeof createSupabaseWithAccessToken>;
  try {client=createSupabaseWithAccessToken(jwt);}
  catch{return respond({ok:false,error:"service_not_configured"},503);}
  const {data:session,error:sessionError}=await client.auth.getUser(jwt);
  if(sessionError||!session.user)return respond({ok:false,error:"not_authenticated"},401);
  const permission=await client.rpc("partner_app_ai_studio_detail_v1",{
    p_intake_id:input.intake_id,
  });
  if(permission.error||!permission.data||permission.data.id!==input.intake_id)
    return respond({ok:false,error:"insufficient_permission_or_intake_unavailable"},403);
  // The read-only Studio queue now covers both original intake lanes.
  // Do not let that expand the existing AI reparse/booking write scope.
  if(permission.data.processing_lane!=="automation")
    return respond({ok:false,error:"manual_intake_requires_website_onboarding"},409);

  // Bind the verified JWT to this async execution only; the shared
  // server-action authorization uses it instead of a potentially unrelated
  // browser cookie. Never set a global bearer token.
  try{
    if(input.action==="reparse"){
      const result=await withVerifiedPartnerApiToken(jwt,
        ()=>reparseAndReplaceAiPolicyIntakeDraft(input.intake_id as string));
      return result.ok
        ?respond({ok:true,action:"reparse",draft_replaced:true,policy_booked:false})
        :respond({ok:false,error:result.error||"reparse_not_accepted"},409);
    }
    const result=await withVerifiedPartnerApiToken(jwt,
      ()=>convertVerifiedAiIntake(input.intake_id as string,true));
    if(!result.ok){
      const diagnostics=Array.isArray(result.issues)
        ?result.issues.slice(0,5).map(item=>({field:item.field,message:item.message}))
        :[];
      return respond({ok:false,error:"booking_checks_not_satisfied",issues:diagnostics},409);
    }
    return respond({ok:true,action:"convert",policy_booked:true,
      policy_id:result.policyId??null,policy_code:result.policyCode??null});
  }catch{
    // The canonical transaction may already have completed when a transport
    // or downstream error occurs. Require refresh before any repeated action.
    // Never return internal exceptions, credentials or customer data.
    return respond({ok:false,error:"action_outcome_unknown_refresh_before_retry"},503);
  }
}
