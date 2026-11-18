import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { isAppRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BYTES = 15 * 1024 * 1024;
const TYPES = new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const BUCKET = "policy-documents";
const reply = (data:object,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
type Body={action?:"prepare"|"finalize";policy_id?:string;name?:string;size?:number;type?:string;path?:string};
const safeName=(v:string)=>v.trim().replace(/[^A-Za-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,120)||"policy-copy";

export async function POST(request:Request){
  const bearer=/^Bearer (\S+)$/i.exec(request.headers.get("authorization")??"")?.[1];
  if(!bearer)return reply({ok:false,error:"Partner authentication is required."},401);
  const scoped=createSupabaseWithAccessToken(bearer);
  const {data:{user},error:authError}=await scoped.auth.getUser(bearer);
  if(authError||!user)return reply({ok:false,error:"Partner session has expired."},401);
  const admin=createSupabaseAdminClient();
  const {data:profile,error:profileError}=await admin.from("profiles")
    .select("id,role,is_active").eq("id",user.id)
    .maybeSingle<{id:string;role:string;is_active:boolean}>();
  if(profileError||!profile?.is_active||!isAppRole(profile.role))
    return reply({ok:false,error:"Operations account access is unavailable."},403);
  if(!await hasEffectiveCapability(profile,"create_policies","edit"))
    return reply({ok:false,error:"Policy creation permission is required."},403);
  let body:Body;
  try{body=await request.json() as Body;}catch{return reply({ok:false,error:"Invalid upload request."},400);}
  if(!UUID.test(body.policy_id??"")||!["prepare","finalize"].includes(body.action??""))
    return reply({ok:false,error:"Invalid saved policy or upload action."},400);
  const size=body.size, type=body.type??"", name=body.name??"";
  if(!name.trim()||name.length>180||typeof size!=="number"||!Number.isSafeInteger(size)||size<=0||size>MAX_BYTES||!TYPES.has(type))
    return reply({ok:false,error:"Choose a PDF, JPG, PNG or WebP policy copy up to 15 MB."},400);
  // This endpoint is reserved for the creator's newly booked standalone
  // Motor policy. Intake copies are already enforced by the booking engine.
  const {data:policy,error:policyError}=await admin.from("policies")
    .select("id,created_by,business_line").eq("id",body.policy_id)
    .maybeSingle<{id:string;created_by:string|null;business_line:string|null}>();
  if(policyError||!policy||policy.created_by!==profile.id||policy.business_line!=="Motor")
    return reply({ok:false,error:"Only the employee who booked this Motor policy may attach its policy copy."},403);
  if(body.action==="prepare"){
    // A lost client response must never attach the same selected copy twice.
    const existing=await admin.from("policy_documents").select("id")
      .eq("policy_id",policy.id).eq("document_type","policy_copy")
      .eq("file_name",name).eq("file_size",size).eq("mime_type",type)
      .limit(1).maybeSingle<{id:string}>();
    if(existing.error)return reply({ok:false,error:"Could not check the existing policy copy."},503);
    if(existing.data)return reply({ok:true,attached:true,document_id:existing.data.id});
    const path=policy.id+"/"+randomUUID()+"-"+safeName(name);
    const {data,error}=await admin.storage.from(BUCKET).createSignedUploadUrl(path,{upsert:false});
    if(error||!data?.token)return reply({ok:false,error:"Could not prepare the secure policy-copy upload."},503);
    return reply({ok:true,path,token:data.token});
  }
  const path=body.path??"";
  const suffix=path.startsWith(policy.id+"/")?path.slice(policy.id.length+1):"";
  if(!new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-","i").test(suffix)
    ||!suffix.endsWith("-"+safeName(name))||suffix.includes("/")||suffix.includes(".."))
    return reply({ok:false,error:"Invalid policy-copy upload reference."},400);
  const prior=await admin.from("policy_documents").select("id").eq("policy_id",policy.id)
    .eq("document_type","policy_copy").eq("storage_bucket",BUCKET).eq("storage_path",path)
    .maybeSingle<{id:string}>();
  if(prior.error)return reply({ok:false,error:"Could not check policy-copy registration."},503);
  if(prior.data)return reply({ok:true,document_id:prior.data.id});
  const {data:stored,error:storageError}=await admin.storage.from(BUCKET).info(path);
  if(storageError||!stored)return reply({ok:false,error:"Policy copy has not finished uploading. Retry upload."},409);
  if(stored.size!==size||stored.contentType!==type||stored.size>MAX_BYTES)
    return reply({ok:false,error:"Uploaded policy copy does not match the selected file."},400);
  const {data:saved,error:saveError}=await admin.from("policy_documents")
    .insert({policy_id:policy.id,document_type:"policy_copy",file_name:name,
      storage_bucket:BUCKET,storage_path:path,mime_type:type,file_size:size,uploaded_by:profile.id})
    .select("id").single<{id:string}>();
  if(saveError||!saved){
    const after=await admin.from("policy_documents").select("id").eq("policy_id",policy.id)
      .eq("storage_path",path).maybeSingle<{id:string}>();
    if(after.data)return reply({ok:true,document_id:after.data.id});
    return reply({ok:false,error:"Policy saved and file uploaded, but linking failed. Retry upload registration; do not create another policy."},503);
  }
  return reply({ok:true,document_id:saved.id});
}
