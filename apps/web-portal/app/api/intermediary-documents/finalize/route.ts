import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const EDUCATION_TYPES = new Set([
  "education_10th_marksheet",
  "education_12th_marksheet",
  "education_graduation_marksheet",
  "education_post_graduation_marksheet",
]);
const REQUIRED_TYPES = [
  "aadhaar_front",
  "aadhaar_back",
  "pan_copy",
  "cancelled_cheque",
  "photograph",
  "gst_copy",
  "agreement_copy",
] as const;

export async function POST(request: Request) {
  await requirePospMispManager();
  const body = (await request.json().catch(() => null)) as { application_id?: string } | null;
  const applicationId = body?.application_id?.trim();
  if (!applicationId) {
    return NextResponse.json({ ok: false, message: "The application ID is missing." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("workflow_stage")
    .eq("application_id", applicationId)
    .maybeSingle<{ workflow_stage: string }>();
  if (!profile || profile.workflow_stage !== "iib_processing") {
    return NextResponse.json({ ok: false, message: "Document upload is not available at the current stage." }, { status: 409 });
  }

  const { data: documents } = await admin
    .from("intermediary_onboarding_documents")
    .select("document_type")
    .eq("application_id", applicationId)
    .returns<Array<{ document_type: string }>>();
  const types = new Set((documents ?? []).map((document) => document.document_type));
  const hasEducation = [...EDUCATION_TYPES].some((type) => types.has(type));
  const missing = REQUIRED_TYPES.filter((type) => !types.has(type));
  if (!hasEducation || missing.length) {
    return NextResponse.json(
      {
        ok: false,
        message: !hasEducation
          ? "Upload the education marksheet before saving."
          : `Upload the remaining document${missing.length === 1 ? "" : "s"}: ${missing.join(", ").replaceAll("_", " ")}.`,
      },
      { status: 400 },
    );
  }

  revalidatePath(`/intermediaries/applications/${applicationId}`);
  return NextResponse.json({ ok: true });
}
