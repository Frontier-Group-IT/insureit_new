"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type LifeHealthIssuedDocumentType = "policy_copy" | "proposal_form" | "kyc" | "other_document";
export type LifeHealthIssuedDocument = { id: string; type: LifeHealthIssuedDocumentType; fileName: string; viewUrl: string };
export type LifeHealthIssuedDocumentResult = { ok: true; document: LifeHealthIssuedDocument | null } | { ok: false; error: string };

const DOCUMENT_BUCKET = "policy-documents";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const DOCUMENT_TYPES = new Set<LifeHealthIssuedDocumentType>(["policy_copy", "proposal_form", "kyc", "other_document"]);
const clean = (value: unknown) => String(value ?? "").trim();
const safeFileName = (name: string) => name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-") || "document";

function revalidateIssuedPolicy(policyId: string, caseId: string) {
  revalidatePath("/policies");
  revalidatePath(`/policies/${policyId}`);
  revalidatePath(`/policies/${policyId}/edit`);
  revalidatePath(`/policies/life-health-cases/${caseId}`);
}

async function context(formData: FormData) {
  const profile = await requirePolicyEditor();
  const policyId = clean(formData.get("policyId"));
  const caseId = clean(formData.get("caseId"));
  const type = clean(formData.get("documentType")) as LifeHealthIssuedDocumentType;
  if (!policyId || !caseId || !DOCUMENT_TYPES.has(type)) return { profile, policyId, caseId, type, admin: null, valid: false };
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("life_health_cases").select("id").eq("id", caseId).eq("final_policy_id", policyId).maybeSingle<{ id: string }>();
  return { profile, policyId, caseId, type, admin, valid: Boolean(data) };
}

export async function replaceIssuedLifeHealthDocument(formData: FormData): Promise<LifeHealthIssuedDocumentResult> {
  const ctx = await context(formData);
  if (!ctx.valid || !ctx.admin) return { ok: false, error: "The linked Life/Health policy case or document type is invalid." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) return { ok: false, error: "Choose a document to upload." };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "Document must be 50 MB or smaller." };
  if (!ALLOWED_MIME_TYPES.has(file.type)) return { ok: false, error: "Upload a PDF, JPG, PNG or WebP document." };

  const { data: existing } = await ctx.admin.from("life_health_case_documents")
    .select("id,storage_bucket,storage_path").eq("case_id", ctx.caseId).eq("document_type", ctx.type)
    .maybeSingle<{ id: string; storage_bucket: string; storage_path: string }>();
  const fileName = file.name || "document";
  const storagePath = `life-health-cases/${ctx.caseId}/${ctx.type}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await ctx.admin.storage.from(DOCUMENT_BUCKET).upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: "The document could not be uploaded." };

  const values = { file_name: fileName, storage_bucket: DOCUMENT_BUCKET, storage_path: storagePath, mime_type: file.type, file_size: file.size, uploaded_by: ctx.profile.id, updated_at: new Date().toISOString() };
  let documentId = existing?.id || "";
  if (existing) {
    const { error } = await ctx.admin.from("life_health_case_documents").update(values).eq("id", existing.id);
    if (error) { await ctx.admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]); return { ok: false, error: "The document record could not be updated." }; }
    if (existing.storage_path && existing.storage_path !== storagePath) await ctx.admin.storage.from(existing.storage_bucket || DOCUMENT_BUCKET).remove([existing.storage_path]);
  } else {
    const { data, error } = await ctx.admin.from("life_health_case_documents").insert({ case_id: ctx.caseId, document_type: ctx.type, ...values }).select("id").single<{ id: string }>();
    if (error || !data) { await ctx.admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]); return { ok: false, error: "The document record could not be saved." }; }
    documentId = data.id;
  }
  const { data: signed } = await ctx.admin.storage.from(DOCUMENT_BUCKET).createSignedUrl(storagePath, 60 * 60);
  revalidateIssuedPolicy(ctx.policyId, ctx.caseId);
  return { ok: true, document: { id: documentId, type: ctx.type, fileName, viewUrl: signed?.signedUrl || "" } };
}

export async function deleteIssuedLifeHealthDocument(formData: FormData): Promise<LifeHealthIssuedDocumentResult> {
  const ctx = await context(formData);
  if (!ctx.valid || !ctx.admin) return { ok: false, error: "The linked Life/Health policy case or document type is invalid." };
  const { data: existing } = await ctx.admin.from("life_health_case_documents")
    .select("id,storage_bucket,storage_path").eq("case_id", ctx.caseId).eq("document_type", ctx.type)
    .maybeSingle<{ id: string; storage_bucket: string; storage_path: string }>();
  if (!existing) return { ok: true, document: null };
  const { error } = await ctx.admin.from("life_health_case_documents").delete().eq("id", existing.id);
  if (error) return { ok: false, error: "The document could not be removed." };
  if (existing.storage_path) await ctx.admin.storage.from(existing.storage_bucket || DOCUMENT_BUCKET).remove([existing.storage_path]);
  revalidateIssuedPolicy(ctx.policyId, ctx.caseId);
  return { ok: true, document: null };
}
