import { NextResponse } from "next/server";
import { getScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type StoredDocument = {
  document_type: string;
  document_label: string | null;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
};

type LinkedApplication = {
  id: string;
  draft_data: Record<string, unknown> | null;
};

export async function GET(request: Request) {
  const applicationId = new URL(request.url).searchParams.get("application_id")?.trim();
  if (!applicationId) {
    return NextResponse.json({ ok: false, message: "The application ID is missing." }, { status: 400 });
  }

  const manager = await getScopedPospMispManager(applicationId);
  if (!manager?.id) {
    return NextResponse.json(
      { ok: false, message: "This application is outside your permitted Intermediary hierarchy." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const admin = createSupabaseAdminClient();
  const [{ data: application }, { data: profile }, { data: documents, error: documentError }] = await Promise.all([
    admin
      .from("intermediary_onboarding_applications")
      .select("id,draft_data,partner_record_id")
      .eq("id", applicationId)
      .maybeSingle<{ id: string; draft_data: Record<string, unknown> | null; partner_record_id: string | null }>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("gst_number,record_source,existing_registration_confirmed")
      .eq("application_id", applicationId)
      .maybeSingle<{ gst_number: string | null; record_source: string | null; existing_registration_confirmed: boolean | null }>(),
    admin
      .from("intermediary_onboarding_documents")
      .select("document_type,document_label,file_name,storage_bucket,storage_path")
      .eq("application_id", applicationId)
      .order("created_at")
      .returns<StoredDocument[]>(),
  ]);

  if (!application || !profile) {
    return NextResponse.json({ ok: false, message: "This application could not be found." }, { status: 404 });
  }
  if (documentError) {
    return NextResponse.json({ ok: false, message: "The document list could not be loaded." }, { status: 500 });
  }

  const draft = asObject(application.draft_data);
  const accountContext = draft.account_context === "posp" || draft.account_context === "misp" ? draft.account_context : "partner";
  const legacy =
    profile.existing_registration_confirmed === true
    || profile.record_source === "excel_import"
    || profile.record_source === "legacy_import"
    || draft.legacy_mode === "existing"
    || draft.record_source === "legacy_import";

  const resolvedDocuments = [...(documents ?? [])];

  // A signed POSP/MISP registration certificate belongs to the child account,
  // but it is also compliance evidence for the parent Partner. Project the same
  // stored object into the Partner's document view instead of copying the file.
  if (accountContext === "partner" && !resolvedDocuments.some((document) => document.document_type === "signed_registration_form")) {
    const linkedApplication = await findLinkedIntermediaryApplication(admin, applicationId, application.partner_record_id);
    if (linkedApplication) {
      const { data: linkedCertificate } = await admin
        .from("intermediary_onboarding_documents")
        .select("document_type,document_label,file_name,storage_bucket,storage_path")
        .eq("application_id", linkedApplication.id)
        .eq("document_type", "signed_registration_form")
        .maybeSingle<StoredDocument>();
      if (linkedCertificate) resolvedDocuments.push(linkedCertificate);
    }
  }

  const signedDocuments = await Promise.all(resolvedDocuments.map(async (document) => {
    const { data } = await admin.storage
      .from(document.storage_bucket)
      .createSignedUrl(document.storage_path, 900);
    return {
      document_type: document.document_type,
      document_label: document.document_label,
      file_name: document.file_name,
      href: data?.signedUrl ?? null,
    };
  }));

  return NextResponse.json(
    {
      ok: true,
      application_id: applicationId,
      legacy,
      has_gst: Boolean(profile.gst_number?.trim()),
      documents: signedDocuments,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function findLinkedIntermediaryApplication(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  parentApplicationId: string,
  partnerRecordId: string | null,
) {
  if (partnerRecordId) {
    const { data: candidates } = await admin
      .from("intermediary_onboarding_applications")
      .select("id,draft_data")
      .eq("partner_record_id", partnerRecordId)
      .neq("id", parentApplicationId)
      .order("created_at", { ascending: false })
      .returns<LinkedApplication[]>();
    const linked = (candidates ?? []).find((candidate) => {
      const context = asObject(candidate.draft_data).account_context;
      return context === "posp" || context === "misp";
    });
    if (linked) return linked;
  }

  const { data: fallback } = await admin
    .from("intermediary_onboarding_applications")
    .select("id,draft_data")
    .contains("draft_data", { parent_partner_application_id: parentApplicationId })
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<LinkedApplication[]>();
  return (fallback ?? []).find((candidate) => {
    const context = asObject(candidate.draft_data).account_context;
    return context === "posp" || context === "misp";
  }) ?? null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
