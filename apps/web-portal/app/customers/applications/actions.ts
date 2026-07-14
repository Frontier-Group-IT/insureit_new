"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { approvePortalOnboardingApplication } from "../onboarding-applications";

type Draft = Record<string, unknown>;
type Application = { id: string; profile_id: string | null; partner_type: string | null; status: string; applicant_phone: string | null; applicant_email: string | null; draft_data: Draft | null };
type ApplicationDocument = { id: string; document_type: string; file_name: string; storage_bucket: string; storage_path: string; mime_type: string | null; file_size: number | null };

export async function approveMobileIndividualApplication(formData: FormData) {
  const applicationId = value(formData, "application_id");
  if (!applicationId) redirect("/customers/applications?error=missing_application");
  const reviewer = await requireMasterDataManager();
  if (!reviewer?.id) redirect(`/customers/applications/${applicationId}?error=unauthorized`);
  const admin = await createServerSupabaseClient();
  const { data: application, error: applicationError } = await admin.from("customer_onboarding_applications").select("id, profile_id, partner_type, status, applicant_phone, applicant_email, draft_data").eq("id", applicationId).single<Application>();
  if (applicationError || !application) redirect(`/customers/applications/${applicationId}?error=application_not_found`);
  if (!application.profile_id || application.partner_type !== "individual_proprietor" || !["submitted", "under_review"].includes(application.status)) redirect(`/customers/applications/${applicationId}?error=application_not_ready`);

  const draft = application.draft_data ?? {};
  const contactName = text(draft.contact_name);
  const panNumber = text(draft.pan_number);
  const aadhaarLastFour = text(draft.aadhaar_last_four);
  const aadhaarHash = text(draft.aadhaar_hash);
  const street = text(draft.address_street);
  const locality = text(draft.address_locality);
  const locationId = text(draft.india_location_id);
  const city = text(draft.city);
  const state = text(draft.state);
  const postalCode = text(draft.postal_code);
  const legalTradeName = text(draft.legal_trade_name);
  const gstNumber = text(draft.gst_number);
  const fleetSizeBand = text(draft.fleet_size_band);
  const isGstRegistered = draft.is_gst_registered === true;
  const phone = application.applicant_phone;
  const email = text(draft.email) ?? application.applicant_email;
  if (!contactName || !phone || !panNumber || !aadhaarLastFour || !aadhaarHash || !street || !locationId || !city || !state || !postalCode || !fleetSizeBand) redirect(`/customers/applications/${applicationId}?error=incomplete_application`);

  const { data: documents, error: documentError } = await admin.from("customer_onboarding_documents").select("id, document_type, file_name, storage_bucket, storage_path, mime_type, file_size").eq("application_id", applicationId).returns<ApplicationDocument[]>();
  if (documentError) redirect(`/customers/applications/${applicationId}?error=documents_unavailable`);
  const required = new Set(["pan_copy", "aadhaar_front", "aadhaar_back", ...(isGstRegistered ? ["gst_copy"] : [])]);
  if ([...required].some((type) => !(documents ?? []).some((document) => document.document_type === type))) redirect(`/customers/applications/${applicationId}?error=documents_incomplete`);

  const { data: duplicate } = await admin.from("customers").select("id").or(`profile_id.eq.${application.profile_id},phone.eq.${phone},pan_number.eq.${panNumber},aadhaar_hash.eq.${aadhaarHash}`).limit(1).maybeSingle<{ id: string }>();
  if (duplicate) redirect(`/customers/applications/${applicationId}?error=customer_already_exists`);

  const customerId = randomUUID();
  const copiedPaths: string[] = [];
  const permanentDocuments: Array<Record<string, unknown>> = [];
  for (const document of documents ?? []) {
    const { data: file, error: downloadError } = await admin.storage.from(document.storage_bucket).download(document.storage_path);
    if (downloadError || !file) {
      if (copiedPaths.length) await admin.storage.from("customer-documents").remove(copiedPaths);
      redirect(`/customers/applications/${applicationId}?error=document_copy_failed`);
    }
    const path = `${customerId}/${document.document_type}/${randomUUID()}.${extension(document)}`;
    const { error: uploadError } = await admin.storage.from("customer-documents").upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: document.mime_type ?? "application/octet-stream", upsert: false });
    if (uploadError) {
      if (copiedPaths.length) await admin.storage.from("customer-documents").remove(copiedPaths);
      redirect(`/customers/applications/${applicationId}?error=document_copy_failed`);
    }
    copiedPaths.push(path);
    permanentDocuments.push({ customer_id: customerId, document_type: document.document_type, file_name: document.file_name, storage_bucket: "customer-documents", storage_path: path, mime_type: document.mime_type, file_size: document.file_size, verification_status: "verified", upload_source: "customer_app", uploaded_by: application.profile_id, verified_by: reviewer.id, verified_at: new Date().toISOString() });
  }

  const now = new Date().toISOString();
  const { error: customerError } = await admin.from("customers").insert({
    id: customerId,
    profile_id: application.profile_id,
    customer_code: `CUST-${Date.now().toString().slice(-9)}`,
    partner_type: "individual_proprietor",
    contact_name: contactName,
    company_name: legalTradeName,
    phone,
    email,
    address: [street, locality, city, state, postalCode].filter(Boolean).join(", "),
    address_street: street,
    address_locality: locality,
    india_location_id: locationId,
    city,
    state,
    postal_code: postalCode,
    pan_number: panNumber,
    aadhaar_last_four: aadhaarLastFour,
    aadhaar_hash: aadhaarHash,
    legal_trade_name: legalTradeName,
    is_gst_registered: isGstRegistered,
    gst_number: isGstRegistered ? gstNumber : null,
    fleet_size_band: fleetSizeBand,
    onboarding_status: "active",
    onboarding_completed_at: now,
    created_by: reviewer.id,
    updated_by: reviewer.id
  });
  if (customerError) {
    await admin.storage.from("customer-documents").remove(copiedPaths);
    redirect(`/customers/applications/${applicationId}?error=customer_create_failed`);
  }

  const { error: metadataError } = await admin.from("customer_documents").insert(permanentDocuments);
  if (metadataError) {
    await admin.from("customers").delete().eq("id", customerId);
    await admin.storage.from("customer-documents").remove(copiedPaths);
    redirect(`/customers/applications/${applicationId}?error=document_records_failed`);
  }
  await admin.from("customer_onboarding_documents").update({ verification_status: "verified", verified_by: reviewer.id, verified_at: now, rejection_reason: null }).eq("application_id", applicationId);
  await approvePortalOnboardingApplication(admin, applicationId, customerId, reviewer.id);
  revalidatePath("/customers");
  revalidatePath("/customers/applications");
  redirect(`/customers/${customerId}/edit?success=kyc_approved`);
}

