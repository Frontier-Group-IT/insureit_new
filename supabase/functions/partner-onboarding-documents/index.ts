// Authenticated Partner Policy Onboarding document service, independent of Vercel.
// Signed Storage uploads, verified finalize, replacement and delete are supported.
// Never return Storage paths or signed download URLs through the list action.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const lines=new Set(["Life","Health","Non Motor"]);
const types=new Set(["policy_copy","proposal_form","kyc","other_document"]);
const mimes=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const MAX_BYTES=4*1024*1024;
const BUCKET="policy-documents";
const safeName=(text:string)=>text.replace(/[^a-zA-Z0-9._-]/g,"-").slice(0,120)||"document";
const json=(obj:Record<string,unknown>,status=200)=>new Response(JSON.stringify(obj),{
  status,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store"}
});
Deno.serve(async(request:Request)=>{
  if(request.method!=="POST")return json({ok:false,error:"Operation not yet migrated."},501);
  const bearer=/^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization")??"")?.[1];
  if(!bearer)return json({ok:false,error:"Partner sign-in required."},401);
  let body:Record<string,unknown>;
  try{body=await request.json();}catch{return json({ok:false,error:"Invalid request."},400);}
  const action=body.action;
  if(!["list","prepare_upload","finalize_upload","delete"].includes(String(action)))
    return json({ok:false,error:"Unsupported document action."},400);
  const type=typeof body.document_type==="string"?body.document_type:"";
  if(action!=="list"&&!types.has(type))return json({ok:false,error:"Unsupported document type."},400);
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
  if(action!=="list"){
    if(action==="delete"){
      const {data:existing,error:lookupError}=await admin.from("policy_intake_onboarding_documents")
        .select("id,storage_bucket,storage_path").eq("intake_id",id)
        .eq("business_line",line).eq("document_type",type).maybeSingle();
      if(lookupError)return json({ok:false,error:"Document could not be loaded."},503);
      if(!existing)return json({ok:true});
      const {error:deleteError}=await admin.from("policy_intake_onboarding_documents")
        .delete().eq("id",existing.id).eq("intake_id",id);
      if(deleteError)return json({ok:false,error:"Document could not be removed."},503);
      await admin.storage.from(existing.storage_bucket).remove([existing.storage_path]);
      return json({ok:true});
    }
    const name=typeof body.name==="string"?body.name:"";
    const mime=typeof body.mime_type==="string"?body.mime_type:"";
    const size=body.size;
    if(!name.trim()||name.length>255||!mimes.has(mime)||
       typeof size!=="number"||!Number.isSafeInteger(size)||size<1||size>MAX_BYTES)
      return json({ok:false,error:"Upload a PDF, JPG, PNG or WebP up to 4 MB."},400);
    const prefix=`intake-onboarding/${id}/${line.replace(/\\s/g,"-")}/${type}/`;
    if(action==="prepare_upload"){
      const path=prefix+crypto.randomUUID()+"-"+safeName(name);
      const {data:prepared,error:prepareError}=await admin.storage.from(BUCKET)
        .createSignedUploadUrl(path,{upsert:false});
      if(prepareError||!prepared?.token)
        return json({ok:false,error:"Secure document upload unavailable."},503);
      return json({ok:true,path,token:prepared.token});
    }
    const path=typeof body.path==="string"?body.path:"";
    const tail=path.startsWith(prefix)?path.slice(prefix.length):"";
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i.test(tail)||
       !tail.endsWith("-"+safeName(name))||tail.includes("/")||tail.includes(".."))
      return json({ok:false,error:"Invalid uploaded document reference."},400);
    const {data:stored,error:storageError}=await admin.storage.from(BUCKET).info(path);
    if(storageError||!stored)return json({ok:false,error:"Document upload is incomplete."},409);
    if(stored.size!==size||stored.contentType!==mime||stored.size>MAX_BYTES)
      return json({ok:false,error:"Uploaded document does not match the selected file."},400);
    const {data:old,error:oldError}=await admin.from("policy_intake_onboarding_documents")
      .select("id,storage_bucket,storage_path").eq("intake_id",id)
      .eq("business_line",line).eq("document_type",type).maybeSingle();
    if(oldError)return json({ok:false,error:"Document registration unavailable."},503);
    if(old?.storage_path===path)return json({ok:true,document:{type,fileName:name}});
    const values={storage_bucket:BUCKET,storage_path:path,file_name:name,mime_type:mime,
      file_size:size,uploaded_by_profile_id:userInfo.user.id,updated_at:new Date().toISOString()};
    const result=old
      ?await admin.from("policy_intake_onboarding_documents").update(values)
        .eq("id",old.id).eq("intake_id",id).select("id").maybeSingle()
      :await admin.from("policy_intake_onboarding_documents").insert({
        intake_id:id,business_line:line,document_type:type,...values
      }).select("id").maybeSingle();
    if(result.error||!result.data){
      // Do not delete the newly uploaded file on a transient database error:
      // returning its path permits an idempotent finalize retry.
      return json({ok:false,error:"Upload succeeded but linking failed. Retry without reuploading."},503);
    }
    if(old?.storage_path&&old.storage_path!==path)
      await admin.storage.from(old.storage_bucket).remove([old.storage_path]);
    return json({ok:true,document:{type,fileName:name}});
  }
  const {data:docs,error}=await admin.from("policy_intake_onboarding_documents")
    .select("document_type,file_name")
    .eq("intake_id",id).eq("business_line",line)
    .order("created_at",{ascending:true});
  if(error)return json({ok:false,error:"Onboarding documents could not be loaded."},503);
  return json({ok:true,documents:(docs??[]).map(d=>({type:d.document_type,fileName:d.file_name}))});
});
