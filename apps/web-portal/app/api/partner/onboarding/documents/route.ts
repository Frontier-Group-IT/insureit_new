import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getEffectivePermissionAccessMap } from "@/lib/effective-permissions";
import { isEmployeeWithinAccessScope } from "@/lib/employee-access-scope";

export const dynamic="force-dynamic";
const BUCKET="customer-documents";
const TYPES=new Set(["aadhaar_front","aadhaar_back","pan_copy","cancelled_cheque","photograph","gst_copy",
  "education_10th_marksheet","education_12th_marksheet","education_graduation_marksheet","education_post_graduation_marksheet",
  "custom_1","custom_2","signed_registration_form"]);
const REQUIRED=["aadhaar_front","aadhaar_back","pan_copy","cancelled_cheque","photograph","gst_copy"];
const MAX_BYTES=10*1024*1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(data:Record<string,unknown>,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
const text=(value:FormDataEntryValue|null)=>typeof value==="string"?value.trim():"";

async function authorize(request:Request,applicationId:string) {
  if(!UUID.test(applicationId))return {error:reply({ok:false,error:"Invalid application reference."},400)};
  const token=/^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization")||"")?.[1];
  if(!token)return {error:reply({ok:false,error:"Sign in again to continue."},401)};
  const scoped=createSupabaseWithAccessToken(token);
  const {data:auth}=await scoped.auth.getUser(token);
  if(!auth.user)return {error:reply({ok:false,error:"Sign in again to continue."},401)};
  const {data:identity}=await scoped.rpc("partner_app_current_identity");
  if(!identity||identity.actor_kind!=="employee"||identity.auth_user_id!==auth.user.id||identity.profile_id!==auth.user.id)
    return {error:reply({ok:false,error:"Only authorized employees can upload MISP documents."},403)};
  const admin=createSupabaseAdminClient();
  const {data:profile}=await admin.from("profiles").select("id,role,is_active,employee_id").eq("id",auth.user.id).maybeSingle();
  if(!profile?.is_active||!profile.employee_id||profile.role!==identity.role)
    return {error:reply({ok:false,error:"Employee account not active."},403)};
  const {data:employee}=await admin.from("employees").select("employment_status").eq("id",profile.employee_id).maybeSingle();
  if(employee?.employment_status!=="active")return {error:reply({ok:false,error:"Employee account not active."},403)};
  const permissions=await getEffectivePermissionAccessMap(profile);
  if(!["edit","approve"].includes(permissions.create_intermediary_application??"none")
    ||!(await isEmployeeWithinAccessScope(profile.id,profile.role,profile.employee_id)))
    return {error:reply({ok:false,error:"MISP document permission required."},403)};
  const [{data:application},{data:onboarding}]=await Promise.all([
    admin.from("intermediary_onboarding_applications")
      .select("id,initiated_by,requested_type,status,partner_status,registration_status")
      .eq("id",applicationId).eq("initiated_by",profile.id).eq("requested_type","misp").maybeSingle(),
    admin.from("posp_misp_onboarding_profiles")
      .select("id,workflow_stage,gst_number,partner_id").eq("application_id",applicationId).eq("partner_type","misp").maybeSingle(),
  ]);
  if(!application||!onboarding)return {error:reply({ok:false,error:"MISP application not found or not assigned to you."},404)};
  if(!["submitted","under_review","changes_requested"].includes(application.status)
    ||application.partner_status==="active_partner"||onboarding.workflow_stage!=="iib_processing")
    return {error:reply({ok:false,error:"MISP document stage is not editable."},409)};
  return {admin,actorId:profile.id,application,onboarding};
}

export async function GET(request:Request) {
  const applicationId=new URL(request.url).searchParams.get("applicationId")||"";
  const result=await authorize(request,applicationId);
  if("error" in result)return result.error;
  const {data,error}=await result.admin.from("intermediary_onboarding_documents")
    .select("document_type,file_name,document_label").eq("application_id",applicationId);
  if(error)return reply({ok:false,error:"Unable to load saved documents."},503);
  const documents=(data??[]).map(row=>({type:row.document_type,name:row.file_name,label:row.document_label}));
  return reply({ok:true,documents,required:REQUIRED,application_id:applicationId});
}

export async function POST(request:Request) {
  const size=Number(request.headers.get("content-length")||0);
  if(size>MAX_BYTES+1000000)return reply({ok:false,error:"File must be 10 MB or smaller."},413);
  const data=await request.formData().catch(()=>null);
  if(!data)return reply({ok:false,error:"Invalid document request."},400);
  const applicationId=text(data.get("application_id"));
  const result=await authorize(request,applicationId);
  if("error" in result)return result.error;
  const {admin,actorId}=result;
  const intent=text(data.get("intent"));
  if(intent==="finalize") {
    const {data:docs,error:docsError}=await admin.from("intermediary_onboarding_documents")
      .select("document_type").eq("application_id",applicationId);
    if(docsError)return reply({ok:false,error:"Unable to verify documents."},503);
    const available=new Set((docs??[]).map(d=>d.document_type));
    const missing=REQUIRED.filter(type=>!available.has(type));
    if(missing.length)return reply({ok:false,error:"Upload required documents: "+missing.join(", ").replaceAll("_"," ")},400);
    const {data:activation,error:activationError}=await admin.rpc("finalize_partner_activation_v2",{
      p_application_id:applicationId,p_actor_id:actorId,
    });
    if(activationError||!activation||typeof activation.partner_id!=="string") {
      console.error("[partner-misp-documents] finalize failed",{code:activationError?.code||"invalid_result"});
      return reply({ok:false,error:"MISP documents saved, but Partner activation could not be completed. Contact Operations."},500);
    }
    return reply({ok:true,partner_id:activation.partner_id,finalized:true});
  }
  if(intent!=="upload")return reply({ok:false,error:"Unsupported document action."},400);
  const type=text(data.get("document_type"));
  const label=text(data.get("document_label")).slice(0,60);
  const file=data.get("file");
  if(!TYPES.has(type)||!(file instanceof File)||file.size===0)return reply({ok:false,error:"Choose a valid document."},400);
  if(type.startsWith("custom_")&&!/[A-Za-z0-9]/.test(label))return reply({ok:false,error:"Enter a document name for Other Document."},400);
  if(file.size>MAX_BYTES)return reply({ok:false,error:"File must be 10 MB or smaller."},413);
  if(!["application/pdf","image/jpeg","image/png"].includes(file.type))
    return reply({ok:false,error:"Upload a PDF, JPG or PNG file."},400);
  const ext=file.type==="application/pdf"?"pdf":file.type==="image/png"?"png":"jpg";
  const storagePath=`${applicationId}/intermediary/${type}/${randomUUID()}.${ext}`;
  const {data:previous}=await admin.from("intermediary_onboarding_documents")
    .select("storage_bucket,storage_path").eq("application_id",applicationId).eq("document_type",type).maybeSingle();
  const {error:uploadError}=await admin.storage.from(BUCKET).upload(storagePath,new Uint8Array(await file.arrayBuffer()),{contentType:file.type,upsert:false});
  if(uploadError)return reply({ok:false,error:"Document upload failed. Please retry."},500);
  const {error:recordError}=await admin.from("intermediary_onboarding_documents").upsert({
    application_id:applicationId,document_type:type,document_label:type.startsWith("custom_")?label:null,
    file_name:file.name,storage_bucket:BUCKET,storage_path:storagePath,mime_type:file.type,file_size:file.size,
    verification_status:"pending",uploaded_by:actorId,
  },{onConflict:"application_id,document_type"});
  if(recordError) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return reply({ok:false,error:"Document record could not be saved."},500);
  }
  // Safely remove replaced files only after verifying they are no longer referenced.
  if(previous?.storage_path&&previous.storage_path!==storagePath){
    const {count}=await admin.from("intermediary_onboarding_documents").select("id",{count:"exact",head:true})
      .eq("storage_bucket",previous.storage_bucket).eq("storage_path",previous.storage_path);
    if(count===0)await admin.storage.from(previous.storage_bucket).remove([previous.storage_path]);
  }
  if(type.startsWith("education_")) {
    const {data:other}=await admin.from("intermediary_onboarding_documents").select("id,storage_bucket,storage_path")
      .eq("application_id",applicationId).in("document_type",[
        "education_10th_marksheet","education_12th_marksheet","education_graduation_marksheet","education_post_graduation_marksheet",
      ]).neq("document_type",type);
    for(const item of other??[]){
      await admin.from("intermediary_onboarding_documents").delete().eq("id",item.id);
      const {count}=await admin.from("intermediary_onboarding_documents").select("id",{count:"exact",head:true})
        .eq("storage_bucket",item.storage_bucket).eq("storage_path",item.storage_path);
      if(count===0)await admin.storage.from(item.storage_bucket).remove([item.storage_path]);
    }
    await admin.from("posp_misp_onboarding_profiles").update({education_status:"received",updated_at:new Date().toISOString(),updated_by:actorId}).eq("application_id",applicationId);
  }
  return reply({ok:true,type,name:file.name});
}
/** Remove one document from the caller's editable MISP application, preserving referenced files. */
export async function DELETE(request:Request) {
  const body=await request.json().catch(()=>null) as {application_id?:unknown;document_type?:unknown}|null;
  const applicationId=body?.application_id;
  const type=body?.document_type;
  if(typeof applicationId!=="string"||typeof type!=="string"||!TYPES.has(type))
    return reply({ok:false,error:"Invalid document request."},400);
  const result=await authorize(request,applicationId);
  if("error" in result)return result.error;
  const {admin}=result;
  const {data:document,error:readError}=await admin.from("intermediary_onboarding_documents")
    .select("id,storage_bucket,storage_path").eq("application_id",applicationId).eq("document_type",type)
    .maybeSingle<{id:string;storage_bucket:string;storage_path:string}>();
  if(readError)return reply({ok:false,error:"Could not read selected document."},500);
  if(!document)return reply({ok:false,error:"Document is no longer available."},404);
  const {data:deleted,error:deleteError}=await admin.from("intermediary_onboarding_documents")
    .delete().eq("id",document.id).eq("application_id",applicationId).eq("document_type",type)
    .eq("storage_bucket",document.storage_bucket).eq("storage_path",document.storage_path).select("id");
  if(deleteError||deleted?.length!==1)return reply({ok:false,error:"Document could not be deleted. Refresh and retry."},409);
  const {count,error:countError}=await admin.from("intermediary_onboarding_documents")
    .select("id",{count:"exact",head:true})
    .eq("storage_bucket",document.storage_bucket).eq("storage_path",document.storage_path);
  if(!countError&&count===0)await admin.storage.from(document.storage_bucket).remove([document.storage_path]);
  return reply({ok:true,document_type:type});
}
