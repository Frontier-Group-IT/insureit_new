import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const BASE_REQUIRED_TYPES = ["aadhaar_front", "aadhaar_back", "pan_copy", "cancelled_cheque"] as const;

type ActivationResult = {
  partner_id?: unknown;
  identity_source?: unknown;
  already_active?: unknown;
};

type ActivationProfile = {
  workflow_stage: string;
  gst_number: string | null;
  partner_status: string | null;
  partner_id: string | null;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { application_id?: string } | null;
  const applicationId = body?.application_id?.trim();
  if (!applicationId) return NextResponse.json({ ok: false, message: "The application ID is missing." }, { status: 400 });

  const manager = await getScopedPospMispManager(applicationId);
  if (!manager?.id) {
    return NextResponse.json({ ok: false, message: "You are not authorized to activate this Partner application." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("workflow_stage,gst_number,partner_status,partner_id")
    .eq("application_id", applicationId)
    .maybeSingle<ActivationProfile>();

  const permanentPartnerId = profile?.partner_id?.trim();
  const activeRetry = Boolean(
    profile
      && profile.workflow_stage === "completed"
      && profile.partner_status === "active_partner"
      && permanentPartnerId
      && !permanentPartnerId.startsWith("PENDING-"),
  );

  if (!profile || (profile.workflow_stage !== "iib_processing" && !activeRetry)) {
    return NextResponse.json({ ok: false, message: "Partner activation is not available at the current stage." }, { status: 409 });
  }

  if (!activeRetry) {
    const { data: documents } = await admin
      .from("intermediary_onboarding_documents")
      .select("document_type")
      .eq("application_id", applicationId)
      .returns<Array<{ document_type: string }>>();
    const types = new Set((documents ?? []).map((document) => document.document_type));
    const required = [...BASE_REQUIRED_TYPES, ...(profile.gst_number ? ["gst_copy"] : [])];
    const missing = required.filter((type) => !types.has(type));
    if (missing.length) {
      return NextResponse.json(
        { ok: false, message: `Upload the remaining document${missing.length === 1 ? "" : "s"}: ${missing.join(", ").replaceAll("_", " ")}.` },
        { status: 400 },
      );
    }
  }

  const { data, error } = await admin.rpc("finalize_partner_activation_v2", {
    p_application_id: applicationId,
    p_actor_id: manager.id,
  });
  if (error || !data) {
    console.error("Atomic Partner activation failed", { applicationId, actorId: manager.id, code: error?.code });
    return NextResponse.json({ ok: false, message: "Partner activation could not be completed. No partial activation was retained." }, { status: 500 });
  }

  const result = data as ActivationResult;
  const partnerId = typeof result.partner_id === "string" ? result.partner_id : null;
  if (!partnerId) {
    console.error("Atomic Partner activation returned no Partner ID", { applicationId, actorId: manager.id });
    return NextResponse.json({ ok: false, message: "Partner activation could not be completed. No partial activation was retained." }, { status: 500 });
  }

  revalidatePath(`/intermediaries/applications/${applicationId}`);
  revalidatePath("/intermediaries/partner");
  return NextResponse.json({
    ok: true,
    partner_id: partnerId,
    identity_source: typeof result.identity_source === "string" ? result.identity_source : "generated",
    already_active: result.already_active === true,
  });
}
