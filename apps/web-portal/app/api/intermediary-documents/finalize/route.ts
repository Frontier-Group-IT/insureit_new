import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const EDUCATION_TYPES = new Set(["education_10th_marksheet","education_12th_marksheet","education_graduation_marksheet","education_post_graduation_marksheet"]);
const BASE_REQUIRED_TYPES = ["aadhaar_front","aadhaar_back","pan_copy","cancelled_cheque","photograph","agreement_copy"] as const;

export async function POST(request: Request) {
  const manager = await requirePospMispManager();
  const body = (await request.json().catch(() => null)) as { application_id?: string } | null;
  const applicationId = body?.application_id?.trim();
  if (!applicationId) return NextResponse.json({ ok:false, message:"The application ID is missing." },{status:400});

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("posp_misp_onboarding_profiles").select("id,workflow_stage,partner_type,partner_id,gst_number").eq("application_id",applicationId).maybeSingle<{id:string;workflow_stage:string;partner_type:"posp"|"misp";partner_id:string|null;gst_number:string|null}>();
  if (!profile || profile.workflow_stage !== "iib_processing") return NextResponse.json({ok:false,message:"Document upload is not available at the current stage."},{status:409});

  const { data: documents } = await admin.from("intermediary_onboarding_documents").select("document_type").eq("application_id",applicationId).returns<Array<{document_type:string}>>();
  const types = new Set((documents??[]).map(document=>document.document_type));
  const hasEducation=[...EDUCATION_TYPES].some(type=>types.has(type));
  const required=[...BASE_REQUIRED_TYPES,...((profile.partner_type==="misp"||Boolean(profile.gst_number))?["gst_copy"]:[])];
  const missing=required.filter(type=>!types.has(type));
  if(!hasEducation||missing.length)return NextResponse.json({ok:false,message:!hasEducation?"Upload the education marksheet before saving.":`Upload the remaining document${missing.length===1?"":"s"}: ${missing.join(", ").replaceAll("_"," ")}.`},{status:400});

  let partnerId=profile.partner_id;
  if(!partnerId){
    const {data,error}=await admin.rpc("issue_partner_identity",{p_application_id:applicationId,p_actor_id:manager!.id});
    if(error||!data)return NextResponse.json({ok:false,message:error?.message||"Partner ID could not be issued."},{status:500});
    partnerId=String(data);
  }
  const {error:syncError}=await admin.rpc("sync_partner_intermediary",{p_application_id:applicationId});
  if(syncError)return NextResponse.json({ok:false,message:syncError.message||"Partner register could not be updated."},{status:500});
  const now=new Date().toISOString();
  await admin.from("posp_misp_onboarding_profiles").update({workflow_stage:"training",partner_status:"active_partner",training_status:"not_assigned",exam_status:"not_allotted",updated_by:manager!.id,updated_at:now}).eq("id",profile.id);
  await admin.from("intermediary_onboarding_applications").update({partner_status:"active_partner",registration_status:"training_pending",updated_at:now}).eq("id",applicationId);
  await admin.from("intermediary_training_exam_assignments").upsert({application_id:applicationId,training_status:"not_assigned",exam_status:"not_allotted",updated_by:manager!.id,updated_at:now},{onConflict:"application_id"});
  revalidatePath(`/intermediaries/applications/${applicationId}`);revalidatePath("/intermediaries/partner");
  return NextResponse.json({ok:true,partner_id:partnerId});
}
