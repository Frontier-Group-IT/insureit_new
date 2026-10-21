import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info", "Access-Control-Allow-Methods": "POST,OPTIONS" };
const respond = (body: unknown, status: number) => new Response(JSON.stringify(body), {status,headers:{...cors,"Content-Type":"application/json"}});
const TYPES = new Set(["application/pdf","image/jpeg","image/png","image/webp","image/heic","video/mp4","video/quicktime","audio/mp4","audio/m4a"]);
const EXT: Record<string,string> = {"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/heic":"heic","video/mp4":"mp4","video/quicktime":"mov","audio/mp4":"m4a","audio/m4a":"m4a"};
const MAX_DOC = 5*1024*1024, MAX_MEDIA=20*1024*1024, MAX_VOICE=5*1024*1024;
const CATEGORIES = new Set(["RC Copy","Insurance Copy","Driver Licence","GR / Load Bill","Accident Photo","Accident Video","Incident Voice Note","Spot Report","Claim Form","Estimate Copy","Other"]);
Deno.serve(async request=>{
  if(request.method==="OPTIONS") return respond({},200);
  if(request.method!=="POST") return respond({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!service) return respond({error:"Service not configured"},503);
  const authorization=request.headers.get("Authorization");
  if(!authorization?.startsWith("Bearer ")) return respond({error:"Authentication required"},401);
  const scoped=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const {data:identity,error:authError}=await scoped.auth.getUser();
  if(authError||!identity.user) return respond({error:"Invalid session"},401);
  if(request.headers.get("content-type")?.includes("application/json")) {
    let body:{action?:string;document_id?:string};
    try{body=await request.json();}catch{return respond({error:"Invalid JSON"},400);}
    if(body.action!=="signed_url"||typeof body.document_id!=="string"||! /^[a-f0-9-]{36}$/i.test(body.document_id)) return respond({error:"Invalid document request"},400);
    const {data:doc,error:docError}=await admin.from("claim_documents")
      .select("claim_id,storage_bucket,storage_path").eq("id",body.document_id).maybeSingle();
    if(docError||!doc||doc.storage_bucket!=="claim-documents") return respond({error:"Document unavailable"},404);
    const {data:allow,error:permissionError}=await scoped.rpc("partner_app_claim_in_scope",{p_claim_id:doc.claim_id});
    if(permissionError||allow!==true) return respond({error:"Document access denied"},403);
    const {data:signed,error:signedError}=await admin.storage.from("claim-documents").createSignedUrl(doc.storage_path,60);
    if(signedError||!signed?.signedUrl) return respond({error:"Could not open document"},502);
    return respond({url:signed.signedUrl},200);
  }
  let form:FormData;
  try{form=await request.formData();}catch{return respond({error:"Invalid upload form"},400);}
  const claimId=form.get("claim_id"),category=form.get("category"),file=form.get("file");
  if(typeof claimId!=="string"||! /^[a-f0-9-]{36}$/i.test(claimId)||typeof category!=="string"||!CATEGORIES.has(category)||!(file instanceof File)) return respond({error:"Invalid upload request"},400);
  const kind=file.type.toLowerCase();
  if(!TYPES.has(kind)) return respond({error:"Unsupported file format"},400);
  const isVoice=category==="Incident Voice Note",isVideo=category==="Accident Video";
  if(isVoice&&!kind.startsWith("audio/")||isVideo&&!kind.startsWith("video/")||!isVoice&&!isVideo&&kind.startsWith("audio/")) return respond({error:"Document category and format do not match"},400);
  const max=isVoice?MAX_VOICE:isVideo?MAX_MEDIA:MAX_DOC;
  if(file.size===0||file.size>max) return respond({error:"File exceeds category size limit"},413);
  const {data:allowed,error:scopeError}=await scoped.rpc("partner_app_claim_in_scope",{p_claim_id:claimId});
  if(scopeError||allowed!==true) return respond({error:"Claim not authorized"},403);
  const {data:claim,error:claimError}=await admin.from("claims").select("id,customer_id,current_status").eq("id",claimId).maybeSingle();
  if(claimError||!claim) return respond({error:"Claim unavailable"},404);
  if(["Closed","Settled","Rejected","Claim Complete"].includes(claim.current_status)) return respond({error:"Claim is closed"},409);
  const extension=EXT[kind],path=`${claim.customer_id}/${claimId}/partner/${crypto.randomUUID()}.${extension}`;
  const {error:uploadError}=await admin.storage.from("claim-documents").upload(path,file,{contentType:kind,upsert:false});
  if(uploadError){console.error("partner-claim-document storage",uploadError.message);return respond({error:"Upload failed"},502);}
  const {data:record,error:insertError}=await admin.from("claim_documents").insert({
    claim_id:claimId,customer_id:claim.customer_id,document_type:category,file_name:file.name.slice(0,180),
    storage_bucket:"claim-documents",storage_path:path,mime_type:kind,file_size:file.size,uploaded_by:identity.user.id,
    verification_required:true
  }).select("id").single();
  if(insertError||!record?.id){
    await admin.storage.from("claim-documents").remove([path]);
    console.error("partner-claim-document metadata",insertError?.message);
    return respond({error:"Could not register uploaded document"},500);
  }
  return respond({ok:true,id:record.id,category},201);
});
