"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const DOCUMENT_BUCKET = "customer-documents";
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const documentTypes = ["pan_copy", "aadhaar_front", "aadhaar_back", "gst_copy"] as const;

function textValue(formData: FormData, name: string) { const value = formData.get(name); return typeof value === "string" && value.trim() ? value.trim() : null; }
function fileValue(formData: FormData, name: string) { const value = formData.get(name); return value instanceof File && value.size > 0 ? value : null; }
function safeExtension(file: File) { if (file.type === "application/pdf") return "pdf"; if (file.type === "image/png") return "png"; return "jpg"; }

export async function updateCustomerProfile(id: string, formData: FormData) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !canManageMasterData(profile.role)) throw new Error("You are not authorized to update customers.");
  const contactName = textValue(formData, "contact_name");
  if (!contactName) throw new Error("Customer name is required.");

  const admin = createSupabaseAdminClient();
  const isGstRegistered = formData.get("is_gst_registered") === "true";
  const panNumber = textValue(formData, "pan_number")?.toUpperCase() ?? null;
  const gstNumber = textValue(formData, "gst_number")?.replace(/\s/g, "").toUpperCase() ?? null;

  const { error } = await admin.from("customers").update({
    contact_name: contactName,
    company_name: textValue(formData, "legal_trade_name"),
    legal_trade_name: textValue(formData, "legal_trade_name"),
    email: textValue(formData, "email"),
    address_street: textValue(formData, "address_street"),
    address_locality: textValue(formData, "address_locality"),
    address: textValue(formData, "address"),
    city: textValue(formData, "city"),
    state: textValue(formData, "state"),
    postal_code: textValue(formData, "postal_code"),
    partner_type: textValue(formData, "partner_type"),
    fleet_size_band: textValue(formData, "fleet_size_band"),
    pan_number: panNumber,
    is_gst_registered: isGstRegistered,
    gst_number: isGstRegistered ? gstNumber : null,
    onboarding_status: textValue(formData, "onboarding_status") ?? "active",
    assigned_agent_id: textValue(formData, "assigned_agent_id"),
    updated_by: profile.id
  }).eq("id", id);
  if (error) throw new Error(error.message);

  for (const documentType of documentTypes) {
    const file = fileValue(formData, documentType);
    if (!file) continue;
    if (!ALLOWED_FILE_TYPES.has(file.type)) throw new Error(`${documentType.replaceAll("_", " ")} must be PDF, JPG or PNG.`);
    if (file.size > MAX_FILE_SIZE) throw new Error(`${documentType.replaceAll("_", " ")} must be 5 MB or smaller.`);

    const { data: oldDocuments } = await admin.from("customer_documents").select("id, storage_path").eq("customer_id", id).eq("document_type", documentType);
    const oldPaths = (oldDocuments ?? []).map((row: { storage_path: string | null }) => row.storage_path).filter((path: string | null): path is string => Boolean(path));
    if (oldPaths.length) await admin.storage.from(DOCUMENT_BUCKET).remove(oldPaths);
    if ((oldDocuments?.length ?? 0) > 0) await admin.from("customer_documents").delete().eq("customer_id", id).eq("document_type", documentType);

    const storagePath = `${id}/${documentType}/${randomUUID()}.${safeExtension(file)}`;
    const { error: uploadError } = await admin.storage.from(DOCUMENT_BUCKET).upload(storagePath, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const { error: metadataError } = await admin.from("customer_documents").insert({ customer_id: id, document_type: documentType, file_name: file.name, storage_bucket: DOCUMENT_BUCKET, storage_path: storagePath, mime_type: file.type, file_size: file.size, verification_status: "pending", uploaded_by: profile.id });
    if (metadataError) throw new Error(metadataError.message);
  }

  const requiredTypes = isGstRegistered ? documentTypes : documentTypes.filter((type) => type !== "gst_copy");
  const { data: savedDocuments } = await admin.from("customer_documents").select("document_type").eq("customer_id", id).in("document_type", [...requiredTypes]);
  const savedTypes = new Set((savedDocuments ?? []).map((row: { document_type: string }) => row.document_type));
  const hasAllRequiredDocuments = requiredTypes.every((type) => savedTypes.has(type));

  await admin.from("customers").update({
    onboarding_status: hasAllRequiredDocuments ? "active" : "documents_pending",
    updated_by: profile.id
  }).eq("id", id);

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}/edit`, "page");
  redirect(`/customers/${id}/edit?updated=${Date.now()}#documents`);
}
