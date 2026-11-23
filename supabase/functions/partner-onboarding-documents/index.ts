// Read-only, scoped document listing for Partner Policy Onboarding.
// Upload, replacement, delete and storage URL issuance are NOT implemented.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const lines=new Set(["Life","Health","Non Motor"]);
const json=(obj:Record<string,unknown>,status=200)=>new Response(JSON.stringify(obj),{
  status,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store"}
});
Deno.serve(async(request:Request)=>{
  if(request.method!=="POST")return json({ok:false,error:"Operation not yet migrated."},501);
  const bearer=/^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization")??"")?.[1];
  if(!bearer)return json({ok:false,error:"Partner sign-in required."},401);
  let body:Record<string,unknown>;
  try{body=await request.json();}catch{return json({ok:false,error:"Invalid request."},400);}
  if(body.action!=="list")return json({ok:false,error:"Document mutation has not been migrated."},501);
  const id=typeof body.intake_id==="string"?body.intake_id:"";
  const line=typeof body.business_line==="string"?body.business_line:"";
  if(!uuid.test(id)||!lines.has(line))return json({ok:false,error:"Invalid intake or policy type."},400);
  const endpoint=Deno.env.get("SUPABASE_URL");
  const anonKey=Deno.env.get("SUPABASE_ANON_KEY");
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!endpoint||!anonKey||!secret)return json({ok:false,error:"Document service unavailable."},503);
  const scoped=createClient(endpoint,anonKey,{
    global:{headers:{Authorization:`Bearer ${bearer}`}},
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:userInfo,error:userError}=await scoped.auth.getUser(bearer);
  if(userError||!userInfo.user)return json({ok:false,error:"Partner session expired."},401);
  const [{data:identity,error:identityError},{data:access,error:accessError}]=await Promise.all([
    scoped.rpc("partner_app_current_identity"),
    scoped.rpc("partner_app_effective_permissions")
  ]);
  if(identityError||accessError)return json({ok:false,error:"Permissions service unavailable."},503);
  if(!identity||identity.actor_kind!=="employee"||identity.auth_user_id!==userInfo.user.id||
      identity.profile_id!==userInfo.user.id||!access||access.actor_kind!=="employee")
    return json({ok:false,error:"Operations access required."},403);
  // The website has a separate Life Head downline predicate; until it is
  // migrated, do not grant access based on reviewer assignment alone.
  if(identity.role==="operations_head_life")
    return json({ok:false,error:"Life Operations document scope is not migrated."},501);
  const grants=access.capabilities??{};
  if(!["edit","approve"].includes(grants.review_policy_intakes)||
     grants.finalize_policy_intakes!=="approve")
    return json({ok:false,error:"Intake finalization permission required."},403);
  const admin=createClient(endpoint,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const [intake,draft]=await Promise.all([
    admin.from("policy_intake_requests").select("id,status,assigned_to_profile_id")
      .eq("id",id).maybeSingle(),
    admin.from("policy_intake_onboarding_drafts").select("draft_payload")
      .eq("intake_id",id).maybeSingle()
  ]);
  if(intake.error||draft.error)return json({ok:false,error:"Document scope unavailable."},503);
  if(!intake.data||intake.data.status!=="in_review"||
     intake.data.assigned_to_profile_id!==userInfo.user.id)
    return json({ok:false,error:"Only the assigned reviewer may view onboarding documents."},403);
  if(!draft.data||draft.data.draft_payload?.businessLine!==line)
    return json({ok:false,error:"Save this policy type before opening documents."},409);
  const {data:docs,error}=await admin.from("policy_intake_onboarding_documents")
    .select("document_type,file_name")
    .eq("intake_id",id).eq("business_line",line)
    .order("created_at",{ascending:true});
  if(error)return json({ok:false,error:"Onboarding documents could not be loaded."},503);
  return json({ok:true,documents:(docs??[]).map(d=>({type:d.document_type,fileName:d.file_name}))});
});
