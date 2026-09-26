"use server";

import { revalidatePath } from "next/cache";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { resolvePolicyIntermediarySource } from "@/lib/policy-intermediary-source";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const DOCUMENT_BUCKET = "policy-documents";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const DOCUMENT_TYPES = new Set(["proposal_form", "benefit_illustration", "premium_receipt", "policy_copy"]);
const PAYMENT_FREQUENCIES = new Set(["Monthly", "Quarterly", "Half Yearly", "Annually", "One Time"]);
const PAYMENT_MODES = new Set(["Cash", "Cheque", "NEFT/RTGS", "UPI", "Credit/Debit Card", "Net Banking"]);

export type LifeHealthCaseResult =
  | { ok: true; caseId: string; caseNumber: string }
  | { ok: false; error: string };

export type LifeHealthDocumentResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string };

export type LifeHealthConversionResult =
  | { ok: true; policyId: string; policyCode: string }
  | { ok: false; error: string };

type CustomerIdentityRow = { id: string; contact_name: string; company_name: string | null };
type CaseDocumentRow = {
  id: string;
  document_type: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
};
type CaseRow = {
  id: string;
  case_number: string;
  business_line: "Life" | "Health";
  status: string;
  sourcing_date: string;
  customer_id: string;
  insurance_company_id: string;
  product_name: string;
  proposal_number: string;
  premium_paying_term: string | null;
  policy_duration: string | null;
  payment_frequency: string;
  payment_mode: string;
  premium_amount: number;
  intermediary_type: string | null;
  intermediary_code: string | null;
  lead_source: string | null;
  rm_employee_id: string | null;
  rm_name: string | null;
  rm_code: string | null;
  remarks: string | null;
  details: Record<string, unknown> | null;
  final_policy_id: string | null;
};

