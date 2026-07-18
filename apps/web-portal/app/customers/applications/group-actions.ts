"use server";

import { randomUUID } from "node:crypto";
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
  draft_data: Draft | null;
};

export async function approveMobileGroupApplication(formData: FormData) {
  const applicationId = value(formData, "application_id");
  if (!applicationId) redirect("/customers/applications?error=missing_application");

  const reviewer = await requireMasterDataManager();
  if (!reviewer?.id) redirect(`/customers/applications/${applicationId}?error=unauthorized`);

  // Approval is an explicitly authorized server-side operation. Use the service
  // client so inserts into protected profile and membership tables are not
  // blocked by end-user RLS policies after the reviewer has been verified.
  const admin = createSupabaseAdminClient();
  const { data: application, error } = await admin
    .from("customer_onboarding_applications")
    .select("id, profile_id, partner_type, status, applicant_phone, applicant_email, draft_data")
    .eq("id", applicationId)
    .single<Application>();

  if (error || !application) redirect(`/customers/applications/${applicationId}?error=application_not_found`);
  if (!application.profile_id || application.partner_type !== "group" || !["submitted", "under_review"].includes(application.status)) {
    redirect(`/customers/applications/${applicationId}?error=application_not_ready`);
  }

  const draft = application.draft_data ?? {};
  const groupName = text(draft.group_name);
  const ownerName = text(draft.owner_name);
  const loginPhone = application.applicant_phone;
  const ownerPhone = text(draft.owner_phone) ?? loginPhone;
  const email = text(draft.email) ?? application.applicant_email;
  if (!groupName || !ownerName || !loginPhone || !ownerPhone) redirect(`/customers/applications/${applicationId}?error=incomplete_application`);

  const { data: duplicate } = await admin
    .from("customers")
    .select("id")
    .or(`profile_id.eq.${application.profile_id},phone.eq.${ownerPhone}`)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (duplicate) redirect(`/customers/applications/${applicationId}?error=customer_already_exists`);

  const customerId = randomUUID();
  const now = new Date().toISOString();
  const { error: customerError } = await admin.from("customers").insert({
    id: customerId,
    profile_id: application.profile_id,
    customer_code: `CUST-${Date.now().toString().slice(-9)}`,
    partner_type: "group",
    contact_name: ownerName,
    company_name: groupName,
    phone: ownerPhone,
    email,
    onboarding_status: "active",
    onboarding_completed_at: now,
    created_by: reviewer.id,
    updated_by: reviewer.id,
  });
  if (customerError) redirect(`/customers/applications/${applicationId}?error=customer_create_failed`);

  const { error: groupError } = await admin.from("group_profiles").insert({
    customer_id: customerId,
    group_name: groupName,
    owner_name: ownerName,
  });
  if (groupError) {
    await admin.from("customers").delete().eq("id", customerId);
    console.error("Group profile creation failed", groupError);
    redirect(`/customers/applications/${applicationId}?error=group_profile_failed`);
  }

  const { error: membershipError } = await admin.from("customer_memberships").insert({
    customer_id: customerId,
    profile_id: application.profile_id,
    invited_phone: loginPhone,
    invited_email: email,
    membership_role: "group_owner",
    is_primary: true,
    status: "active",
    created_by: reviewer.id,
  });
  if (membershipError) {
    await admin.from("group_profiles").delete().eq("customer_id", customerId);
    await admin.from("customers").delete().eq("id", customerId);
    redirect(`/customers/applications/${applicationId}?error=membership_create_failed`);
  }

  await admin
    .from("customer_onboarding_contacts")
    .update({ linked_profile_id: application.profile_id, membership_status: "active", updated_at: now })
    .eq("application_id", applicationId)
    .eq("contact_role", "group_owner");

  await approvePortalOnboardingApplication(admin, applicationId, customerId, reviewer.id);
  revalidatePath("/customers");
  revalidatePath("/customers/applications");
  redirect(`/customers/${customerId}/edit?success=group_kyc_approved`);
}

function value(formData: FormData, name: string) {
  const field = formData.get(name);
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

function text(input: unknown) {
  return typeof input === "string" && input.trim() ? input.trim() : null;
}
