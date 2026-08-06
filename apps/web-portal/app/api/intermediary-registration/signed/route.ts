import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const DOCUMENT_BUCKET = "customer-documents";
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

export async function GET(request: Request) {
  const applicationId = new URL(request.url).searchParams.get("application_id")?.trim();
  if (!applicationId) return NextResponse.json({ ok: false, message: "Application ID is required." }, { status: 400 });

  const reviewer = await getScopedPospMispManager(applicationId);
  if (!reviewer?.id) return NextResponse.json({ ok: false, message: "This application is outside your permitted scope." }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const { data: document } = await admin
    .from("intermediary_onboarding_documents")
    .select("file_name,storage_bucket,storage_path,verification_status,created_at")
    .eq("application_id", applicationId)
    .eq("document_type", "signed_registration_form")
    .maybeSingle<{ file_name: string; storage_bucket: string; storage_path: string; verification_status: string; created_at: string }>();

  if (!document) return NextResponse.json({ ok: true, document: null }, { headers: { "Cache-Control": "no-store" } });
  const { data: signed } = await admin.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 900);
  return NextResponse.json({
    ok: true,
    document: {
      file_name: document.file_name,
      verification_status: document.verification_status,
      created_at: document.created_at,
      signed_url: signed?.signedUrl ?? null,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const data = await request.formData();
  const applicationId = text(data, "application_id");
  const selected = data.get("file");
  if (!applicationId || !(selected instanceof File) || selected.size === 0) {
    return NextResponse.json({ ok: false, message: "The signed registration upload is incomplete." }, { status: 400 });
  }

  const reviewer = await getScopedPospMispManager(applicationId);
  if (!reviewer?.id) return NextResponse.json({ ok: false, message: "This application is outside your permitted scope." }, { status: 403 });
  if (!ALLOWED_FILE_TYPES.has(selected.type)) return NextResponse.json({ ok: false, message: "Use a PDF, JPG or PNG file." }, { status: 400 });
  if (selected.size > MAX_FILE_SIZE) return NextResponse.json({ ok: false, message: "Signed registration form must be 4 MB or smaller." }, { status: 413 });

  const admin = createSupabaseAdminClient();
  const { data: application } = await admin
    .from("intermediary_onboarding_applications")
    .select("draft_data")
    .eq("id", applicationId)
    .maybeSingle<{ draft_data: Record<string, unknown> | null }>();
  if (!application) return NextResponse.json({ ok: false, message: "Application not found." }, { status: 404 });
  if (typeof application.draft_data?.registration_form_downloaded_at !== "string") {
    return NextResponse.json({ ok: false, message: "Download the generated registration form before uploading the signed copy." }, { status: 409 });
  }

  const extension = selected.type === "application/pdf" ? "pdf" : selected.type === "image/png" ? "png" : "jpg";
  const storagePath = `${applicationId}/intermediary/signed_registration_form/${randomUUID()}.${extension}`;
  const { data: previous } = await admin
    .from("intermediary_onboarding_documents")
    .select("storage_bucket,storage_path")
    .eq("application_id", applicationId)
    .eq("document_type", "signed_registration_form")
    .maybeSingle<{ storage_bucket: string; storage_path: string }>();

  const { error: uploadError } = await admin.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, new Uint8Array(await selected.arrayBuffer()), { contentType: selected.type, upsert: false });
  if (uploadError) return NextResponse.json({ ok: false, message: uploadError.message || "Signed registration form could not be stored." }, { status: 500 });

  const { error: recordError } = await admin.from("intermediary_onboarding_documents").upsert({
    application_id: applicationId,
    document_type: "signed_registration_form",
    document_label: null,
    file_name: selected.name,
    storage_bucket: DOCUMENT_BUCKET,
    storage_path: storagePath,
    mime_type: selected.type,
    file_size: selected.size,
    verification_status: "pending",
    uploaded_by: reviewer.id,
  }, { onConflict: "application_id,document_type" });

  if (recordError) {
    await admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    return NextResponse.json({ ok: false, message: recordError.message || "Signed registration record could not be saved." }, { status: 500 });
  }

  if (previous?.storage_path && previous.storage_path !== storagePath) {
    const { count } = await admin.from("intermediary_onboarding_documents").select("id", { count: "exact", head: true }).eq("storage_bucket", previous.storage_bucket).eq("storage_path", previous.storage_path);
    if (!count) await admin.storage.from(previous.storage_bucket).remove([previous.storage_path]);
  }

  return NextResponse.json({ ok: true, document_type: "signed_registration_form", file_name: selected.name }, { headers: { "Cache-Control": "no-store" } });
}

function text(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
