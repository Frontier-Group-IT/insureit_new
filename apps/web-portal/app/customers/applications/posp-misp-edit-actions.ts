"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { encryptSensitiveValue } from "@/lib/sensitive-data";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const DOCUMENT_BUCKET = "customer-documents";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const EDUCATION_DOCUMENT_TYPES = new Set([
  "education_10th_marksheet",
  "education_12th_marksheet",
  "education_graduation_marksheet",
  "education_post_graduation_marksheet"
]);
const DOCUMENT_FIELDS = [
  "aadhaar_front",
  "aadhaar_back",
  "pan_copy",
  "cancelled_cheque",
  "photograph",
  "gst_copy",
  "agreement_copy"
] as const;

export async function updateSubmittedPospMispApplication(data: FormData) {
  const reviewer = await requireMasterDataManager();
  const applicationId = value(data, "application_id");
  if (!applicationId || !reviewer?.id) redirect("/customers/posp-misp");

  const admin = createSupabaseAdminClient();
  const [{ data: application }, { data: profile }] = await Promise.all([
    admin
      .from("customer_onboarding_applications")
      .select("id, partner_type, status, customer_id, draft_data")
      .eq("id", applicationId)
      .maybeSingle<{
        id: string;
        partner_type: "posp" | "misp";
        status: string;
        customer_id: string | null;
        draft_data: Record<string, unknown> | null;
      }>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("id, partner_type, aadhaar_last_four, aadhaar_hash, aadhaar_number_encrypted")
      .eq("application_id", applicationId)
      .maybeSingle<{
        id: string;
        partner_type: "posp" | "misp";
        aadhaar_last_four: string | null;
        aadhaar_hash: string | null;
        aadhaar_number_encrypted: string | null;
      }>()
  ]);
  if (
    !application
    || !profile
    || application.customer_id
    || !["submitted", "under_review", "changes_requested"].includes(application.status)
  ) redirect(`/customers/applications/${applicationId}?error=posp_misp_edit_locked`);

  const partnerType = profile.partner_type;
  const applicantPhone = normalizePhone(value(data, "applicant_phone"));
  const dpPhone = partnerType === "misp" ? normalizePhone(value(data, "dp_phone")) : null;
  const posName = partnerType === "posp" ? value(data, "pos_name") : null;
  const mispName = partnerType === "misp" ? value(data, "misp_name") : null;
  const aadhaarDigits = value(data, "aadhaar_number")?.replace(/\D/g, "") ?? "";
  if (!applicantPhone || (partnerType === "posp" ? !posName : !mispName || !dpPhone)) {
    redirect(`/customers/applications/${applicationId}?error=posp_misp_edit_invalid`);
  }
  if (aadhaarDigits && !/^[0-9]{12}$/.test(aadhaarDigits)) {
    redirect(`/customers/applications/${applicationId}?error=posp_misp_aadhaar_invalid`);
  }

  const associateProfileId = value(data, "associate_profile_id");
  const bankId = value(data, "bank_id");
  const [{ data: associate }, { data: bank }, { data: manufacturer }] = await Promise.all([
    associateProfileId
      ? admin.from("profiles").select("id, full_name, employee_code").eq("id", associateProfileId).eq("role", "sales_manager").eq("is_active", true).maybeSingle<{ id: string; full_name: string | null; employee_code: string | null }>()
      : Promise.resolve({ data: null }),
    bankId
      ? admin.from("banks").select("id, name").eq("id", bankId).eq("is_active", true).maybeSingle<{ id: string; name: string }>()
      : Promise.resolve({ data: null }),
    partnerType === "misp" && value(data, "oem_name")
      ? admin.from("vehicle_manufacturers").select("name").eq("name", value(data, "oem_name")!).eq("is_active", true).maybeSingle<{ name: string }>()
      : Promise.resolve({ data: null })
  ]);
  if (!associate || !bank || (partnerType === "misp" && !manufacturer)) {
    redirect(`/customers/applications/${applicationId}?error=posp_misp_edit_invalid`);
  }

  const aadhaar = aadhaarDigits
    ? {
      lastFour: aadhaarDigits.slice(-4),
      hash: createHash("sha256").update(aadhaarDigits).digest("hex"),
      encrypted: encryptSensitiveValue(aadhaarDigits)
    }
    : {
      lastFour: profile.aadhaar_last_four,
      hash: profile.aadhaar_hash,
      encrypted: profile.aadhaar_number_encrypted
    };

  const profileUpdate = {
    associate_profile_id: associate.id,
    associate_name: associate.full_name,
    associate_id: associate.employee_code,
    external_onboarding_id: value(data, "external_onboarding_id"),
    document_received_at: value(data, "document_received_at"),
    pos_name: posName,
    misp_name: mispName,
    applicant_phone: applicantPhone,
    applicant_email: value(data, "applicant_email")?.toLowerCase() ?? null,
    date_of_birth: value(data, "date_of_birth"),
    aadhaar_last_four: aadhaar.lastFour,
    aadhaar_hash: aadhaar.hash,
    aadhaar_number_encrypted: aadhaar.encrypted,
    pan_number: value(data, "pan_number")?.toUpperCase() ?? null,
    gst_number: value(data, "gst_number")?.toUpperCase() ?? null,
    address: value(data, "address"),
    city: value(data, "city"),
    state: value(data, "state"),
    postal_code: value(data, "postal_code"),
    bank_id: bank.id,
    bank_name: bank.name,
    bank_account_number: value(data, "bank_account_number"),
    bank_ifsc_code: value(data, "bank_ifsc_code")?.toUpperCase() ?? null,
    oem_name: partnerType === "misp" ? manufacturer?.name ?? null : null,
    dp_name: partnerType === "misp" ? value(data, "dp_name") : null,
    dp_phone: dpPhone,
    dp_email: partnerType === "misp" ? value(data, "dp_email")?.toLowerCase() ?? null : null,
    dp_pan_number: partnerType === "misp" ? value(data, "dp_pan_number")?.toUpperCase() ?? null : null,
    updated_by: reviewer.id
  };
  const { error: profileError } = await admin
    .from("posp_misp_onboarding_profiles")
    .update(profileUpdate)
    .eq("id", profile.id);
  if (profileError) redirect(`/customers/applications/${applicationId}?error=posp_misp_edit_failed`);

  const draftData = {
    ...(application.draft_data ?? {}),
    ...profileUpdate,
    aadhaar_number_encrypted: undefined,
    aadhaar_hash: undefined,
    aadhaar_last_four: aadhaar.lastFour,
    bank_account_number: undefined,
    bank_account_last_four: profileUpdate.bank_account_number?.replace(/\s/g, "").slice(-4) ?? null,
    updated_by: undefined
  };
  const { error: applicationError } = await admin
    .from("customer_onboarding_applications")
    .update({
      applicant_phone: applicantPhone,
      applicant_email: profileUpdate.applicant_email,
      draft_data: draftData,
      updated_at: new Date().toISOString()
    })
    .eq("id", applicationId);
  if (applicationError) redirect(`/customers/applications/${applicationId}?error=posp_misp_edit_failed`);

  const contacts = contactRows(applicationId, partnerType, profileUpdate);
  const { error: deleteContactsError } = await admin
    .from("customer_onboarding_contacts")
    .delete()
    .eq("application_id", applicationId);
  if (deleteContactsError) redirect(`/customers/applications/${applicationId}?error=posp_misp_edit_failed`);
  if (contacts.length) {
    const { error: contactsError } = await admin.from("customer_onboarding_contacts").insert(contacts);
    if (contactsError) redirect(`/customers/applications/${applicationId}?error=posp_misp_edit_failed`);
  }

  const marksheet = file(data, "education_marksheet");
  const marksheetType = value(data, "education_document_type");
  if (marksheet && (!marksheetType || !EDUCATION_DOCUMENT_TYPES.has(marksheetType))) {
    redirect(`/customers/applications/${applicationId}?error=posp_misp_marksheet_type_required`);
  }
  for (const documentType of DOCUMENT_FIELDS) {
    const selected = file(data, documentType);
    if (selected) await replaceDocument(admin, applicationId, documentType, selected, reviewer.id);
  }
  if (marksheet && marksheetType) {
    await replaceDocument(admin, applicationId, marksheetType, marksheet, reviewer.id);
    const { data: otherEducation } = await admin
      .from("customer_onboarding_documents")
      .select("id, document_type, storage_bucket, storage_path")
      .eq("application_id", applicationId)
      .in("document_type", [...EDUCATION_DOCUMENT_TYPES])
      .neq("document_type", marksheetType)
      .returns<Array<{ id: string; document_type: string; storage_bucket: string; storage_path: string }>>();
    for (const document of otherEducation ?? []) {
      await admin.from("customer_onboarding_documents").delete().eq("id", document.id);
      await admin.storage.from(document.storage_bucket).remove([document.storage_path]);
    }
    await admin
      .from("posp_misp_onboarding_profiles")
      .update({ education_status: "received", updated_by: reviewer.id })
      .eq("id", profile.id);
  }

  revalidatePath(`/customers/applications/${applicationId}`);
  revalidatePath("/customers/posp-misp");
  redirect(`/customers/applications/${applicationId}?success=posp_misp_updated`);
}

