"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type Application = {
  id: string;
  partner_type: "posp" | "misp";
  status: string;
  intermediary_id: string | null;
};

type OnboardingProfile = {
  id: string;
  workflow_stage: string;
  final_account_type: "posp" | "misp" | "partner" | null;
  partner_type: "posp" | "misp";
  partner_decision: string;
  iib_remarks: string | null;
};

export async function approvePospMispApplication(formData: FormData) {
  const applicationId = value(formData, "application_id");
  if (!applicationId) redirect("/customers/posp-misp?error=missing_application");

  const reviewer = await requirePospMispManager();
  if (!reviewer?.id) redirect(`/customers/applications/${applicationId}?error=unauthorized`);

  const admin = createSupabaseAdminClient();
  const { data: application, error: applicationError } = await admin
    .from("customer_onboarding_applications")
    .select("id, partner_type, status, intermediary_id")
    .eq("id", applicationId)
    .maybeSingle<Application>();

  if (applicationError || !application) redirect(`/customers/applications/${applicationId}?error=application_not_found`);
  if (!["posp", "misp"].includes(application.partner_type)) redirect(`/customers/applications/${applicationId}?error=application_not_ready`);

  const { data: onboarding, error: onboardingError } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("id, workflow_stage, final_account_type, partner_type, partner_decision, iib_remarks")
    .eq("application_id", applicationId)
    .maybeSingle<OnboardingProfile>();

  if (onboardingError || !onboarding) redirect(`/customers/applications/${applicationId}?error=posp_misp_profile_missing`);
  if (onboarding.workflow_stage !== "completed") redirect(`/customers/applications/${applicationId}?error=application_not_ready`);

  const finalType = onboarding.final_account_type ?? onboarding.partner_type;
  const normalRoute = onboarding.iib_remarks === "No Data Found In POS System" && ["posp", "misp"].includes(finalType);
  const partnerRoute = onboarding.iib_remarks === "Matching Record Found In DataBase" && onboarding.partner_decision === "convert_to_partner" && finalType === "partner";
  if (!normalRoute && !partnerRoute) redirect(`/customers/applications/${applicationId}?error=application_not_ready`);

  const now = new Date().toISOString();
  const { data: intermediary, error: intermediaryError } = await admin
    .from("intermediaries")
    .update({
      intermediary_type: finalType,
      account_status: "active",
      compliance_status: finalType === "partner" ? "restricted_partner" : "approved",
      visibility_level: finalType === "partner" ? "restricted" : "standard",
      activated_at: now,
      updated_by: reviewer.id,
      updated_at: now
    })
    .eq("onboarding_profile_id", onboarding.id)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (intermediaryError || !intermediary?.id) redirect(`/customers/applications/${applicationId}?error=intermediary_activation_failed`);

  const { error: applicationUpdateError } = await admin
    .from("customer_onboarding_applications")
    .update({
      status: "approved",
      intermediary_id: intermediary.id,
      customer_id: null,
      reviewed_by: reviewer.id,
      reviewed_at: now,
      completed_at: now,
      updated_at: now
    })
    .eq("id", applicationId);

  if (applicationUpdateError) redirect(`/customers/applications/${applicationId}?error=intermediary_activation_failed`);

  revalidatePath("/intermediaries");
  revalidatePath("/customers/posp-misp");
  revalidatePath(`/customers/applications/${applicationId}`);
  redirect(`/customers/applications/${applicationId}?success=intermediary_activated`);
}

function value(formData: FormData, name: string) {
  const field = formData.get(name);
  return typeof field === "string" && field.trim() ? field.trim() : null;
}