export async function requestMobileApplicationChanges(formData: FormData) {
  const applicationId = value(formData, "application_id");
  const reason = value(formData, "reason");
  if (!applicationId) redirect("/customers/applications?error=missing_application");
  const reviewer = await requireMasterDataManager();
  if (!reviewer?.id) redirect(`/customers/applications/${applicationId}?error=unauthorized`);
  if (!reason || reason.length < 8) redirect(`/customers/applications/${applicationId}?error=reason_required`);
  const admin = await createServerSupabaseClient();
  const { data } = await admin.from("customer_onboarding_applications").select("draft_data").eq("id", applicationId).single<{ draft_data: Draft | null }>();
  await admin.from("customer_onboarding_applications").update({ status: "changes_requested", reviewed_by: reviewer.id, reviewed_at: new Date().toISOString(), draft_data: { ...(data?.draft_data ?? {}), review_notes: reason } }).eq("id", applicationId).in("status", ["submitted", "under_review"]);
  revalidatePath("/customers/applications");
  revalidatePath(`/customers/applications/${applicationId}`);
  redirect(`/customers/applications/${applicationId}?success=changes_requested`);
}

function value(formData: FormData, name: string) { const field = formData.get(name); return typeof field === "string" && field.trim() ? field.trim() : null; }
function text(input: unknown) { return typeof input === "string" && input.trim() ? input.trim() : null; }
function extension(document: ApplicationDocument) { if (document.mime_type === "application/pdf") return "pdf"; if (document.mime_type === "image/png") return "png"; return "jpg"; }