async function replaceDocument(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  applicationId: string,
  documentType: string,
  selected: File,
  uploadedBy: string
) {
  if (!ALLOWED_FILE_TYPES.has(selected.type) || selected.size > MAX_FILE_SIZE) {
    redirect(`/customers/applications/${applicationId}?error=posp_misp_document_invalid`);
  }
  const { data: previous } = await admin
    .from("customer_onboarding_documents")
    .select("storage_bucket, storage_path")
    .eq("application_id", applicationId)
    .eq("document_type", documentType)
    .maybeSingle<{ storage_bucket: string; storage_path: string }>();
  const extension = selected.type === "application/pdf" ? "pdf" : selected.type === "image/png" ? "png" : "jpg";
  const path = `${applicationId}/posp-misp/${documentType}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, new Uint8Array(await selected.arrayBuffer()), { contentType: selected.type, upsert: false });
  if (uploadError) redirect(`/customers/applications/${applicationId}?error=posp_misp_document_failed`);
  const { error: recordError } = await admin.from("customer_onboarding_documents").upsert({
    application_id: applicationId,
    document_type: documentType,
    file_name: selected.name,
    storage_bucket: DOCUMENT_BUCKET,
    storage_path: path,
    mime_type: selected.type,
    file_size: selected.size,
    verification_status: "pending",
    uploaded_by: uploadedBy
  }, { onConflict: "application_id,document_type" });
  if (recordError) {
    await admin.storage.from(DOCUMENT_BUCKET).remove([path]);
    redirect(`/customers/applications/${applicationId}?error=posp_misp_document_failed`);
  }
  if (previous?.storage_path && previous.storage_path !== path) {
    await admin.storage.from(previous.storage_bucket).remove([previous.storage_path]);
  }
}

function contactRows(
  applicationId: string,
  partnerType: "posp" | "misp",
  profile: {
    pos_name: string | null;
    misp_name: string | null;
    applicant_phone: string;
    applicant_email: string | null;
    dp_name: string | null;
    dp_phone: string | null;
    dp_email: string | null;
  }
) {
  if (partnerType === "posp") {
    return [{
      application_id: applicationId,
      contact_role: "posp",
      full_name: profile.pos_name ?? "POSP",
      phone: profile.applicant_phone,
      email: profile.applicant_email,
      login_required: true,
      membership_status: "pending"
    }];
  }
  if (profile.dp_phone === profile.applicant_phone) {
    return [{
      application_id: applicationId,
      contact_role: "misp_primary_dp",
      full_name: profile.dp_name ?? profile.misp_name ?? "MISP contact",
      phone: profile.applicant_phone,
      email: profile.dp_email ?? profile.applicant_email,
      login_required: true,
      membership_status: "pending"
    }];
  }
  return [
    {
      application_id: applicationId,
      contact_role: "misp_primary",
      full_name: profile.misp_name ?? "MISP",
      phone: profile.applicant_phone,
      email: profile.applicant_email,
      login_required: true,
      membership_status: "pending"
    },
    {
      application_id: applicationId,
      contact_role: "misp_dp",
      full_name: profile.dp_name ?? "DP contact",
      phone: profile.dp_phone,
      email: profile.dp_email,
      login_required: true,
      membership_status: "pending"
    }
  ];
}

function normalizePhone(input: string | null) {
  const digits = input?.replace(/\D/g, "") ?? "";
  return digits.length >= 10 ? `+91${digits.slice(-10)}` : null;
}

function value(data: FormData, key: string) {
  const current = data.get(key);
  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function file(data: FormData, key: string) {
  const current = data.get(key);
  return current instanceof File && current.size > 0 ? current : null;
}
