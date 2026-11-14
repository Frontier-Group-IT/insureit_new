import { NextResponse } from "next/server";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getPartnerEmployeeIntakeReadScope } from "@/lib/partner-policy-intake-read-access";
import { isAppRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(["policy_copy","proposal_form","kyc","other_document"]);
const LINES = new Set(["Life","Health","Non Motor"]);
const MIMES = new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const BUCKET = "policy-documents";
const MAX_BYTES = 4 * 1024 * 1024;
type DocumentRow = { id:string; document_type:string; file_name:string; storage_bucket:string; storage_path:string };
const response = (body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
const error = (message:string,status=400)=>response({ok:false,error:message},status);
const safeName = (name:string)=>name.replace(/[^a-zA-Z0-9._-]/g,"-").slice(0,120)||"document";

async function context(request:Request,intakeId:string,line:string){
  if(!UUID.test(intakeId)||!LINES.has(line))return {error:error("Invalid intake or policy type.",400)} as const;
  const token=/^Bearer (\S+)$/i.exec(request.headers.get("authorization")??"")?.[1];
  if(!token)return {error:error("Partner authentication required.",401)} as const;
  const scoped=createSupabaseWithAccessToken(token);
  const {data:{user},error:authError}=await scoped.auth.getUser(token);
  if(authError||!user)return {error:error("Partner session expired.",401)} as const;
  const admin=createSupabaseAdminClient();
  const {data:profile}=await admin.from("profiles").select("id,role,is_active").eq("id",user.id)
    .maybeSingle<{id:string;role:string;is_active:boolean}>();
  if(!profile?.is_active||!isAppRole(profile.role))return {error:error("Operations access unavailable.",403)} as const;
  const head=profile.role==="operations_head_life";
  const [review,finalize]=await Promise.all([
    head?Promise.resolve(true):hasEffectiveCapability(profile,"review_policy_intakes","edit"),
    head?Promise.resolve(true):hasEffectiveCapability(profile,"finalize_policy_intakes","approve"),
  ]);
  if(!review||!finalize)return {error:error("Policy Intake finalization permission is required.",403)} as const;
  const scope=await getPartnerEmployeeIntakeReadScope({actor_kind:"employee",profile_id:user.id});
  if(scope.mode==="none")return {error:error("Intake access unavailable.",403)} as const;
  let query=admin.from("policy_intake_requests").select("id,status,assigned_to_profile_id").eq("id",intakeId);
  if(scope.mode==="or")query=query.or(scope.predicates);
  else if(scope.mode==="submitter")query=query.eq("submitted_by_profile_id",scope.profileId);
  const {data:intake}=await query.maybeSingle<{id:string;status:string;assigned_to_profile_id:string|null}>();
  if(!intake||intake.status!=="in_review"||intake.assigned_to_profile_id!==user.id)
    return {error:error("Only the currently assigned reviewer may manage onboarding documents.",403)} as const;
  const {data:draft,error:draftError}=await admin.from("policy_intake_onboarding_drafts")
    .select("draft_payload").eq("intake_id",intakeId)
    .maybeSingle<{draft_payload:{businessLine?:string}}>();
  if(draftError||draft?.draft_payload?.businessLine!==line)
    return {error:error("Save the selected policy type before managing its documents.",409)} as const;
  return {admin,profile,intakeId,line,error:null} as const;
}

export async function GET(request:Request){
  const params=new URL(request.url).searchParams;
  const c=await context(request,params.get("intake_id")??"",params.get("business_line")??"");
  if(c.error)return c.error;
  const {data, error:loadError}=await c.admin.from("policy_intake_onboarding_documents")
    .select("id,document_type,file_name").eq("intake_id",c.intakeId).eq("business_line",c.line)
    .order("created_at",{ascending:true});
  if(loadError)return error("Onboarding documents could not be loaded.",503);
  return response({ok:true,documents:(data??[]).map(row=>({type:row.document_type,fileName:row.file_name}))});
}

export async function POST(request:Request){
  // Files are never accepted from unauthenticated or non-reviewer clients.
  const token=/^Bearer (\S+)$/i.exec(request.headers.get("authorization")??"")?.[1];
  if(!token)return error("Partner authentication required.",401);
  let form:FormData;
  try{form=await request.formData();}catch{return error("Invalid document upload.",400);}
  const intakeId=String(form.get("intake_id")??"");
  const line=String(form.get("business_line")??"");
  const type=String(form.get("document_type")??"");
  const file=form.get("file");
  if(!TYPES.has(type))return error("Unsupported document type.");
  if(!(file instanceof File)||file.size<=0)return error("Select a document to upload.");
  if(file.size>MAX_BYTES)return error("Each document must be 4 MB or smaller.");
  if(!MIMES.has(file.type))return error("Upload a PDF, JPG, PNG or WebP.");
  const c=await context(request,intakeId,line);
  if(c.error)return c.error;
  const {data:oldRows,error:lookupError}=await c.admin.from("policy_intake_onboarding_documents")
    .select("id,document_type,file_name,storage_bucket,storage_path")
    .eq("intake_id",intakeId).eq("business_line",line).eq("document_type",type)
    .limit(1).returns<DocumentRow[]>();
  if(lookupError)return error("Could not check the saved document.",503);
  const existing=oldRows?.[0];
  const path=`intake-onboarding/${intakeId}/${line.replace(/\s/g,"-")}/${type}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const {error:uploadError}=await c.admin.storage.from(BUCKET).upload(
    path,Buffer.from(await file.arrayBuffer()),{contentType:file.type,upsert:false});
  if(uploadError)return error("Document storage rejected the upload.",503);
  const values={storage_bucket:BUCKET,storage_path:path,file_name:file.name.slice(0,255),
    mime_type:file.type,file_size:file.size,uploaded_by_profile_id:c.profile.id,updated_at:new Date().toISOString()};
  const result=existing
    ?await c.admin.from("policy_intake_onboarding_documents").update(values).eq("id",existing.id)
      .eq("intake_id",intakeId).eq("business_line",line).select("id").maybeSingle<{id:string}>()
    :await c.admin.from("policy_intake_onboarding_documents").insert({
      intake_id:intakeId,business_line:line,document_type:type,...values,
    }).select("id").maybeSingle<{id:string}>();
  if(result.error||!result.data){
    await c.admin.storage.from(BUCKET).remove([path]);
    return error("Document was uploaded but could not be linked to this intake.",503);
  }
  if(existing?.storage_path&&existing.storage_path!==path)
    await c.admin.storage.from(existing.storage_bucket).remove([existing.storage_path]);
  return response({ok:true,document:{type,fileName:file.name}});
}

export async function DELETE(request:Request){
  let body:{intake_id?:string;business_line?:string;document_type?:string};
  try{body=await request.json() as typeof body;}catch{return error("Invalid document request.");}
  const type=body.document_type??"";
  if(!TYPES.has(type))return error("Unsupported document type.");
  const c=await context(request,body.intake_id??"",body.business_line??"");
  if(c.error)return c.error;
  const {data:existing,error:lookupError}=await c.admin.from("policy_intake_onboarding_documents")
    .select("id,document_type,file_name,storage_bucket,storage_path")
    .eq("intake_id",c.intakeId).eq("business_line",c.line).eq("document_type",type)
    .maybeSingle<DocumentRow>();
  if(lookupError)return error("Document could not be loaded.",503);
  if(!existing)return response({ok:true});
  const {error:deleteError}=await c.admin.from("policy_intake_onboarding_documents")
    .delete().eq("id",existing.id).eq("intake_id",c.intakeId);
  if(deleteError)return error("Document could not be removed.",503);
  await c.admin.storage.from(existing.storage_bucket).remove([existing.storage_path]);
  return response({ok:true});
}
