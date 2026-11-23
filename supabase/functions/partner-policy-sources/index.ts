// Scoped POSP/MISP/Partner directory for the native Partner Policy Onboarding.
// Read-only; Life Head downline listing intentionally disabled until scope parity.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const types: Record<string,string> = {"POSP":"posp","MISP":"misp","SIBL / Partner":"partner"};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (result:Record<string,unknown>,status=200)=>
  new Response(JSON.stringify(result),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
type Source = {
  id:string;intermediary_type:string;display_name:string;intermediary_code:string|null;
  mobile:string|null;associate_employee_id:string|null;application_id:string|null;
};
Deno.serve(async (request:Request)=>{
  if(request.method!=="POST")return json({ok:false,error:"Method not allowed."},405);
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization")??"")?.[1];
  if(!token)return json({ok:false,error:"Partner session required."},401);
  let body:Record<string,unknown>;
  try{body=await request.json();}catch{return json({ok:false,error:"Invalid source search."},400);}
  const type=types[String(body.intermediary_type??"")];
  if(!type)return json({ok:false,error:"Choose an intermediary type first."},400);
  const search=String(body.search??"").trim();
  const offset=Number(body.offset??0);
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000)return json({ok:false,error:"Invalid source page."},400);
  if(search.length>80)return json({ok:false,error:"Search is too long."},400);
  const url=Deno.env.get("SUPABASE_URL");
  const anon=Deno.env.get("SUPABASE_ANON_KEY");
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!secret)return json({ok:false,error:"Source directory unavailable."},503);
  const scoped=createClient(url,anon,{
    global:{headers:{Authorization:`Bearer ${token}`}},
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:auth,error:authError}=await scoped.auth.getUser(token);
  if(authError||!auth.user)return json({ok:false,error:"Your Partner session has expired."},401);
  const [{data:identity,error:identityError},{data:access,error:accessError}]=await Promise.all([
    scoped.rpc("partner_app_current_identity"),scoped.rpc("partner_app_effective_permissions")
  ]);
  if(identityError||accessError)return json({ok:false,error:"Policy access temporarily unavailable."},503);
  if(!identity||identity.actor_kind!=="employee"||identity.profile_id!==auth.user.id||
      identity.auth_user_id!==auth.user.id||!access||access.actor_kind!=="employee"){
    return json({ok:false,error:"Operations access is not enabled."},403);
  }
  const permission=access.capabilities??{};
  if(identity.role==="operations_head_life"){
    // Existing website restricts this role to the computed downline.
    // Do not list all sources until that exact scope has been ported.
    return json({ok:false,error:"Life Operations source scope has not been migrated."},501);
  }
  const create=permission.create_policies==="edit"||permission.create_policies==="approve";
  const legacy=permission.view_policies==="edit"||permission.view_policies==="approve";
  if(!create&&!legacy)return json({ok:false,error:"Policy creation permission is required."},403);
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  let fixedCode:string|null=null;
  if(body.intake_id!==undefined&&body.intake_id!==null&&body.intake_id!==""){
    const id=String(body.intake_id);
    if(!uuid.test(id))return json({ok:false,error:"Invalid Intake reference."},400);
    const {data:intake,error}=await admin.from("policy_intake_requests")
      .select("id,lead_source_type,lead_source_code")
      .eq("id",id).eq("assigned_to_profile_id",auth.user.id).eq("status","in_review")
      .maybeSingle();
    if(error)return json({ok:false,error:"Intake authorization temporarily unavailable."},503);
    if(!intake)return json({ok:false,error:"Intake is not assigned to your account."},403);
    if(intake.lead_source_type!==type)return json({ok:false,error:"Intake has a different source type."},403);
    fixedCode=intake.lead_source_code;
    if(!fixedCode)return json({ok:false,error:"Intake has no verified lead-source code."},409);
  }
  let query=admin.from("intermediaries")
    .select("id,intermediary_type,display_name,intermediary_code,mobile,associate_employee_id,application_id")
    .eq("account_status","active").eq("intermediary_type",type)
    .not("intermediary_code","is",null)
    .order("display_name").order("id").range(offset,offset+40);
  if(fixedCode)query=query.eq("intermediary_code",fixedCode);
  const term=search.replace(/[^\p{L}\p{N} .\/-]/gu,"").trim().slice(0,80);
  if(term)query=query.or(`display_name.ilike.%${term}%,intermediary_code.ilike.%${term}%`);
  const {data:rows,error:directoryError}=await query;
  if(directoryError)return json({ok:false,error:"Source directory temporarily unavailable."},503);
  const found=((rows??[]) as Source[]).slice(0,40);
  const {data:associates,error:associatesError}=await admin.from("employees")
    .select("id,full_name,employee_code").ilike("department","sales")
    .eq("employment_status","active").order("full_name",{ascending:true});
  if(associatesError)return json({ok:false,error:"RM assignment lookup unavailable."},503);
  const ownerById=new Map((associates??[]).map(x=>[x.id,x]));
  const result=[];
  for(const row of found){
    let employeeId=row.associate_employee_id;
    if(row.application_id){
      const {data:owner,error}=await admin.from("posp_misp_onboarding_profiles")
        .select("associate_employee_id").eq("application_id",row.application_id).maybeSingle();
      if(error)return json({ok:false,error:"RM assignment lookup unavailable."},503);
      if(owner)employeeId=owner.associate_employee_id;
      else if(row.intermediary_type==="partner"&&!employeeId){
        const {data:application,error:applicationError}=await admin.from("intermediary_onboarding_applications")
          .select("partner_record_id").eq("id",row.application_id).maybeSingle();
        if(applicationError)return json({ok:false,error:"RM assignment lookup unavailable."},503);
        if(application?.partner_record_id){
          const {data:partnerOwner,error:partnerError}=await admin.from("posp_misp_onboarding_profiles")
            .select("associate_employee_id").eq("partner_record_id",application.partner_record_id)
            .not("associate_employee_id","is",null)
            .order("created_at",{ascending:false}).limit(1).maybeSingle();
          if(partnerError)return json({ok:false,error:"RM assignment lookup unavailable."},503);
          employeeId=partnerOwner?.associate_employee_id??null;
        }
      }
    }
    const owner=ownerById.get(employeeId??"");
    result.push({id:row.id,name:row.display_name,code:row.intermediary_code??"",
      mobile:row.mobile?.replace(/\D/g,"").slice(-10)??"",
      rmName:owner?.full_name?.trim()??"",rmCode:owner?.employee_code?.trim()??""});
  }
  return json({ok:true,sources:result,hasMore:(rows??[]).length>40});
});
