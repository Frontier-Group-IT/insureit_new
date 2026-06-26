"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import type { ClaimStatus } from "@/lib/claim-workflow";
import { canVerifyClaimDocuments } from "@/lib/roles";

const bucketName = "claim-documents";
const rcDateFields = ["fitness_valid_upto", "tax_valid_upto", "insurance_valid_upto", "pucc_valid_upto", "local_permit_valid_upto", "national_permit_valid_upto"] as const;
const insuranceRequiredFields = ["insurance_start_date", "insurance_end_date", "ncb_verified", "policy_type_check", "gvw_kg"] as const;
const dlRequiredFields = ["licence_valid_upto", "dl_inbound", "dl_valid_for_loss_vehicle"] as const;
const grRequiredFields = ["gr_gvw_kg", "unladen_weight_kg", "load_weight_kg", "load_difference_kg"] as const;

type ClaimForVerification = { id: string; customer_id: string; current_status: ClaimStatus; accident_at: string | null };
type ActionResult = { ok: boolean; message?: string };
type VerificationType = "rc" | "insurance" | "document" | "detail";

async function currentProfile() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!canVerifyClaimDocuments(profile?.role)) throw new Error("You do not have permission to verify claim documents.");
  return profile;
}

async function loadClaim(claimId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("claims").select("id, customer_id, current_status, accident_at").eq("id", claimId).maybeSingle<ClaimForVerification>();
  if (error || !data) throw new Error(error?.message ?? "Claim not found.");
  return data;
}

function collectVerificationDetails(formData: FormData) {
  const ignored = new Set(["claimId", "documentId"]);
  const details: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (ignored.has(key) || typeof value !== "string") continue;
    const cleanValue = value.trim();
    if (!cleanValue) continue;
    details[key] = cleanValue;
  }
  return details;
}

