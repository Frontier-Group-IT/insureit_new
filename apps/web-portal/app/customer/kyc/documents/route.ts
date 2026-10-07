import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const DOCUMENT_TYPES = new Set(["pan_copy", "aadhaar_front", "aadhaar_back", "gst_copy"]);

function extension(file: File) {
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  return "jpg";
}

export async function POST(request: Request) {
  const session = await getCustomerWebSession();
  const form = await request.formData();
  const applicationId = String(form.get("applicationId") ?? "").trim();
  const documentType = String(form.get("documentType") ?? "").trim();
  const file = form.get("file");

  if (!DOCUMENT_TYPES.has(documentType)) return NextResponse.json({ error: "Unsupported KYC document type." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a KYC document." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Upload PDF, JPG or PNG only." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "KYC document must be 5 MB or smaller." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const application = await supabase
    .from("customer_onboarding_applications")
    .select("id,status,partner_type")
    .eq("id", applicationId)
    .eq("profile_id", session.user.id)
    .maybeSingle();
  if (application.error || !application.data) return NextResponse.json({ error: "KYC application is not available." }, { status: 403 });
  if (["submitted", "under_review", "approved"].includes(application.data.status)) return NextResponse.json({ error: "KYC documents cannot be changed at this stage." }, { status: 409 });
  if (application.data.partner_type !== "individual_proprietor") return NextResponse.json({ error: "This document flow is only for Individual KYC." }, { status: 409 });

  const current = await supabase
    .from("customer_onboarding_documents")
    .select("id,storage_bucket,storage_path")
    .eq("application_id", applicationId)
    .eq("document_type", documentType)
    .maybeSingle();

  const storagePath = `${applicationId}/${documentType}/${Date.now()}-${crypto.randomUUID()}.${extension(file)}`;
  const bytes = await file.arrayBuffer();
  const upload = await supabase.storage.from("customer-documents").upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: "KYC document upload failed." }, { status: 500 });

  const record = await supabase
    .from("customer_onboarding_documents")
    .upsert({
      application_id: applicationId,
      document_type: documentType,
      file_name: file.name.slice(0, 200),
      storage_bucket: "customer-documents",
      storage_path: storagePath,
      mime_type: file.type,
      file_size: file.size,
      verification_status: "pending",
      rejection_reason: null,
      uploaded_by: session.user.id,
      verified_by: null,
      verified_at: null,
    }, { onConflict: "application_id,document_type" })
    .select("id,application_id,document_type,file_name,verification_status,rejection_reason")
    .single();

  if (record.error || !record.data) {
    await supabase.storage.from("customer-documents").remove([storagePath]);
    return NextResponse.json({ error: "KYC document could not be saved." }, { status: 500 });
  }
  if (current.data?.storage_path && current.data.storage_path !== storagePath) {
    await supabase.storage.from(current.data.storage_bucket).remove([current.data.storage_path]);
  }
  return NextResponse.json({ document: record.data });
}
