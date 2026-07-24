"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type PartnerType = "posp" | "misp";
type Application = {
  id: string;
  partner_type: PartnerType;
  status: string;
  customer_id: string | null;
};
type OnboardingProfile = {
  partner_type: PartnerType;
  pos_name: string | null;
  misp_name: string | null;
  applicant_phone: string | null;
  applicant_email: string | null;
  dp_name: string | null;
  dp_phone: string | null;
  dp_email: string | null;
  workflow_stage: string;
};
type CustomerProfile = {
  id: string;
  role: string;
  is_active: boolean;
};

export async function approvePospMispApplication(formData: FormData) {
  const applicationId = value(formData, "application_id");
  if (!applicationId) redirect("/customers/applications?error=missing_application");

  const reviewer = await requireMasterDataManager();
  if (!reviewer?.id) redirect(`/customers/applications/${applicationId}?error=unauthorized`);

  const admin = createSupabaseAdminClient();
  const { data: application, error: applicationError } = await admin
    .from("customer_onboarding_applications")
    .select("id, partner_type, status, customer_id")
    .eq("id", applicationId)
    .maybeSingle<Application>();

  if (applicationError || !application) {
    redirect(`/customers/applications/${applicationId}?error=application_not_found`);
  }
  if (application.customer_id && application.status === "approved") {
    redirect(`/customers/${application.customer_id}/edit`);
  }
  if (!["posp", "misp"].includes(application.partner_type) || !["submitted", "under_review"].includes(application.status)) {
    redirect(`/customers/applications/${applicationId}?error=application_not_ready`);
  }

  const { data: onboarding, error: onboardingError } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("partner_type, pos_name, misp_name, applicant_phone, applicant_email, dp_name, dp_phone, dp_email, workflow_stage")
    .eq("application_id", applicationId)
    .maybeSingle<OnboardingProfile>();

  if (onboardingError || !onboarding) {
    redirect(`/customers/applications/${applicationId}?error=posp_misp_profile_missing`);
  }
  if (onboarding.workflow_stage !== "completed") {
    redirect(`/customers/applications/${applicationId}?error=application_not_ready`);
  }

  const primaryPhone = normalizeIndianPhone(onboarding.applicant_phone);
  const primaryName = onboarding.partner_type === "posp"
    ? onboarding.pos_name
    : onboarding.misp_name ?? onboarding.dp_name;
  const secondaryPhone = onboarding.partner_type === "misp"
    ? normalizeIndianPhone(onboarding.dp_phone)
    : null;

  if (!primaryPhone || !primaryName?.trim() || (onboarding.partner_type === "misp" && !secondaryPhone)) {
    redirect(`/customers/applications/${applicationId}?error=incomplete_posp_misp_application`);
  }

  const createdAuthUserIds: string[] = [];
  let primaryProfileId: string;
  let secondaryProfileId: string | null = null;

  try {
    primaryProfileId = await resolveCustomerLogin({
      admin,
      phone: primaryPhone,
      fullName: primaryName,
      email: onboarding.applicant_email,
      createdAuthUserIds
    });

    if (secondaryPhone && secondaryPhone !== primaryPhone) {
      secondaryProfileId = await resolveCustomerLogin({
        admin,
        phone: secondaryPhone,
        fullName: onboarding.dp_name ?? "MISP DP",
        email: onboarding.dp_email,
        createdAuthUserIds
      });
    }

    const { data: customerId, error: approvalError } = await admin.rpc(
      "approve_posp_misp_onboarding_application",
      {
        p_application_id: applicationId,
        p_reviewer_profile_id: reviewer.id,
        p_primary_profile_id: primaryProfileId,
        p_secondary_profile_id: secondaryProfileId
      }
    );

    if (approvalError || typeof customerId !== "string") {
      throw approvalError ?? new Error("Approval did not return a customer.");
    }

    revalidatePath("/customers");
    revalidatePath("/customers/applications");
    revalidatePath(`/customers/applications/${applicationId}`);
    redirect(`/customers/${customerId}/edit?success=posp_misp_approved`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;

    await Promise.allSettled(
      createdAuthUserIds.map((userId) => admin.auth.admin.deleteUser(userId))
    );

    const reference = randomUUID().slice(0, 8);
    console.error(`POSP/MISP approval failed [${reference}]`, error);
    const code = approvalErrorCode(error);
    redirect(`/customers/applications/${applicationId}?error=${code}&reference=${reference}`);
  }
}

async function resolveCustomerLogin({
  admin,
  phone,
  fullName,
  email,
  createdAuthUserIds
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  phone: string;
  fullName: string;
  email: string | null;
  createdAuthUserIds: string[];
}) {
  const { data: existing, error: lookupError } = await admin
    .from("profiles")
    .select("id, role, is_active")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle<CustomerProfile>();

  if (lookupError) throw lookupError;
  if (existing) {
    if (existing.role !== "customer" || !existing.is_active) {
      throw new Error("The mobile number belongs to an unavailable internal login profile.");
    }
    return existing.id;
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    phone,
    phone_confirm: true,
    app_metadata: { app_role: "customer" },
    user_metadata: {
      full_name: fullName.trim(),
      phone,
      email: email?.trim() || null,
      app_role: "customer"
    }
  });
  if (authError || !authData.user) {
    throw authError ?? new Error("Customer login could not be created.");
  }

  createdAuthUserIds.push(authData.user.id);
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName.trim(),
      phone,
      email: email?.trim() || null,
      role: "customer",
      is_active: true
    })
    .eq("id", authData.user.id);
  if (profileError) throw profileError;

  return authData.user.id;
}

function normalizeIndianPhone(input: string | null) {
  const digits = input?.replace(/\D/g, "") ?? "";
  if (digits.length < 10) return null;
  return `+91${digits.slice(-10)}`;
}

function approvalErrorCode(error: unknown) {
  const message = error instanceof Error
    ? error.message.toLowerCase()
    : typeof error === "object" && error && "message" in error
      ? String(error.message).toLowerCase()
      : "";

  if (message.includes("already uses") || message.includes("duplicate")) return "customer_already_exists";
  if (message.includes("not ready")) return "application_not_ready";
  if (message.includes("profile") || message.includes("login")) return "posp_misp_login_failed";
  if (message.includes("incomplete") || message.includes("required")) return "incomplete_posp_misp_application";
  return "posp_misp_approval_failed";
}

function isNextRedirect(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "digest" in error
    && typeof error.digest === "string"
    && error.digest.startsWith("NEXT_REDIRECT");
}

function value(formData: FormData, name: string) {
  const field = formData.get(name);
  return typeof field === "string" && field.trim() ? field.trim() : null;
}
