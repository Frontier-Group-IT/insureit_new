"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { claimStatuses, finalDocumentTypes, isClaimStatus, managerTransitions, replacementStatusFor, requiredDocumentTypesForStatus, verifiedStatusFor, type ClaimStatus } from "@/lib/claim-workflow";
import { createServerSupabaseClient, getServerAccessToken, getAuthenticatedProfile } from "@/lib/auth-server";
import { canManageUsers, canUpdateClaimStage, canVerifyClaimDocuments, isAppRole } from "@/lib/roles";

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(formData: FormData, name: string) {
  const value = textValue(formData, name);
  return value ? Number(value) : null;
}

function dateValue(formData: FormData, name: string) {
  return textValue(formData, name);
}

async function currentProfileId() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  return profile?.id ?? null;
}

export async function createCustomer(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const createdBy = await currentProfileId();
  const contactName = textValue(formData, "contact_name");
  const phone = textValue(formData, "phone");

  if (!contactName || !phone) {
    throw new Error("Contact name and phone are required.");
  }

  const { error } = await supabase.from("customers").insert({
    customer_code: `CUST-${Date.now()}`,
    contact_name: contactName,
    company_name: textValue(formData, "company_name"),
    phone,
    email: textValue(formData, "email"),
    address: textValue(formData, "address"),
    city: textValue(formData, "city"),
    state: textValue(formData, "state"),
    assigned_agent_id: textValue(formData, "assigned_agent_id"),
    created_by: createdBy
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/customers");
}

export async function updateCustomer(id: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const contactName = textValue(formData, "contact_name");
  const phone = textValue(formData, "phone");

  if (!contactName || !phone) {
    throw new Error("Contact name and phone are required.");
  }

  const { error } = await supabase
    .from("customers")
    .update({
      contact_name: contactName,
      company_name: textValue(formData, "company_name"),
      phone,
      email: textValue(formData, "email"),
      address: textValue(formData, "address"),
      city: textValue(formData, "city"),
      state: textValue(formData, "state"),
      assigned_agent_id: textValue(formData, "assigned_agent_id")
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/customers");
}

export async function createVehicle(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const customerId = textValue(formData, "customer_id");
  const vehicleNo = textValue(formData, "vehicle_no");
  const vehicleType = textValue(formData, "vehicle_type");

  if (!customerId || !vehicleNo || !vehicleType) {
    throw new Error("Customer, vehicle number, and vehicle type are required.");
  }

  const { error } = await supabase.from("vehicles").insert({
    customer_id: customerId,
    vehicle_no: vehicleNo,
    vehicle_type: vehicleType,
    make: textValue(formData, "make"),
    model: textValue(formData, "model"),
    year: numberValue(formData, "year"),
    chassis_no: textValue(formData, "chassis_no"),
    engine_no: textValue(formData, "engine_no"),
    permit_no: textValue(formData, "permit_no"),
    gvw_kg: numberValue(formData, "gvw_kg"),
    registration_date: dateValue(formData, "registration_date"),
    fitness_expiry_date: dateValue(formData, "fitness_expiry_date"),
    puc_expiry_date: dateValue(formData, "puc_expiry_date"),
    road_tax_expiry_date: dateValue(formData, "road_tax_expiry_date"),
    national_permit_expiry_date: dateValue(formData, "national_permit_expiry_date"),
    local_permit_expiry_date: dateValue(formData, "local_permit_expiry_date")
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/vehicles");
}

export async function updateVehicle(id: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const customerId = textValue(formData, "customer_id");
  const vehicleNo = textValue(formData, "vehicle_no");
  const vehicleType = textValue(formData, "vehicle_type");

  if (!customerId || !vehicleNo || !vehicleType) {
    throw new Error("Customer, vehicle number, and vehicle type are required.");
  }

  const { error } = await supabase
    .from("vehicles")
    .update({
      customer_id: customerId,
      vehicle_no: vehicleNo,
      vehicle_type: vehicleType,
      make: textValue(formData, "make"),
      model: textValue(formData, "model"),
      year: numberValue(formData, "year"),
      chassis_no: textValue(formData, "chassis_no"),
      engine_no: textValue(formData, "engine_no"),
      permit_no: textValue(formData, "permit_no"),
      gvw_kg: numberValue(formData, "gvw_kg"),
      registration_date: dateValue(formData, "registration_date"),
      fitness_expiry_date: dateValue(formData, "fitness_expiry_date"),
      puc_expiry_date: dateValue(formData, "puc_expiry_date"),
      road_tax_expiry_date: dateValue(formData, "road_tax_expiry_date"),
      national_permit_expiry_date: dateValue(formData, "national_permit_expiry_date"),
      local_permit_expiry_date: dateValue(formData, "local_permit_expiry_date")
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/vehicles");
}

async function insuranceCompanyId(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const existingId = textValue(formData, "insurance_company_id");
  const newName = textValue(formData, "insurance_company_name");

  if (existingId) {
    return existingId;
  }

  if (!newName) {
    return null;
  }

  const { data: existing, error: existingError } = await supabase
    .from("insurance_companies")
    .select("id")
    .eq("name", newName)
    .maybeSingle<{ id: string }>();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    return existing.id;
  }

  const { data: created, error: createError } = await supabase
    .from("insurance_companies")
    .insert({ name: newName })
    .select("id")
    .single<{ id: string }>();

  if (createError) {
    throw new Error(createError.message);
  }

  return created.id;
}

export async function createPolicy(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const customerId = textValue(formData, "customer_id");
  const vehicleId = textValue(formData, "vehicle_id");
  const insurerId = await insuranceCompanyId(formData);
  const policyNo = textValue(formData, "policy_no");
  const policyType = textValue(formData, "policy_type");
  const startDate = textValue(formData, "start_date");
  const endDate = textValue(formData, "end_date");

  if (!customerId || !vehicleId || !insurerId || !policyNo || !policyType || !startDate || !endDate) {
    throw new Error("Customer, vehicle, insurer, policy number, policy type, and policy dates are required.");
  }

  const { error } = await supabase.from("policies").insert({
    customer_id: customerId,
    vehicle_id: vehicleId,
    insurance_company_id: insurerId,
    policy_no: policyNo,
    policy_type: policyType,
    insured_declared_value: numberValue(formData, "insured_declared_value"),
    start_date: startDate,
    end_date: endDate
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/policies");
}

export async function updatePolicy(id: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const customerId = textValue(formData, "customer_id");
  const vehicleId = textValue(formData, "vehicle_id");
  const insurerId = await insuranceCompanyId(formData);
  const policyNo = textValue(formData, "policy_no");
  const policyType = textValue(formData, "policy_type");
  const startDate = textValue(formData, "start_date");
  const endDate = textValue(formData, "end_date");

  if (!customerId || !vehicleId || !insurerId || !policyNo || !policyType || !startDate || !endDate) {
    throw new Error("Customer, vehicle, insurer, policy number, policy type, and policy dates are required.");
  }

  const { error } = await supabase
    .from("policies")
    .update({
      customer_id: customerId,
      vehicle_id: vehicleId,
      insurance_company_id: insurerId,
      policy_no: policyNo,
      policy_type: policyType,
      insured_declared_value: numberValue(formData, "insured_declared_value"),
      start_date: startDate,
      end_date: endDate
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/policies");
}

async function requireUserManager() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!canManageUsers(profile?.role)) {
    throw new Error("You do not have permission to manage users.");
  }
  return profile?.id ?? null;
}

export async function createProfileRecord(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  await requireUserManager();
  const email = textValue(formData, "email");
  const password = textValue(formData, "password");
  const fullName = textValue(formData, "full_name");
  const role = textValue(formData, "role");

  if (!email || !password || !fullName || !isAppRole(role)) {
    throw new Error("Email, password, name, and valid role are required.");
  }

  const { error } = await supabase.functions.invoke("create-user", {
    body: {
      email,
      password,
      full_name: fullName,
      role,
      phone: textValue(formData, "phone"),
      employee_code: textValue(formData, "employee_code"),
      reporting_manager_id: textValue(formData, "reporting_manager_id"),
      department: textValue(formData, "department"),
      designation: textValue(formData, "designation"),
      email_confirm: true
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/users");
  revalidatePath("/organization");
  redirect("/users");
}

export async function createProfileForExistingAuthUser(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const createdBy = await requireUserManager();
  const id = textValue(formData, "id");
  const fullName = textValue(formData, "full_name");
  const role = textValue(formData, "role");

  if (!id || !fullName || !isAppRole(role)) {
    throw new Error("Existing Auth user ID, name, and valid role are required.");
  }

  const { error } = await supabase.from("profiles").insert({
    id,
    full_name: fullName,
    role,
    email: textValue(formData, "email"),
    phone: textValue(formData, "phone"),
    employee_code: textValue(formData, "employee_code"),
    reporting_manager_id: textValue(formData, "reporting_manager_id"),
    department: textValue(formData, "department"),
    designation: textValue(formData, "designation"),
    is_active: true,
    created_by: createdBy,
    updated_by: createdBy
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/users");
  revalidatePath("/organization");
  redirect("/users");
}

export async function updateProfileRecord(id: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const updatedBy = await requireUserManager();
  const fullName = textValue(formData, "full_name");
  const role = textValue(formData, "role");

  if (!fullName || !isAppRole(role)) {
    throw new Error("Name and valid role are required.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      role,
      email: textValue(formData, "email"),
      phone: textValue(formData, "phone"),
      employee_code: textValue(formData, "employee_code"),
      reporting_manager_id: textValue(formData, "reporting_manager_id"),
      department: textValue(formData, "department"),
      designation: textValue(formData, "designation"),
      is_active: formData.get("is_active") === "true",
      updated_by: updatedBy
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/users");
  revalidatePath("/organization");
}

export async function setProfileActive(id: string, isActive: boolean) {
  const supabase = await createServerSupabaseClient();
  const updatedBy = await requireUserManager();
  const { error } = await supabase.from("profiles").update({ is_active: isActive, updated_by: updatedBy }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/users");
  revalidatePath("/organization");
}

export async function updateClaimStatus(id: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const changedBy = await currentProfileId();
  const nextStatus = textValue(formData, "current_status");
  const notes = textValue(formData, "notes");

  if (!nextStatus || !claimStatuses.includes(nextStatus as (typeof claimStatuses)[number])) {
    throw new Error("Choose a valid claim status.");
  }

  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .select("id, current_status")
    .eq("id", id)
    .maybeSingle<{ id: string; current_status: (typeof claimStatuses)[number] }>();

  if (claimError || !claim) {
    throw new Error(claimError?.message ?? "Claim not found.");
  }

  if (claim.current_status === nextStatus) {
    revalidatePath(`/claims/${id}`);
    return;
  }

  const { error: updateError } = await supabase
    .from("claims")
    .update({ current_status: nextStatus })
    .eq("id", id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: historyError } = await supabase.from("claim_status_history").insert({
    claim_id: id,
    from_status: claim.current_status,
    to_status: nextStatus,
    notes,
    changed_by: changedBy
  });

  if (historyError) {
    throw new Error(historyError.message);
  }

  revalidatePath(`/claims/${id}`);
  revalidatePath("/claims");
  revalidatePath("/timeline");
}
type ClaimForWorkflow = {
  id: string;
  claim_no: string;
  customer_id: string;
  current_status: ClaimStatus;
};

type ClaimDocumentForWorkflow = {
  id: string;
  claim_id: string;
  document_type: string;
  verification_status: "pending" | "verified" | "rejected";
};

async function currentProfile() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  return profile;
}

async function requireClaimStagePermission() {
  const profile = await currentProfile();
  if (!canUpdateClaimStage(profile?.role)) {
    throw new Error("You do not have permission to update claim workflow stages.");
  }
  return profile;
}

async function requireDocumentReviewPermission() {
  const profile = await currentProfile();
  if (!canVerifyClaimDocuments(profile?.role)) {
    throw new Error("You do not have permission to verify claim documents.");
  }
  return profile;
}

async function insertClaimHistory(claimId: string, fromStatus: ClaimStatus | null, toStatus: ClaimStatus, notes: string | null, changedBy: string | null) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("claim_status_history").insert({
    claim_id: claimId,
    from_status: fromStatus,
    to_status: toStatus,
    notes,
    changed_by: changedBy
  });
  if (error) throw new Error(error.message);
}

async function loadClaimForWorkflow(claimId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, claim_no, customer_id, current_status")
    .eq("id", claimId)
    .maybeSingle<ClaimForWorkflow>();
  if (error || !data) throw new Error(error?.message ?? "Claim not found.");
  if (!isClaimStatus(data.current_status)) throw new Error("Claim has an unsupported status.");
  return data;
}

async function loadDocumentsForClaim(claimId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claim_documents")
    .select("id, claim_id, document_type, verification_status")
    .eq("claim_id", claimId)
    .returns<ClaimDocumentForWorkflow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

function allRequiredDocumentsVerified(claim: ClaimForWorkflow, documents: ClaimDocumentForWorkflow[]) {
  const required = requiredDocumentTypesForStatus(claim.current_status);
  return required.every((type) => documents.some((document) => document.document_type === type && document.verification_status === "verified"));
}

export async function reviewClaimDocument(claimId: string, documentId: string, verificationStatus: "verified" | "rejected", formData: FormData) {
  const profile = await requireDocumentReviewPermission();
  const supabase = await createServerSupabaseClient();
  const claim = await loadClaimForWorkflow(claimId);
  const reason = textValue(formData, "reason");

  const { data: document, error: documentError } = await supabase
    .from("claim_documents")
    .select("id, claim_id, document_type, verification_status")
    .eq("id", documentId)
    .eq("claim_id", claimId)
    .maybeSingle<ClaimDocumentForWorkflow>();
  if (documentError || !document) throw new Error(documentError?.message ?? "Document not found.");

  const { error: reviewError } = await supabase.from("claim_documents").update({
    verification_status: verificationStatus,
    verified_by: profile?.id ?? null,
    verified_at: new Date().toISOString(),
    rejection_reason: verificationStatus === "rejected" ? reason ?? "Reupload requested by claim desk" : null
  }).eq("id", documentId);
  if (reviewError) throw new Error(reviewError.message);

  if (verificationStatus === "rejected") {
    const nextStatus = replacementStatusFor(claim.current_status);
    if (nextStatus !== claim.current_status) {
      const { error } = await supabase.from("claims").update({ current_status: nextStatus }).eq("id", claimId);
      if (error) throw new Error(error.message);
      await insertClaimHistory(claimId, claim.current_status, nextStatus, reason ?? `Reupload requested for ${document.document_type}.`, profile?.id ?? null);
    }
  } else {
    const documents = (await loadDocumentsForClaim(claimId)).map((item) => item.id === documentId ? { ...item, verification_status: "verified" as const } : item);
    const nextStatus = verifiedStatusFor(claim.current_status);
    if (nextStatus && nextStatus !== claim.current_status && allRequiredDocumentsVerified(claim, documents)) {
      const { error } = await supabase.from("claims").update({ current_status: nextStatus }).eq("id", claimId);
      if (error) throw new Error(error.message);
      await insertClaimHistory(claimId, claim.current_status, nextStatus, "All required documents verified by claim desk.", profile?.id ?? null);
    }
  }

  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/claims");
  revalidatePath("/dashboard");
}

export async function requestFinalDocuments(claimId: string, formData: FormData) {
  const profile = await requireClaimStagePermission();
  const supabase = await createServerSupabaseClient();
  const claim = await loadClaimForWorkflow(claimId);
  const notes = textValue(formData, "notes") ?? "Final documents requested from customer.";

  const { error: taskError } = await supabase.from("claim_tasks").insert(finalDocumentTypes.map((type) => ({
    claim_id: claimId,
    title: `Final document: ${type}`,
    description: "Customer must upload this final claim document.",
    status: "open" as const,
    created_by: profile?.id ?? null
  })));
  if (taskError) throw new Error(taskError.message);

  const nextStatus: ClaimStatus = "Final Documents Awaited";
  const { error } = await supabase.from("claims").update({ current_status: nextStatus }).eq("id", claimId);
  if (error) throw new Error(error.message);
  await insertClaimHistory(claimId, claim.current_status, nextStatus, notes, profile?.id ?? null);

  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/claims");
  revalidatePath("/dashboard");
}

function stageDetailsFromForm(formData: FormData) {
  const details: Record<string, string | number> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "notes" || key === "next_status" || key === "current_status") continue;
    if (typeof value !== "string" || !value.trim()) continue;
    const numericValue = Number(value.replace(/,/g, ""));
    details[key] = Number.isFinite(numericValue) && /amount|tds|gst|labour|parts|bill|received/i.test(key) ? numericValue : value.trim();
  }
  return details;
}

export async function advanceClaimWorkflow(claimId: string, formData: FormData) {
  const profile = await requireClaimStagePermission();
  const supabase = await createServerSupabaseClient();
  const claim = await loadClaimForWorkflow(claimId);
  const requestedStatus = textValue(formData, "next_status");
  const nextStatus = isClaimStatus(requestedStatus) ? requestedStatus : null;
  const allowedStatus = managerTransitions[claim.current_status];
  const notes = textValue(formData, "notes") ?? (nextStatus ? `Claim moved to ${nextStatus}.` : null);

  if (!nextStatus || nextStatus !== allowedStatus) {
    throw new Error("This status change is not allowed for the current claim stage.");
  }

  const { error } = await supabase.from("claims").update({ current_status: nextStatus }).eq("id", claimId);
  if (error) throw new Error(error.message);

  const details = stageDetailsFromForm(formData);
  if (Object.keys(details).length) {
    const { error: detailError } = await supabase.from("claim_stage_details").insert({
      claim_id: claimId,
      stage: nextStatus,
      details,
      created_by: profile?.id ?? null
    });
    if (detailError) throw new Error(detailError.message);
  }

  await insertClaimHistory(claimId, claim.current_status, nextStatus, notes, profile?.id ?? null);
  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/claims");
  revalidatePath("/dashboard");
}
