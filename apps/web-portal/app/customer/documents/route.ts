import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function safeExtension(file: File) {
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  const session = await getCustomerWebSession();
  const form = await request.formData();
  const customerId = String(form.get("customerId") ?? "").trim();
  const documentType = String(form.get("documentType") ?? "Other").trim().slice(0, 80) || "Other";
  const file = form.get("file");

  if (!session.accounts.some((account) => account.id === customerId)) {
    return NextResponse.json({ error: "Customer account is not authorized." }, { status: 403 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a document to upload." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Upload PDF, JPG, PNG or WEBP only." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Document must be 5 MB or smaller." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const storagePath = `${customerId}/web/${Date.now()}-${crypto.randomUUID()}.${safeExtension(file)}`;
  const bytes = await file.arrayBuffer();
  const upload = await supabase.storage.from("customer-documents").upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: "Document upload failed." }, { status: 500 });

  const record = await supabase
    .from("customer_documents")
    .insert({
      customer_id: customerId,
      document_type: documentType,
      file_name: file.name.slice(0, 200),
      storage_bucket: "customer-documents",
      storage_path: storagePath,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: session.user.id,
    })
    .select("id,customer_id,document_type,file_name,storage_bucket,storage_path,mime_type,file_size,created_at")
    .single();

  if (record.error || !record.data) {
    await supabase.storage.from("customer-documents").remove([storagePath]);
    return NextResponse.json({ error: "Document uploaded but could not be saved." }, { status: 500 });
  }
  return NextResponse.json({ document: record.data });
}

export async function DELETE(request: Request) {
  const session = await getCustomerWebSession();
  let body: { customerId?: string; documentId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
  const customerId = String(body.customerId ?? "").trim();
  const documentId = String(body.documentId ?? "").trim();
  if (!session.accounts.some((account) => account.id === customerId)) {
    return NextResponse.json({ error: "Customer account is not authorized." }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  const existing = await supabase
    .from("customer_documents")
    .select("id,storage_bucket,storage_path")
    .eq("id", documentId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (existing.error || !existing.data) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const deletion = await supabase.from("customer_documents").delete().eq("id", documentId).eq("customer_id", customerId);
  if (deletion.error) return NextResponse.json({ error: "Document could not be deleted." }, { status: 500 });
  await supabase.storage.from(existing.data.storage_bucket).remove([existing.data.storage_path]);
  return NextResponse.json({ ok: true });
}