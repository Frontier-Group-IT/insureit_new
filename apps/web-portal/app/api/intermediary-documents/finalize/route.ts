import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const BASE_REQUIRED_TYPES = ["aadhaar_front","aadhaar_back","pan_copy","cancelled_cheque"] as const;

export async function POST(request: Request) {
  const manager = await requirePospMispManager();
  const body = (await request.json().catch(() => null)) as { application_id?: string } | null;
  const applicationId = body?.application_id?.trim();
  if (!applicationId) return NextResponse.json({ ok:false, message:"The application ID is missing." },{status:400});

  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: application }] = await Promise.all([
    admin.from("posp_misp_onboarding_profiles").select("id,workflow_stage,partner_type,partner_id,gst_number,raw_data").eq("application_id",applicationId).maybeSingle<{id:string;workflow_stage:string;partner_type:"posp"|"misp";partner_id:string|null;gst_number:string|null;raw_data:Record<string,unknown>|null}>(),
    admin.from("intermediary_onboarding_applications").select("draft_data").eq("id",applicationId).maybeSingle<{draft_data:Record<string,unknown>|null}>(),
  ]);
  if (!profile || profile.workflow_stage !== "iib_processing") return NextResponse.json({ok:false,message:"Document upload is not available at the current stage."},{status:409});

  const { data: documents } = await admin.from("intermediary_onboarding_documents").select("document_type").eq("application_id",applicationId).returns<Array<{document_type:string}>>();
  const types = new Set((documents??[]).map(document=>document.document_type));
  const required=[...BASE_REQUIRED_TYPES,...(profile.gst_number?["gst_copy"]:[])];
  const missing=required.filter(type=>!types.has(type));
  if(missing.length)return NextResponse.json({ok:false,message:`Upload the remaining document${missing.length===1?"":"s"}: ${missing.join(", ").replaceAll("_"," ")}.`},{status:400});

  const draft = object(application?.draft_data);
  const raw = object(profile.raw_data);
  const legacyMode = draft.onboarding_mode === "legacy_existing_partner" || raw.onboarding_mode === "legacy_existing_partner";
  const legacyPartnerId = text(draft.legacy_partner_code) ?? text(raw.legacy_partner_code);

  let partnerId: string;
  if (legacyMode) {
    if (!legacyPartnerId || legacyPartnerId.startsWith("PENDING-")) {
      return NextResponse.json({ok:false,message:"The verified existing Partner ID is missing."},{status:400});
    }
    const {data,error}=await admin.rpc("issue_legacy_partner_identity",{
      p_application_id:applicationId,
      p_actor_id:manager!.id,
      p_partner_id:legacyPartnerId,
    });
    if(error||!data)return NextResponse.json({ok:false,message:error?.message||"The existing Partner ID could not be activated."},{status:500});
    partnerId=String(data);
  } else {
    const {data,error}=await admin.rpc("issue_partner_identity",{p_application_id:applicationId,p_actor_id:manager!.id});
    if(error||!data)return NextResponse.json({ok:false,message:error?.message||"Partner ID could not be issued."},{status:500});
    partnerId=String(data);
  }

  const {error:syncError}=await admin.rpc("sync_partner_intermediary",{p_application_id:applicationId});
  if(syncError)return NextResponse.json({ok:false,message:syncError.message||"Partner register could not be updated."},{status:500});
  const now=new Date().toISOString();
  await admin.from("posp_misp_onboarding_profiles").update({workflow_stage:"completed",partner_status:"active_partner",final_account_type:"partner",updated_by:manager!.id,updated_at:now}).eq("id",profile.id);
  await admin.from("intermediary_onboarding_applications").update({final_type:"partner",partner_status:"active_partner",status:"approved",registration_status:"partner_active",updated_at:now}).eq("id",applicationId);
  revalidatePath(`/intermediaries/applications/${applicationId}`);revalidatePath("/intermediaries/partner");
  return NextResponse.json({ok:true,partner_id:partnerId,identity_source:legacyMode?"legacy_manual":"generated"});
}

function object(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>: {}}
function text(value:unknown){return typeof value==="string"&&value.trim()?value.trim().toUpperCase():null}
