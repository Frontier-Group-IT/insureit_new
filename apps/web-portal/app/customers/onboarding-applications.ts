import type { SupabaseClient } from "@supabase/supabase-js";

type PartnerType = "individual_proprietor" | "dealership" | "corporate" | "group" | "posp" | "misp";

type BeginApplicationInput = {
  profileId?: string | null;
  initiatedBy: string;
  partnerType: PartnerType;
  phone: string;
  email?: string | null;
  draftData: Record<string, unknown>;
};

export async function beginPortalOnboardingApplication(admin: SupabaseClient, input: BeginApplicationInput) {
  const now = new Date().toISOString();
  const payload = {
    profile_id: input.profileId ?? null,
    initiated_by: input.initiatedBy,
    source: "manager_portal",
    partner_type: input.partnerType,
    status: "submitted",
    current_step: 4,
    applicant_phone: input.phone,
    applicant_email: input.email ?? null,
    draft_data: input.draftData,
    submitted_at: now
  };

  let existingQuery = admin
    .from("customer_onboarding_applications")
    .select("id")
    .not("status", "in", "(approved,rejected,cancelled)")
    .order("created_at", { ascending: false })
    .limit(1);
  existingQuery = input.profileId
    ? existingQuery.eq("profile_id", input.profileId)
    : existingQuery.eq("source", "manager_portal").eq("partner_type", input.partnerType).eq("applicant_phone", input.phone);
  const { data: existing, error: lookupError } = await existingQuery.maybeSingle<{ id: string }>();
  if (lookupError) throw lookupError;
  if (existing) {
    const { data, error } = await admin
      .from("customer_onboarding_applications")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single<{ id: string }>();
    if (error || !data) throw error ?? new Error("Unable to update onboarding application.");
    return data;
  }

  const { data, error } = await admin
    .from("customer_onboarding_applications")
    .insert(payload)
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw error ?? new Error("Unable to create onboarding application.");
  return data;
}

export async function approvePortalOnboardingApplication(admin: SupabaseClient, applicationId: string, customerId: string, reviewerId: string) {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("customer_onboarding_applications")
    .update({
      status: "approved",
      customer_id: customerId,
      reviewed_by: reviewerId,
      reviewed_at: now,
      completed_at: now
    })
    .eq("id", applicationId);
  if (error) throw error;
}

export async function markPortalOnboardingForCorrection(admin: SupabaseClient, applicationId: string, message: string) {
  const { data } = await admin
    .from("customer_onboarding_applications")
    .select("draft_data")
    .eq("id", applicationId)
    .maybeSingle<{ draft_data: Record<string, unknown> | null }>();
  await admin
    .from("customer_onboarding_applications")
    .update({
      status: "changes_requested",
      draft_data: { ...(data?.draft_data ?? {}), processing_error: message }
    })
    .eq("id", applicationId);
}
