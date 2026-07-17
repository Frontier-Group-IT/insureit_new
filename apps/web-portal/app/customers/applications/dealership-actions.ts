"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { approvePortalOnboardingApplication } from "../onboarding-applications";

type Draft = Record<string, unknown>;
type Application = {
  id: string;
  profile_id: string | null;
  partner_type: string | null;
  status: string;
  applicant_phone: string | null;
  applicant_email: string | null;
  group_customer_id: string | null;
  customer_id: string | null;
  draft_data: Draft | null;
};
type ApplicationDocument = {
  document_type: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
};

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const DEALERSHIP_TYPES = new Set(["posp", "misp"]);
const SALES_BANDS = new Set(["less_than_500", "500_to_1000", "more_than_1000"]);
const CONTACT_ROLES = ["sales_head", "bodyshop_head", "insurance_head", "insurance_spoc"] as const;
const DOCUMENT_TYPE_MAP: Record<string, string> = {
  representative_aadhaar_front: "aadhaar_front",
  representative_aadhaar_back: "aadhaar_back",
  representative_pan_copy: "pan_copy",
  gst_copy: "gst_copy",
};

export async function updateMobileDealershipApplicationDraft(formData: FormData) {
  const applicationId = value(formData, "application_id");
  if (!applicationId) redirect("/customers/applications?error=missing_application");

  const reviewer = await requireMasterDataManager();
  if (!reviewer?.id) redirect(`/customers/applications/${applicationId}?error=unauthorized`);

  const admin = createSupabaseAdminClient();
  const { data: application, error: applicationError } = await admin
    .from("customer_onboarding_applications")
    .select("id,profile_id,partner_type,status,applicant_phone,applicant_email,group_customer_id,customer_id,draft_data")
    .eq("id", applicationId)
    .single<Application>();

  if (
    applicationError
    || !application
    || application.partner_type !== "dealership"
    || !["submitted", "under_review"].includes(application.status)
    || application.customer_id
  ) {
    redirect(`/customers/applications/${applicationId}?error=application_not_ready`);
  }

  const draft = application.draft_data ?? {};
  const dealershipType = value(formData, "dealership_type");
  const dealershipName = value(formData, "dealership_name");
  const ownerName = value(formData, "owner_name");
  const ownerPhone = normalizePhoneForStorage(value(formData, "phone"));
  const ownerEmail = normalizeEmail(value(formData, "email"));
  const street = value(formData, "address_street");
  const locality = value(formData, "address_locality");
  const locationId = value(formData, "india_location_id");
  const city = value(formData, "city");
  const state = value(formData, "state");
  const postalCode = value(formData, "postal_code");
  const oemName = value(formData, "oem_name");
  const yearlySalesBand = value(formData, "yearly_sales_band");
  const isGstRegistered = formData.get("is_gst_registered") === "true";
  const gstNumber = normalizeTaxId(value(formData, "gst_number"));
  const representativeName = value(formData, "representative_name");
  const representativePhone = normalizePhoneForStorage(value(formData, "representative_mobile"));
  const representativeEmail = normalizeEmail(value(formData, "representative_email"));
  const replacementAadhaar = digits(value(formData, "representative_aadhaar"));
  const representativeAadhaar = replacementAadhaar || digits(text(draft.representative_aadhaar));
  const representativePan = normalizeTaxId(value(formData, "representative_pan"));

  if (
    !dealershipType
    || !DEALERSHIP_TYPES.has(dealershipType)
    || !dealershipName
    || !ownerName
    || !ownerPhone
    || !street
    || !locationId
    || !city
    || !state
    || !postalCode
    || !oemName
    || !yearlySalesBand
    || !SALES_BANDS.has(yearlySalesBand)
  ) {
    redirect(`/customers/applications/${applicationId}?error=incomplete_dealership_application`);
  }

  if (isGstRegistered && (!gstNumber || !GST_PATTERN.test(gstNumber))) {
    redirect(`/customers/applications/${applicationId}?error=invalid_dealership_details`);
  }

  if (
    !representativeName
    || !representativePhone
    || representativeAadhaar.length !== 12
    || !representativePan
    || !PAN_PATTERN.test(representativePan)
  ) {
    redirect(`/customers/applications/${applicationId}?error=representative_incomplete`);
  }

  const contactValues: Draft = {};
  for (const role of CONTACT_ROLES) {
    const name = value(formData, `${role}_name`);
    const rawPhone = value(formData, `${role}_mobile`);
    const phone = rawPhone ? normalizePhoneForStorage(rawPhone) : null;
    const email = normalizeEmail(value(formData, `${role}_email`));
    if (rawPhone && !phone) redirect(`/customers/applications/${applicationId}?error=invalid_dealership_contact`);
    contactValues[`${role}_name`] = name;
    contactValues[`${role}_mobile`] = phone;
    contactValues[`${role}_email`] = email;
  }

  const nextDraft: Draft = {
    ...draft,
    dealership_type: dealershipType,
    dealership_name: dealershipName,
    owner_name: ownerName,
    phone: ownerPhone,
    email: ownerEmail,
    address_street: street,
    address_locality: locality,
    india_location_id: locationId,
    city,
    state,
    postal_code: postalCode,
    oem_name: oemName,
    yearly_sales_band: yearlySalesBand,
    is_gst_registered: isGstRegistered,
    gst_number: isGstRegistered ? gstNumber : null,
    representative_name: representativeName,
    representative_mobile: representativePhone,
    representative_email: representativeEmail,
    representative_aadhaar: representativeAadhaar,
    representative_pan: representativePan,
    ...contactValues,
    reviewer_corrected_at: new Date().toISOString(),
    reviewer_corrected_by: reviewer.id,
  };

  const { error: updateError } = await admin
    .from("customer_onboarding_applications")
    .update({
      applicant_phone: ownerPhone,
      applicant_email: ownerEmail,
      draft_data: nextDraft,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (updateError) {
    console.error("Dealership application correction failed", updateError);
    redirect(`/customers/applications/${applicationId}?error=dealership_update_failed`);
  }

  revalidatePath("/customers/applications");
  revalidatePath(`/customers/applications/${applicationId}`);
  redirect(`/customers/applications/${applicationId}?success=dealership_updated`);
}

export async function approveMobileDealershipApplication(formData: FormData) {
  const applicationId = value(formData, "application_id");
  if (!applicationId) redirect("/customers/applications?error=missing_application");

  const reviewer = await requireMasterDataManager();
  if (!reviewer?.id) redirect(`/customers/applications/${applicationId}?error=unauthorized`);

  const admin = createSupabaseAdminClient();
  const { data: application, error: applicationError } = await admin
    .from("customer_onboarding_applications")
    .select("id,profile_id,partner_type,status,applicant_phone,applicant_email,group_customer_id,customer_id,draft_data")
    .eq("id", applicationId)
    .single<Application>();

  if (
    applicationError
    || !application?.profile_id
    || application.partner_type !== "dealership"
    || !["submitted", "under_review"].includes(application.status)
    || application.customer_id
  ) {
    redirect(`/customers/applications/${applicationId}?error=application_not_ready`);
  }

  const draft = application.draft_data ?? {};
  const dealershipType = text(draft.dealership_type);
  const dealershipName = text(draft.dealership_name);
  const ownerName = text(draft.owner_name);
  const ownerPhone = normalizePhoneForStorage(text(draft.phone) ?? application.applicant_phone);
  const ownerEmail = normalizeEmail(text(draft.email) ?? application.applicant_email);
  const street = text(draft.address_street);
  const locality = text(draft.address_locality);
  const locationId = text(draft.india_location_id);
  const city = text(draft.city);
  const state = text(draft.state);
  const postalCode = text(draft.postal_code);
  const oemName = text(draft.oem_name);
  const yearlySalesBand = text(draft.yearly_sales_band);
  const isGstRegistered = draft.is_gst_registered === true;
  const gstNumber = normalizeTaxId(draft.gst_number);
  const representativeName = text(draft.representative_name);
  const representativePhone = normalizePhoneForStorage(text(draft.representative_mobile));
  const representativeEmail = normalizeEmail(text(draft.representative_email));
  const representativeAadhaar = digits(text(draft.representative_aadhaar));
  const representativePan = normalizeTaxId(draft.representative_pan);

  if (
    !dealershipType
    || !DEALERSHIP_TYPES.has(dealershipType)
    || !dealershipName
    || !ownerName
    || !ownerPhone
    || !street
    || !locationId
    || !city
    || !state
    || !postalCode
    || !oemName
    || !yearlySalesBand
    || !SALES_BANDS.has(yearlySalesBand)
  ) {
    redirect(`/customers/applications/${applicationId}?error=incomplete_dealership_application`);
  }

  if (isGstRegistered && (!gstNumber || !GST_PATTERN.test(gstNumber))) {
    redirect(`/customers/applications/${applicationId}?error=invalid_dealership_details`);
  }

  if (
    !representativeName
    || !representativePhone
    || representativeAadhaar.length !== 12
    || !representativePan
    || !PAN_PATTERN.test(representativePan)
  ) {
    redirect(`/customers/applications/${applicationId}?error=representative_incomplete`);
  }

  const { data: documents, error: documentError } = await admin
    .from("customer_onboarding_documents")
    .select("document_type,file_name,storage_bucket,storage_path,mime_type,file_size")
    .eq("application_id", applicationId)
    .returns<ApplicationDocument[]>();

  if (documentError) redirect(`/customers/applications/${applicationId}?error=documents_unavailable`);
  const requiredDocuments = new Set([
    "representative_aadhaar_front",
    "representative_aadhaar_back",
    "representative_pan_copy",
    ...(isGstRegistered ? ["gst_copy"] : []),
  ]);
  if ([...requiredDocuments].some((type) => !(documents ?? []).some((document) => document.document_type === type))) {
    redirect(`/customers/applications/${applicationId}?error=documents_incomplete`);
  }

  const duplicateQueries = [
    admin.from("customers").select("id").eq("phone", ownerPhone).limit(1).maybeSingle<{ id: string }>(),
    admin.from("dealership_representatives").select("id").eq("pan_number", representativePan).limit(1).maybeSingle<{ id: string }>(),
    isGstRegistered && gstNumber
      ? admin.from("customers").select("id").eq("gst_number", gstNumber).limit(1).maybeSingle<{ id: string }>()
      : Promise.resolve({ data: null, error: null }),
  ];
  const [duplicatePhone, duplicateRepresentative, duplicateGst] = await Promise.all(duplicateQueries);
  if (duplicatePhone.data || duplicateRepresentative.data || duplicateGst.data) {
    redirect(`/customers/applications/${applicationId}?error=customer_already_exists`);
  }

  const customerId = randomUUID();
  const now = new Date().toISOString();
  const copiedPaths: string[] = [];
  const cleanup = async () => {
    if (copiedPaths.length) await admin.storage.from("customer-documents").remove(copiedPaths);
    await admin.from("customers").delete().eq("id", customerId);
  };

  const { error: customerError } = await admin.from("customers").insert({
    id: customerId,
    profile_id: null,
    customer_code: `CUST-${Date.now().toString().slice(-9)}`,
    partner_type: "dealership",
    contact_name: ownerName,
    company_name: dealershipName,
    legal_trade_name: dealershipName,
    phone: ownerPhone,
    email: ownerEmail,
    address: [street, locality, city, state, postalCode].filter(Boolean).join(", "),
    address_street: street,
    address_locality: locality,
    india_location_id: locationId,
    city,
    state,
    postal_code: postalCode,
    is_gst_registered: isGstRegistered,
    gst_number: isGstRegistered ? gstNumber : null,
    onboarding_status: "active",
    onboarding_completed_at: now,
    created_by: reviewer.id,
    updated_by: reviewer.id,
  });

  if (customerError) {
    console.error("Dealership customer create failed", customerError);
    if (customerError.code === "23505") redirect(`/customers/applications/${applicationId}?error=customer_already_exists`);
    redirect(`/customers/applications/${applicationId}?error=customer_create_failed`);
  }

  const { error: profileError } = await admin.from("dealership_profiles").insert({
    customer_id: customerId,
    dealership_type: dealershipType,
    dealership_name: dealershipName,
    owner_name: ownerName,
    oem_name: oemName,
    yearly_sales_band: yearlySalesBand,
  });
  if (profileError) {
    await cleanup();
    redirect(`/customers/applications/${applicationId}?error=dealership_profile_failed`);
  }

  const { error: representativeError } = await admin.from("dealership_representatives").insert({
    customer_id: customerId,
    representative_type: dealershipType,
    representative_name: representativeName,
    mobile: representativePhone,
    email: representativeEmail,
    aadhaar_last_four: representativeAadhaar.slice(-4),
    aadhaar_hash: createHash("sha256").update(representativeAadhaar).digest("hex"),
    pan_number: representativePan,
  });
  if (representativeError) {
    await cleanup();
    redirect(`/customers/applications/${applicationId}?error=representative_create_failed`);
  }

  const contactRows = CONTACT_ROLES.map((role) => ({
    customer_id: customerId,
    contact_role: role,
    contact_name: text(draft[`${role}_name`]),
    mobile: normalizeOptionalPhone(text(draft[`${role}_mobile`])),
    email: normalizeEmail(text(draft[`${role}_email`])),
  }));
  const { error: contactsError } = await admin.from("dealership_contacts").insert(contactRows);
  if (contactsError) {
    await cleanup();
    redirect(`/customers/applications/${applicationId}?error=dealership_contacts_failed`);
  }

  const { error: membershipError } = await admin.from("customer_memberships").insert({
    customer_id: customerId,
    profile_id: application.profile_id,
    invited_phone: ownerPhone,
    invited_email: ownerEmail,
    membership_role: "dealership_owner",
    is_primary: true,
    status: "active",
    created_by: reviewer.id,
  });
  if (membershipError) {
    await cleanup();
    redirect(`/customers/applications/${applicationId}?error=membership_create_failed`);
  }

  if (application.group_customer_id) {
    const { error: relationshipError } = await admin.rpc("link_customer_to_group", {
      p_group_customer_id: application.group_customer_id,
      p_child_customer_id: customerId,
      p_actor_profile_id: reviewer.id,
    });
    if (relationshipError) {
      console.error("Group Dealership approval link failed", relationshipError);
      await cleanup();
      redirect(`/customers/applications/${applicationId}?error=group_link_failed`);
    }
  }

  const permanentDocuments: Array<Record<string, unknown>> = [];
  for (const document of documents ?? []) {
    const { data: file, error: downloadError } = await admin.storage.from(document.storage_bucket).download(document.storage_path);
    if (downloadError || !file) {
      await cleanup();
      redirect(`/customers/applications/${applicationId}?error=document_copy_failed`);
    }

    const permanentType = DOCUMENT_TYPE_MAP[document.document_type] ?? document.document_type;
    const path = `${customerId}/dealership/${permanentType}/${randomUUID()}.${extension(document)}`;
    const { error: uploadError } = await admin.storage
      .from("customer-documents")
      .upload(path, new Uint8Array(await file.arrayBuffer()), {
        contentType: document.mime_type ?? "application/octet-stream",
        upsert: false,
      });
    if (uploadError) {
      await cleanup();
      redirect(`/customers/applications/${applicationId}?error=document_copy_failed`);
    }

    copiedPaths.push(path);
    permanentDocuments.push({
      customer_id: customerId,
      document_type: permanentType,
      file_name: document.file_name,
      storage_bucket: "customer-documents",
      storage_path: path,
      mime_type: document.mime_type,
      file_size: document.file_size,
      verification_status: "verified",
      upload_source: "customer_app",
      uploaded_by: application.profile_id,
      verified_by: reviewer.id,
      verified_at: now,
    });
  }

  if (permanentDocuments.length) {
    const { error: documentRecordError } = await admin.from("customer_documents").insert(permanentDocuments);
    if (documentRecordError) {
      await cleanup();
      redirect(`/customers/applications/${applicationId}?error=document_records_failed`);
    }
  }

  await admin
    .from("customer_onboarding_documents")
    .update({ verification_status: "verified", verified_by: reviewer.id, verified_at: now, rejection_reason: null })
    .eq("application_id", applicationId);

  const onboardingContacts = [
    {
      application_id: applicationId,
      contact_role: "dealership_owner",
      full_name: ownerName,
      phone: ownerPhone,
      email: ownerEmail,
      login_required: true,
      linked_profile_id: application.profile_id,
      membership_status: "active",
      updated_at: now,
    },
    {
      application_id: applicationId,
      contact_role: dealershipType === "posp" ? "posp_representative" : "dp_representative",
      full_name: representativeName,
      phone: representativePhone,
      email: representativeEmail,
      login_required: false,
      linked_profile_id: null,
      membership_status: "active",
      updated_at: now,
    },
  ];
  await admin.from("customer_onboarding_contacts").upsert(onboardingContacts, { onConflict: "application_id,contact_role" });

  try {
    await approvePortalOnboardingApplication(admin, applicationId, customerId, reviewer.id);
  } catch (error) {
    console.error("Dealership application completion failed", error);
    await cleanup();
    redirect(`/customers/applications/${applicationId}?error=application_complete_failed`);
  }

  revalidatePath("/customers");
  revalidatePath("/customers/applications");
  revalidatePath(`/customers/applications/${applicationId}`);
  redirect(`/customers/${customerId}/edit?success=dealership_kyc_approved`);
}

function value(formData: FormData, name: string) {
  const item = formData.get(name);
  return typeof item === "string" && item.trim() ? item.trim() : null;
}
function text(input: unknown) {
  return typeof input === "string" && input.trim() ? input.trim() : null;
}
function normalizeTaxId(input: unknown) {
  return typeof input === "string" && input.trim() ? input.replace(/\s/g, "").toUpperCase() : null;
}
function normalizeEmail(input: string | null) {
  return input?.trim() ? input.trim().toLowerCase() : null;
}
function digits(input: string | null) {
  return (input ?? "").replace(/\D/g, "");
}
function normalizePhoneForStorage(input: string | null) {
  const phoneDigits = digits(input).slice(-10);
  return phoneDigits.length === 10 ? `+91${phoneDigits}` : null;
}
function normalizeOptionalPhone(input: string | null) {
  if (!input) return null;
  return normalizePhoneForStorage(input);
}
function extension(document: ApplicationDocument) {
  if (document.mime_type === "application/pdf") return "pdf";
  if (document.mime_type === "image/png") return "png";
  return "jpg";
}
