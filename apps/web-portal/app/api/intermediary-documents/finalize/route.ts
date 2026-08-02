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

type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type SafeActivationFailure = {
  status: number;
  code: string;
  message: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { application_id?: string } | null;
  const applicationId = body?.application_id?.trim();
  if (!applicationId) return NextResponse.json({ ok: false, code: "application_id_missing", message: "The application ID is missing." }, { status: 400 });

  const manager = await getScopedPospMispManager(applicationId);
  if (!manager?.id) {
    return NextResponse.json({ ok: false, code: "partner_activation_forbidden", message: "You are not authorized to activate this Partner application." }, { status: 403 });
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
    return NextResponse.json({ ok: false, code: "partner_activation_stage_locked", message: "Partner activation is not available at the current stage." }, { status: 409 });
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
        { ok: false, code: "partner_documents_incomplete", message: `Upload the remaining document${missing.length === 1 ? "" : "s"}: ${missing.join(", ").replaceAll("_", " ")}.` },
        { status: 400 },
      );
    }
  }

  const { data, error } = await admin.rpc("finalize_partner_activation_v2", {
    p_application_id: applicationId,
    p_actor_id: manager.id,
  });
  if (error || !data) {
    const failure = classifyActivationFailure(error as DatabaseError | null);
    console.error("Atomic Partner activation failed", {
      applicationId,
      actorId: manager.id,
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      safeCode: failure.code,
    });
    return NextResponse.json({ ok: false, code: failure.code, message: failure.message }, { status: failure.status });
  }

  const result = data as ActivationResult;
  const partnerId = typeof result.partner_id === "string" ? result.partner_id : null;
  if (!partnerId) {
    console.error("Atomic Partner activation returned no Partner ID", { applicationId, actorId: manager.id });
    return NextResponse.json({ ok: false, code: "partner_activation_invalid_result", message: "Partner activation could not be completed. No partial activation was retained." }, { status: 500 });
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

function classifyActivationFailure(error: DatabaseError | null): SafeActivationFailure {
  const code = error?.code ?? "";
  const text = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();

  if (code === "PGRST202" || code === "42883" || text.includes("finalize_partner_activation_v2")) {
    return {
      status: 503,
      code: "partner_activation_database_upgrade_required",
      message: "Partner activation is temporarily unavailable because the required database upgrade has not been applied.",
    };
  }

  if (code === "23505" || text.includes("duplicate key") || text.includes("already exists")) {
    return {
      status: 409,
      code: "partner_identity_duplicate",
      message: "This Partner ID is already linked to another record. Review the existing Partner before trying again.",
    };
  }

  if (text.includes("verified existing partner id is missing") || text.includes("permanent partner id was not issued")) {
    return {
      status: 409,
      code: "partner_identity_missing",
      message: "A valid permanent Partner ID is required before this existing Partner can be activated.",
    };
  }

  if (text.includes("workflow stage") || text.includes("current workflow stage")) {
    return {
      status: 409,
      code: "partner_activation_stage_locked",
      message: "Partner activation is not available at the current stage.",
    };
  }

  if (code === "23514" || code === "23502") {
    return {
      status: 409,
      code: "partner_activation_data_incompatible",
      message: "The Partner record contains a value that is not compatible with the current database rules. Review the record and database migration state.",
    };
  }

  if (text.includes("register synchronization") || text.includes("canonical partner") || text.includes("partner register state is inconsistent")) {
    return {
      status: 409,
      code: "partner_activation_sync_failed",
      message: "The Partner identity could not be synchronized across the Partner register. No partial activation was retained.",
    };
  }

  if (code === "42501") {
    return {
      status: 503,
      code: "partner_activation_database_permission",
      message: "Partner activation is temporarily unavailable because the database operation is not authorized.",
    };
  }

  return {
    status: 500,
    code: "partner_activation_failed",
    message: "Partner activation could not be completed. No partial activation was retained.",
  };
}