const clean = (value: unknown) => String(value ?? "").trim();
const normalizePhone = (value: string) => value.replace(/\D/g, "").slice(-10);
const normalizePolicyNumber = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const numberOrNull = (value: unknown) => {
  const normalized = clean(value).replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
const customerCode = () => `CUS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const caseNumber = () => `LH-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const policyCode = () => `POL-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 17)}`;

function safeFileName(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-") || "document";
}

function customerIdentityName(row: CustomerIdentityRow) {
  return clean(row.company_name || row.contact_name).replace(/\s+/g, " ").toLowerCase();
}

async function uploadCaseDocumentInternal(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  profileId: string,
  caseId: string,
  documentType: string,
  fileValue: File,
) {
  if (!DOCUMENT_TYPES.has(documentType)) return { ok: false as const, error: "Unsupported Life/Health document type." };
  if (fileValue.size <= 0) return { ok: false as const, error: "Choose a document to upload." };
  if (fileValue.size > MAX_FILE_SIZE) return { ok: false as const, error: "Each document must be 50 MB or smaller." };
  if (!ALLOWED_MIME_TYPES.has(fileValue.type)) return { ok: false as const, error: "Upload a PDF, JPG, PNG or WebP document." };

  const fileName = safeFileName(fileValue.name);
  const storagePath = `life-health-cases/${caseId}/${documentType}/${crypto.randomUUID()}-${fileName}`;
  const bytes = Buffer.from(await fileValue.arrayBuffer());
  const { error: storageError } = await admin.storage.from(DOCUMENT_BUCKET).upload(storagePath, bytes, { contentType: fileValue.type, upsert: false });
  if (storageError) return { ok: false as const, error: "The document could not be uploaded." };

  const { data: existing } = await admin
    .from("life_health_case_documents")
    .select("id,storage_bucket,storage_path")
    .eq("case_id", caseId)
    .eq("document_type", documentType)
    .maybeSingle<{ id: string; storage_bucket: string; storage_path: string }>();

  const values = {
    file_name: fileValue.name,
    storage_bucket: DOCUMENT_BUCKET,
    storage_path: storagePath,
    mime_type: fileValue.type,
    file_size: fileValue.size,
    uploaded_by: profileId,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await admin.from("life_health_case_documents").update(values).eq("id", existing.id);
    if (error) {
      await admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
      return { ok: false as const, error: "The uploaded document record could not be saved." };
    }
    if (existing.storage_bucket === DOCUMENT_BUCKET && existing.storage_path && existing.storage_path !== storagePath) {
      await admin.storage.from(DOCUMENT_BUCKET).remove([existing.storage_path]);
    }
    return { ok: true as const, documentId: existing.id };
  }

  const { data: row, error } = await admin.from("life_health_case_documents").insert({
    case_id: caseId,
    document_type: documentType,
    ...values,
  }).select("id").single<{ id: string }>();
  if (error || !row) {
    await admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    return { ok: false as const, error: "The uploaded document record could not be saved." };
  }
  return { ok: true as const, documentId: row.id };
}

export async function createLifeHealthCase(formData: FormData): Promise<LifeHealthCaseResult> {
  const profile = await requirePolicyCreator();
  const admin = createSupabaseAdminClient();

  const businessLine = clean(formData.get("businessLine"));
  const sourcingDate = clean(formData.get("sourcingDate"));
  const intermediaryType = clean(formData.get("intermediaryType"));
  const intermediaryCode = clean(formData.get("intermediaryCode"));
  const leadSource = clean(formData.get("leadSource"));
  const sourceId = clean(formData.get("sourceId"));
  const rmName = clean(formData.get("rmName"));
  const rmCode = clean(formData.get("rmCode"));
  const customerMode = clean(formData.get("customerMode"));
  const selectedCustomerId = clean(formData.get("customerId"));
  const insuredName = clean(formData.get("insuredName")).replace(/\s+/g, " ");
  const phone = normalizePhone(clean(formData.get("phone")));
  const email = clean(formData.get("email"));
  const insurerId = clean(formData.get("insurerId"));
  const productName = clean(formData.get("productName"));
  const proposalNumber = clean(formData.get("proposalNumber")).toUpperCase();
  const ppt = clean(formData.get("ppt"));
  const pd = clean(formData.get("pd"));
  const paymentFrequency = clean(formData.get("paymentFrequency"));
  const paymentMode = clean(formData.get("paymentMode"));
  const premiumAmount = numberOrNull(formData.get("premiumAmount"));
  const remarks = clean(formData.get("remarks"));

  if (businessLine !== "Life" && businessLine !== "Health") return { ok: false, error: "Select Life or Health in Policy type." };
  if (!validDate(sourcingDate)) return { ok: false, error: "Enter a valid sourcing date in Section 01." };
  if (!intermediaryType || !intermediaryCode || !leadSource || !sourceId) return { ok: false, error: "Complete Intermediary type and Lead source in Section 01." };
  if (!rmName) return { ok: false, error: "The selected source does not have an RM assignment. Update the intermediary master before creating the case." };
  if (!insurerId) return { ok: false, error: "Select the insurer." };
  if (!productName) return { ok: false, error: "Enter the product name." };
  if (!proposalNumber) return { ok: false, error: "Enter the Case / Proposal Number." };
  if (!PAYMENT_FREQUENCIES.has(paymentFrequency)) return { ok: false, error: "Select a valid payment frequency." };
  if (!PAYMENT_MODES.has(paymentMode)) return { ok: false, error: "Select a valid payment mode." };
  if (premiumAmount === null || premiumAmount < 0) return { ok: false, error: "Enter a valid premium amount." };

  const sourceResolution = await resolvePolicyIntermediarySource({ intermediaryType, intermediaryCode, leadSource });
  if (!sourceResolution.ok) return { ok: false, error: sourceResolution.error };

  const { data: intermediary, error: intermediaryError } = await admin
    .from("intermediaries")
    .select("id,intermediary_code,display_name,mobile,associate_employee_id")
    .eq("id", sourceId)
    .maybeSingle<{ id: string; intermediary_code: string | null; display_name: string; mobile: string | null; associate_employee_id: string | null }>();
  if (intermediaryError || !intermediary) return { ok: false, error: "The selected lead source is no longer available. Refresh the page and try again." };
  if (clean(intermediary.intermediary_code) !== intermediaryCode || clean(intermediary.display_name).toLowerCase() !== leadSource.toLowerCase()) {
    return { ok: false, error: "Lead source details changed while this form was open. Refresh and select the source again." };
  }

  let rmEmployeeId = intermediary.associate_employee_id;
  if (!rmEmployeeId && rmCode) {
    const { data: rm } = await admin.from("employees").select("id").eq("employee_code", rmCode).maybeSingle<{ id: string }>();
    rmEmployeeId = rm?.id ?? null;
  }

  let customerId = selectedCustomerId;
  let createdCustomerId: string | null = null;
  let createdCaseId: string | null = null;
  const uploadedPaths: string[] = [];

  try {
    if (customerMode === "existing") {
      if (!customerId) return { ok: false, error: "Select the existing customer." };
      const { data: customer, error } = await admin.from("customers").select("id").eq("id", customerId).maybeSingle<{ id: string }>();
      if (error || !customer) return { ok: false, error: "The selected customer is no longer available. Refresh and try again." };
    } else {
      if (!insuredName) return { ok: false, error: "Enter the client / proposer name." };
      if (!/^[6-9][0-9]{9}$/.test(phone)) return { ok: false, error: "Enter a valid 10 digit Indian mobile number." };
      const { data: matches, error } = await admin.from("customers").select("id,contact_name,company_name").eq("phone", phone).limit(10).returns<CustomerIdentityRow[]>();
      if (error) return { ok: false, error: "Customer validation is temporarily unavailable. Please try again." };
      const normalizedName = insuredName.toLowerCase();
      const exact = (matches ?? []).filter((row) => customerIdentityName(row) === normalizedName);
      if (exact.length === 1) customerId = exact[0].id;
      else if (exact.length > 1) return { ok: false, error: "More than one existing customer has the same name and mobile. Choose Existing Customer and select the correct record." };
      else {
        const { data: created, error: createError } = await admin.from("customers").insert({
          customer_code: customerCode(),
          company_name: null,
          contact_name: insuredName,
          phone,
          email: email || null,
          customer_type: "individual",
          partner_type: "individual_proprietor",
          source: leadSource,
          creation_channel: "policy_onboarding",
          created_by: profile.id,
        }).select("id").single<{ id: string }>();
        if (createError || !created) return { ok: false, error: "We couldn't create the customer record. Review the customer details and try again." };
        customerId = created.id;
        createdCustomerId = created.id;
      }
    }

    const generatedCaseNumber = caseNumber();
    const { data: createdCase, error: caseError } = await admin.from("life_health_cases").insert({
      case_number: generatedCaseNumber,
      business_line: businessLine,
      status: "awaiting_policy",
      sourcing_date: sourcingDate,
      customer_id: customerId,
      insurance_company_id: insurerId,
      product_name: productName,
      proposal_number: proposalNumber,
      premium_paying_term: ppt || null,
      policy_duration: pd || null,
      payment_frequency: paymentFrequency,
      payment_mode: paymentMode,
      premium_amount: premiumAmount,
      intermediary_id: sourceId,
      intermediary_type: sourceResolution.source.intermediaryType,
      intermediary_code: sourceResolution.source.intermediaryCode,
      lead_source: sourceResolution.source.leadSource,
      intermediary_mobile: intermediary.mobile || null,
      rm_employee_id: rmEmployeeId,
      rm_name: rmName,
      rm_code: rmCode || null,
      remarks: remarks || null,
      details: { source: "add_policy", customer_mode: customerMode || "new" },
      created_by: profile.id,
    }).select("id").single<{ id: string }>();
    if (caseError || !createdCase) throw new Error(caseError?.message || "case_insert_failed");
    createdCaseId = createdCase.id;

    const uploads: Array<[string, FormDataEntryValue | null]> = [
      ["proposal_form", formData.get("proposalForm")],
      ["benefit_illustration", formData.get("benefitIllustration")],
      ["premium_receipt", formData.get("premiumReceipt")],
    ];
    for (const [type, value] of uploads) {
      if (!(value instanceof File) || value.size <= 0) continue;
      const result = await uploadCaseDocumentInternal(admin, profile.id, createdCase.id, type, value);
      if (!result.ok) throw new Error(result.error);
      const { data: doc } = await admin.from("life_health_case_documents").select("storage_path").eq("id", result.documentId).maybeSingle<{ storage_path: string }>();
      if (doc?.storage_path) uploadedPaths.push(doc.storage_path);
    }

    revalidatePath("/policies");
    revalidatePath("/policies/life-health-cases");
    return { ok: true, caseId: createdCase.id, caseNumber: generatedCaseNumber };
  } catch (error) {
    if (createdCaseId) await admin.from("life_health_cases").delete().eq("id", createdCaseId);
    if (uploadedPaths.length) await admin.storage.from(DOCUMENT_BUCKET).remove(uploadedPaths);
    if (createdCustomerId) await admin.from("customers").delete().eq("id", createdCustomerId);
    return { ok: false, error: error instanceof Error && error.message && !error.message.includes("insert") ? error.message : "We couldn't create the Life/Health case. Your form is still intact; please try again." };
  }
}

export async function uploadLifeHealthCaseDocument(formData: FormData): Promise<LifeHealthDocumentResult> {
  const profile = await requirePolicyCreator();
  const admin = createSupabaseAdminClient();
  const caseId = clean(formData.get("caseId"));
  const documentType = clean(formData.get("documentType"));
  const file = formData.get("file");
  if (!caseId) return { ok: false, error: "The case reference is missing." };
  if (!(file instanceof File)) return { ok: false, error: "Choose a document to upload." };
  const { data: caseRow, error } = await admin.from("life_health_cases").select("id,final_policy_id").eq("id", caseId).maybeSingle<{ id: string; final_policy_id: string | null }>();
  if (error || !caseRow) return { ok: false, error: "This case is no longer available." };
  if (caseRow.final_policy_id) return { ok: false, error: "This case has already been converted to a policy." };
  const result = await uploadCaseDocumentInternal(admin, profile.id, caseId, documentType, file);
  if (!result.ok) return result;
  revalidatePath(`/policies/life-health-cases/${caseId}`);
  return result;
}

export async function convertLifeHealthCaseToPolicy(formData: FormData): Promise<LifeHealthConversionResult> {
  const profile = await requirePolicyCreator();
  const admin = createSupabaseAdminClient();
  const caseId = clean(formData.get("caseId"));
  const enteredPolicyNumber = clean(formData.get("policyNumber")).toUpperCase();
  const normalizedPolicy = normalizePolicyNumber(enteredPolicyNumber);
  const issuanceDate = clean(formData.get("issuanceDate"));
  const startDate = clean(formData.get("startDate"));
  const endDate = clean(formData.get("endDate"));
  const finalPremium = numberOrNull(formData.get("finalPremium"));
  const sumInsured = numberOrNull(formData.get("sumInsured"));
  const policyCopy = formData.get("policyCopy");

  if (!caseId) return { ok: false, error: "The case reference is missing." };
  if (!enteredPolicyNumber) return { ok: false, error: "Enter the issued policy number." };
  if (!validDate(issuanceDate) || !validDate(startDate) || !validDate(endDate)) return { ok: false, error: "Enter valid issuance and policy validity dates." };
  if (endDate < startDate) return { ok: false, error: "Policy end date cannot be before the start date." };
  if (finalPremium === null || finalPremium < 0) return { ok: false, error: "Enter a valid final premium." };

  const { data: caseRow, error: caseError } = await admin.from("life_health_cases")
    .select("id,case_number,business_line,status,sourcing_date,customer_id,insurance_company_id,product_name,proposal_number,premium_paying_term,policy_duration,payment_frequency,payment_mode,premium_amount,intermediary_type,intermediary_code,lead_source,rm_employee_id,rm_name,rm_code,remarks,details,final_policy_id")
    .eq("id", caseId)
    .maybeSingle<CaseRow>();
  if (caseError || !caseRow) return { ok: false, error: "This Life/Health case is no longer available." };
  if (caseRow.final_policy_id || caseRow.status === "issued") return { ok: false, error: "This case has already been converted to a policy." };

  const duplicate = await admin.from("policies").select("id").eq("policy_no_normalized", normalizedPolicy).limit(1).maybeSingle<{ id: string }>();
  if (duplicate.error) return { ok: false, error: "Policy validation is temporarily unavailable. Please try again." };
  if (duplicate.data) return { ok: false, error: "This policy number already exists in the Policy Register." };

  if (policyCopy instanceof File && policyCopy.size > 0) {
    const uploadResult = await uploadCaseDocumentInternal(admin, profile.id, caseId, "policy_copy", policyCopy);
    if (!uploadResult.ok) return { ok: false, error: uploadResult.error };
  }
  const { data: policyCopyRow } = await admin.from("life_health_case_documents").select("id").eq("case_id", caseId).eq("document_type", "policy_copy").maybeSingle<{ id: string }>();
  if (!policyCopyRow) return { ok: false, error: "Upload the issued policy copy before converting this case." };

  const generatedPolicyCode = policyCode();
  let createdPolicyId: string | null = null;
  try {
    const { data: policy, error: policyError } = await admin.from("policies").insert({
      customer_id: caseRow.customer_id,
      vehicle_id: null,
      insurance_company_id: caseRow.insurance_company_id,
      policy_no: enteredPolicyNumber,
      policy_no_normalized: normalizedPolicy,
      policy_code: generatedPolicyCode,
      policy_type: caseRow.business_line,
      policy_product: caseRow.product_name,
      business_line: caseRow.business_line,
      business_type: "New",
      issuance_date: issuanceDate,
      start_date: startDate,
      end_date: endDate,
      policy_term: caseRow.policy_duration || null,
      premium_amount: finalPremium,
      insured_declared_value: sumInsured,
      status: "active",
      intermediary_type: caseRow.intermediary_type,
      intermediary_code: caseRow.intermediary_code,
      lead_source: caseRow.lead_source,
      rm_name: caseRow.rm_name,
      rm_employee_id: caseRow.rm_employee_id,
      remarks: caseRow.remarks,
      calculation_version: "life_health_case_v1",
      created_by: profile.id,
    }).select("id").single<{ id: string }>();
    if (policyError || !policy) throw new Error(policyError?.message || "policy_insert_failed");
    createdPolicyId = policy.id;

    const { error: detailsError } = await admin.from("life_health_policy_details").insert({
      policy_id: policy.id,
      source_case_id: caseId,
      proposal_number: caseRow.proposal_number,
      premium_paying_term: caseRow.premium_paying_term,
      policy_duration: caseRow.policy_duration,
      payment_frequency: caseRow.payment_frequency,
      payment_mode: caseRow.payment_mode,
      additional_details: caseRow.details ?? {},
    });
    if (detailsError) throw new Error(detailsError.message);

    const { error: premiumError } = await admin.from("policy_premium_details").insert({
      policy_id: policy.id,
      od_premium: 0,
      tp_premium: 0,
      cpa_opted: false,
      cpa_amount: 0,
      net_premium: finalPremium,
      gst_amount: 0,
      gross_premium: finalPremium,
      gst_rule: "Life/Health premium captured as payable premium",
      calculation_version: "life_health_case_v1",
      calculation_overridden: false,
    });
    if (premiumError) throw new Error(premiumError.message);

    const { data: documents, error: documentLoadError } = await admin.from("life_health_case_documents")
      .select("id,document_type,file_name,storage_bucket,storage_path,mime_type,file_size,uploaded_by")
      .eq("case_id", caseId)
      .returns<CaseDocumentRow[]>();
    if (documentLoadError) throw new Error(documentLoadError.message);
    if (documents?.length) {
      const { error: documentInsertError } = await admin.from("policy_documents").insert(documents.map((document) => ({
        policy_id: policy.id,
        document_type: document.document_type,
        file_name: document.file_name,
        storage_bucket: document.storage_bucket,
        storage_path: document.storage_path,
        mime_type: document.mime_type,
        file_size: document.file_size,
        uploaded_by: document.uploaded_by || profile.id,
      })));
      if (documentInsertError) throw new Error(documentInsertError.message);
    }

    const { error: caseUpdateError } = await admin.from("life_health_cases").update({
      status: "issued",
      final_policy_id: policy.id,
      converted_at: new Date().toISOString(),
      converted_by: profile.id,
      premium_amount: finalPremium,
      updated_at: new Date().toISOString(),
    }).eq("id", caseId).is("final_policy_id", null);
    if (caseUpdateError) throw new Error(caseUpdateError.message);

    revalidatePath("/policies");
    revalidatePath("/policies/life-health-cases");
    revalidatePath(`/policies/life-health-cases/${caseId}`);
    revalidatePath(`/policies/${policy.id}`);
    return { ok: true, policyId: policy.id, policyCode: generatedPolicyCode };
  } catch {
    if (createdPolicyId) await admin.from("policies").delete().eq("id", createdPolicyId);
    return { ok: false, error: "We couldn't convert this case into a policy. The case and uploaded documents remain unchanged; please try again." };
  }
}
