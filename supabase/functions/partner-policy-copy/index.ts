// Secure, Vercel-independent policy-copy preparation/finalization for a
// newly booked standalone Motor policy. No booking or policy mutation occurs.
// The client uploads bytes directly to private Supabase Storage using its
// one-time signed token, then invokes finalize after a server-side file check.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const BUCKET="policy-documents";
const LIMIT=15*1024*1024;
const reply=(data:Record<string,unknown>,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store"}});
const safeName=(v:string)=>v.trim().replace(/[^A-Za-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,120)||"policy-copy";
Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return reply({ok:false,error:"Method not allowed."},405);
  const bearer=/^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization")??"")?.[1];
  if(!bearer)return reply({ok:false,error:"Partner authentication required."},401);
  let body:Record<string,unknown>;
  try{body=await req.json();}catch{return reply({ok:false,error:"Invalid upload request."},400);}
  const action=body.action;
  const policyId=typeof body.policy_id==="string"?body.policy_id:"";
  const name=typeof body.name==="string"?body.name:"";
  const type=typeof body.type==="string"?body.type:"";
  const size=body.size;
  if(!UUID.test(policyId)||!["prepare","finalize"].includes(String(action)))
    return reply({ok:false,error:"Invalid saved policy or upload action."},400);
  if(!name.trim()||name.length>180||typeof size!=="number"||!Number.isSafeInteger(size)||
     size<=0||size>LIMIT||!MIME.has(type))
    return reply({ok:false,error:"Choose a PDF, JPG, PNG or WebP policy copy up to 15 MB."},400);
  const url=Deno.env.get("SUPABASE_URL");
  const anon=Deno.env.get("SUPABASE_ANON_KEY");
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!secret)return reply({ok:false,error:"Policy-copy service temporarily unavailable."},503);
  const userClient=createClient(url,anon,{
    global:{headers:{Authorization:`Bearer ${bearer}`}},
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:userInfo,error:userError}=await userClient.auth.getUser(bearer);
  if(userError||!userInfo.user)return reply({ok:false,error:"Partner session expired."},401);
  const [{data:identity,error:identityError},{data:access,error:accessError}]=await Promise.all([
    userClient.rpc("partner_app_current_identity"),
    userClient.rpc("partner_app_effective_permissions")
  ]);
  if(identityError||accessError)return reply({ok:false,error:"Partner permissions unavailable."},503);
  if(!identity||identity.actor_kind!=="employee"||identity.auth_user_id!==userInfo.user.id||
      identity.profile_id!==userInfo.user.id||!access||access.actor_kind!=="employee")
    return reply({ok:false,error:"Operations Partner access unavailable."},403);
  if(!["edit","approve"].includes(access.capabilities?.create_policies))
    return reply({ok:false,error:"Policy creation permission required."},403);
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:policy,error:policyError}=await admin.from("policies")
    .select("id,created_by,business_line").eq("id",policyId).maybeSingle();
  if(policyError)return reply({ok:false,error:"Policy ownership temporarily unavailable."},503);
  if(!policy||policy.created_by!==userInfo.user.id||policy.business_line!=="Motor")
    return reply({ok:false,error:"Only the employee who booked this Motor policy may attach its copy."},403);
  if(action==="prepare"){
    const existing=await admin.from("policy_documents").select("id")
      .eq("policy_id",policy.id).eq("document_type","policy_copy")
      .eq("file_name",name).eq("file_size",size).eq("mime_type",type)
      .limit(1).maybeSingle();
    if(existing.error)return reply({ok:false,error:"Could not check existing policy copy."},503);
    if(existing.data)return reply({ok:true,attached:true,document_id:existing.data.id});
    const path=policy.id+"/"+crypto.randomUUID()+"-"+safeName(name);
    const {data:signed,error}=await admin.storage.from(BUCKET).createSignedUploadUrl(path,{upsert:false});
    if(error||!signed?.token)return reply({ok:false,error:"Could not prepare secure policy-copy upload."},503);
    return reply({ok:true,path,token:signed.token});
  }
  const path=typeof body.path==="string"?body.path:"";
  const suffix=path.startsWith(policy.id+"/")?path.slice(policy.id.length+1):"";
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i.test(suffix)||
     !suffix.endsWith("-"+safeName(name))||suffix.includes("/")||suffix.includes(".."))
    return reply({ok:false,error:"Invalid policy-copy upload reference."},400);
  const prior=await admin.from("policy_documents").select("id")
    .eq("policy_id",policy.id).eq("document_type","policy_copy")
    .eq("storage_bucket",BUCKET).eq("storage_path",path).maybeSingle();
  if(prior.error)return reply({ok:false,error:"Could not check policy-copy registration."},503);
  if(prior.data)return reply({ok:true,document_id:prior.data.id});
  const {data:stored,error:storageError}=await admin.storage.from(BUCKET).info(path);
  if(storageError||!stored)return reply({ok:false,error:"Policy copy has not finished uploading. Retry upload."},409);
  if(stored.size!==size||stored.contentType!==type||stored.size>LIMIT)
    return reply({ok:false,error:"Uploaded policy copy does not match selected file."},400);
  const {data:saved,error:saveError}=await admin.from("policy_documents")
    .insert({policy_id:policy.id,document_type:"policy_copy",file_name:name,
      storage_bucket:BUCKET,storage_path:path,mime_type:type,file_size:size,
      uploaded_by:userInfo.user.id})
    .select("id").single();
  if(saveError||!saved){
    const after=await admin.from("policy_documents").select("id")
      .eq("policy_id",policy.id).eq("storage_path",path).maybeSingle();
    if(after.data)return reply({ok:true,document_id:after.data.id});
    return reply({ok:false,error:"File uploaded but linking failed. Retry registration without creating another policy."},503);
  }
  return reply({ok:true,document_id:saved.id});
});