function incidentDateOnly(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function statusFromExpiry(expiryDate: string | undefined, incidentDate: string | null) {
  if (!expiryDate || !incidentDate) return undefined;
  return expiryDate < incidentDate ? "Invalid" : "Valid";
}

function isDlDocument(documentType: string) {
  const normalized = documentType.toLowerCase();
  return normalized.includes("driving") || normalized.includes("licence") || normalized.includes("license") || normalized.includes("dl");
}

function isGrDocument(documentType: string) {
  const normalized = documentType.toLowerCase();
  return normalized.includes("gr") || normalized.includes("load challan") || normalized.includes("road challan");
}

function verificationTypeForDocument(documentType: string): VerificationType {
  const normalized = documentType.toLowerCase();
  if (normalized.includes("registration") || normalized.includes("rc")) return "rc";
  if (normalized.includes("policy") || normalized.includes("insurance")) return "insurance";
  return "document";
}

function requiredFieldsForDocument(documentType: string) {
  const type = verificationTypeForDocument(documentType);
  if (type === "rc") return [...rcDateFields];
  if (type === "insurance") return [...insuranceRequiredFields];
  if (isDlDocument(documentType)) return [...dlRequiredFields];
  if (isGrDocument(documentType)) return [...grRequiredFields];
  return [];
}

function applyAutomaticValidity(details: Record<string, string>, incidentDate: string | null, documentType: string) {
  const type = verificationTypeForDocument(documentType);
  const requiredFields = requiredFieldsForDocument(documentType);
  const missingFields = requiredFields.filter((key) => !details[key]);
  const dateStatusPairs = [["fitness_valid_upto", "fitness_status"], ["tax_valid_upto", "tax_status"], ["insurance_valid_upto", "insurance_status"], ["pucc_valid_upto", "pucc_status"], ["local_permit_valid_upto", "local_permit_status"], ["national_permit_valid_upto", "national_permit_status"], ["insurance_end_date", "policy_status"]] as const;
  const invalidFields: string[] = [];
  const finalDetails = { ...details };

  for (const [dateKey, statusKey] of dateStatusPairs) {
    const autoStatus = statusFromExpiry(finalDetails[dateKey], incidentDate);
    if (!autoStatus) continue;
    finalDetails[statusKey] = autoStatus;
    if (autoStatus === "Invalid") invalidFields.push(dateKey);
  }

  if (type === "insurance" && details.insurance_start_date && details.insurance_end_date && details.insurance_start_date > details.insurance_end_date) invalidFields.push("insurance_start_date");

  if (isDlDocument(documentType)) {
    const dlStatus = statusFromExpiry(details.licence_valid_upto, incidentDate);
    finalDetails.dl_validity_status = dlStatus ?? "";
    finalDetails.dl_overall_status = dlStatus === "Valid" && details.dl_valid_for_loss_vehicle === "Yes" ? "Valid" : "Invalid";
    if (dlStatus !== "Valid") invalidFields.push("licence_valid_upto");
    if (details.dl_valid_for_loss_vehicle !== "Yes") invalidFields.push("dl_valid_for_loss_vehicle");
  }

  if (isGrDocument(documentType)) {
    const gvw = toNumber(details.gr_gvw_kg);
    const unladen = toNumber(details.unladen_weight_kg);
    const load = toNumber(details.load_weight_kg);
    const submittedDifference = toNumber(details.load_difference_kg);
    const calculatedDifference = gvw - unladen - load;
    finalDetails.load_difference_kg = String(calculatedDifference);
    finalDetails.gr_calculation = `(${gvw} - ${unladen}) - ${load} = ${calculatedDifference} kg`;
    finalDetails.gr_calculation_status = calculatedDifference >= 0 && submittedDifference === calculatedDifference ? "Valid" : "Invalid";
    if (gvw <= 0) invalidFields.push("gr_gvw_kg");
    if (unladen < 0) invalidFields.push("unladen_weight_kg");
    if (load < 0) invalidFields.push("load_weight_kg");
    if (calculatedDifference < 0 || submittedDifference !== calculatedDifference) invalidFields.push("load_difference_kg");
  }

  const isValid = missingFields.length === 0 && invalidFields.length === 0;
  const messages: string[] = [];
  if (missingFields.length) messages.push(`Please enter required fields: ${missingFields.map(formatFieldName).join(", ")}.`);
  if (invalidFields.length) messages.push(`Cannot verify document. Invalid field/value found for: ${invalidFields.map(formatFieldName).join(", ")}.`);
  const invalidReason = messages.length ? messages.join(" ") : null;
  return { finalDetails, isValid, invalidReason };
}

function toNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatFieldName(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

async function saveVerificationHistory(params: { claimId: string; documentId: string | null; documentType: string; verificationType: VerificationType; incidentDate: string | null; isValid: boolean; invalidReason: string | null; details: Record<string, unknown>; verifiedBy: string | null }) {
  const supabase = await createServerSupabaseClient();
  await supabase.from("claim_document_verifications").insert({ claim_id: params.claimId, document_id: params.documentId, document_type: params.documentType, verification_type: params.verificationType, incident_date: params.incidentDate, is_valid: params.isValid, invalid_reason: params.invalidReason, details: params.details, verified_by: params.verifiedBy });
}

export async function verifySpotSurveyDocument(formData: FormData): Promise<ActionResult> {
  try {
    const documentId = String(formData.get("documentId") ?? "").trim();
    const claimId = String(formData.get("claimId") ?? "").trim();
    if (!documentId || !claimId) throw new Error("Missing claim or document id.");
    const profile = await currentProfile();
    const claim = await loadClaim(claimId);
    const supabase = await createServerSupabaseClient();
    const rawDetails = collectVerificationDetails(formData);
    const incidentDate = incidentDateOnly(claim.accident_at);
    const { data: document, error: documentError } = await supabase.from("claim_documents").select("id, claim_id, document_type, verification_status").eq("id", documentId).eq("claim_id", claimId).maybeSingle<{ id: string; claim_id: string; document_type: string; verification_status: string }>();
    if (documentError || !document) throw new Error(documentError?.message ?? "Document not found.");

    const { finalDetails, isValid, invalidReason } = applyAutomaticValidity(rawDetails, incidentDate, document.document_type);
    const detailsPayload = { verification_type: "spot_survey_document", document_type: document.document_type, document_id: document.id, incident_date: incidentDate, is_valid: isValid, invalid_reason: invalidReason, ...finalDetails, verified: isValid, verified_at: new Date().toISOString() };

    if (!isValid) {
      await saveVerificationHistory({ claimId, documentId: document.id, documentType: document.document_type, verificationType: verificationTypeForDocument(document.document_type), incidentDate, isValid: false, invalidReason, details: detailsPayload, verifiedBy: profile?.id ?? null });
      await supabase.from("claim_status_history").insert({ claim_id: claimId, from_status: claim.current_status, to_status: claim.current_status, notes: invalidReason, changed_by: profile?.id ?? null });
      revalidatePath(`/claims/${claimId}`);
      return { ok: false, message: invalidReason ?? "Document cannot be verified because required details are missing or invalid." };
    }

    const { error: reviewError } = await supabase.from("claim_documents").update({ verification_status: "verified", verified_by: profile?.id ?? null, verified_at: new Date().toISOString(), rejection_reason: null }).eq("id", documentId).eq("claim_id", claimId);
    if (reviewError) throw new Error(reviewError.message);
    await supabase.from("claim_stage_details").insert({ claim_id: claimId, stage: claim.current_status, details: detailsPayload, created_by: profile?.id ?? null });
    await saveVerificationHistory({ claimId, documentId: document.id, documentType: document.document_type, verificationType: verificationTypeForDocument(document.document_type), incidentDate, isValid: true, invalidReason: null, details: detailsPayload, verifiedBy: profile?.id ?? null });
    await supabase.from("claim_status_history").insert({ claim_id: claimId, from_status: claim.current_status, to_status: claim.current_status, notes: `${document.document_type} verified during spot survey.`, changed_by: profile?.id ?? null });
    revalidatePath(`/claims/${claimId}`); revalidatePath("/claims"); revalidatePath("/dashboard");
    return { ok: true, message: "Document verified successfully." };
  } catch (error) {
    console.error("verifySpotSurveyDocument failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Verification failed." };
  }
}

export async function requestSpotSurveyDocumentReupload(formData: FormData): Promise<ActionResult> {
  try {
    const documentId = String(formData.get("documentId") ?? "").trim();
    const claimId = String(formData.get("claimId") ?? "").trim();
    const reason = String(formData.get("reason") ?? "Document reupload requested by claim manager.").trim() || "Document reupload requested by claim manager.";
    if (!documentId || !claimId) throw new Error("Missing claim or document id.");
    const profile = await currentProfile();
    const claim = await loadClaim(claimId);
    const supabase = await createServerSupabaseClient();
    const { data: document, error: documentError } = await supabase.from("claim_documents").select("id, document_type, file_name").eq("id", documentId).eq("claim_id", claimId).maybeSingle<{ id: string; document_type: string; file_name: string }>();
    if (documentError || !document) throw new Error(documentError?.message ?? "Document not found.");
    const { error: updateError } = await supabase.from("claim_documents").update({ verification_status: "rejected", rejection_reason: reason, verified_by: profile?.id ?? null, verified_at: new Date().toISOString() }).eq("id", documentId).eq("claim_id", claimId);
    if (updateError) throw new Error(updateError.message);
    const detailsPayload = { verification_type: "reupload_requested", document_type: document.document_type, document_id: document.id, file_name: document.file_name, reason, requested_at: new Date().toISOString(), requested_by: profile?.id ?? null };
    await supabase.from("claim_stage_details").insert({ claim_id: claimId, stage: claim.current_status, details: detailsPayload, created_by: profile?.id ?? null });
    await saveVerificationHistory({ claimId, documentId: document.id, documentType: document.document_type, verificationType: verificationTypeForDocument(document.document_type), incidentDate: incidentDateOnly(claim.accident_at), isValid: false, invalidReason: reason, details: detailsPayload, verifiedBy: profile?.id ?? null });
    await supabase.from("claim_status_history").insert({ claim_id: claimId, from_status: claim.current_status, to_status: claim.current_status, notes: `Reupload requested for ${document.document_type}. ${reason}`, changed_by: profile?.id ?? null });
    await supabase.from("customer_activity_events").insert({ customer_id: claim.customer_id, claim_id: claimId, source_table: "claim_documents", source_id: document.id, event_type: "claim_document_reuploaded", title: `${document.document_type} reupload requested`, message: reason, priority: "high", status: "new", metadata: { document_type: document.document_type, document_id: document.id, file_name: document.file_name, requested_by: profile?.id ?? null } });
    revalidatePath(`/claims/${claimId}`); revalidatePath("/claims"); revalidatePath("/dashboard");
    return { ok: true, message: "Reupload request sent to customer." };
  } catch (error) {
    console.error("requestSpotSurveyDocumentReupload failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Reupload request failed." };
  }
}

export async function verifySpotSurveyDetail(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = String(formData.get("claimId") ?? "").trim();
    const detailKey = String(formData.get("detailKey") ?? "").trim();
    const detailLabel = String(formData.get("detailLabel") ?? "").trim();
    const detailValue = String(formData.get("detailValue") ?? "").trim();
    if (!claimId || !detailKey) throw new Error("Missing claim or detail id.");
    const profile = await currentProfile();
    const claim = await loadClaim(claimId);
    const supabase = await createServerSupabaseClient();
    const detailPayload = { verification_type: "spot_survey_detail", spot_survey_detail_key: detailKey, label: detailLabel, value: detailValue, verified: true, verified_at: new Date().toISOString() };
    const { error: detailError } = await supabase.from("claim_stage_details").insert({ claim_id: claimId, stage: claim.current_status, details: detailPayload, created_by: profile?.id ?? null });
    if (detailError) throw new Error(detailError.message);
    await saveVerificationHistory({ claimId, documentId: null, documentType: detailLabel || detailKey, verificationType: "detail", incidentDate: incidentDateOnly(claim.accident_at), isValid: true, invalidReason: null, details: detailPayload, verifiedBy: profile?.id ?? null });
    await supabase.from("claim_status_history").insert({ claim_id: claimId, from_status: claim.current_status, to_status: claim.current_status, notes: `${detailLabel || detailKey} verified during spot survey.`, changed_by: profile?.id ?? null });
    revalidatePath(`/claims/${claimId}`); revalidatePath("/claims"); revalidatePath("/dashboard");
    return { ok: true, message: "Details verified successfully." };
  } catch (error) {
    console.error("verifySpotSurveyDetail failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Detail verification failed." };
  }
}

export async function replaceSpotSurveyDocument(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = String(formData.get("claimId") ?? "").trim();
    const documentType = String(formData.get("documentType") ?? "").trim();
    const customerId = String(formData.get("customerId") ?? "").trim();
    const file = formData.get("file");
    if (!claimId || !documentType || !customerId || !(file instanceof File) || !file.size) throw new Error("Missing replacement document details.");
    const profile = await currentProfile(); await loadClaim(claimId); const supabase = await createServerSupabaseClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const storagePath = `${claimId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const { error: insertError } = await supabase.from("claim_documents").insert({ claim_id: claimId, customer_id: customerId, document_type: documentType, file_name: safeName, storage_bucket: bucketName, storage_path: storagePath, verification_status: "pending" });
    if (insertError) throw new Error(insertError.message);
    await supabase.from("claim_status_history").insert({ claim_id: claimId, from_status: null, to_status: null, notes: `${documentType} replaced by claim manager.`, changed_by: profile?.id ?? null });
    revalidatePath(`/claims/${claimId}`); revalidatePath("/claims"); revalidatePath("/dashboard");
    return { ok: true, message: "Document replaced successfully." };
  } catch (error) {
    console.error("replaceSpotSurveyDocument failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Document replacement failed." };
  }
}
