"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { approvePortalOnboardingApplication, beginPortalOnboardingApplication, markPortalOnboardingForCorrection } from "./onboarding-applications";

export type GroupOnboardingState = { error: string | null; field: string | null };

function fail(error: string, field: string | null = null): GroupOnboardingState { return { error, field }; }
function text(data: FormData, name: string) { const value = data.get(name); return typeof value === "string" && value.trim() ? value.trim() : null; }
function phone(value: string | null) { if (!value) return null; const digits = value.replace(/\D/g, ""); return digits.length === 10 ? `+91${digits}` : null; }

export async function createGroupOnboarding(_state: GroupOnboardingState, data: FormData): Promise<GroupOnboardingState> {
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile?.id || !canManageMasterData(profile.role)) return fail("You are not authorized to onboard groups.");

  const groupName = text(data, "group_name");
  const ownerName = text(data, "owner_name");
  const contactNumber = phone(text(data, "phone"));
  const email = text(data, "email");

  if (!groupName) return fail("Enter the group name.", "group_name");
  if (!ownerName) return fail("Enter the owner name.", "owner_name");
  if (!contactNumber) return fail("Enter a valid 10-digit contact number.", "phone");

  const admin = createSupabaseAdminClient();
  let application: { id: string };
  try {
    application = await beginPortalOnboardingApplication(admin, {
      initiatedBy: profile.id,
      partnerType: "group",
      phone: contactNumber,
      email,
      draftData: { group_name: groupName, owner_name: ownerName }
    });
  } catch (error) {
    return fail(`Onboarding application could not be prepared: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  const correction = async (message: string) => { await markPortalOnboardingForCorrection(admin, application.id, message); };

  const { data: customer, error: customerError } = await admin.from("customers").insert({
    customer_code: `CUST-${Date.now().toString().slice(-9)}`,
    partner_type: "group",
    contact_name: ownerName,
    company_name: groupName,
    legal_trade_name: groupName,
    phone: contactNumber,
    email,
    onboarding_status: "active",
    created_by: profile.id,
    updated_by: profile.id
  }).select("id").single<{ id: string }>();

  if (customerError || !customer) {
    await correction(customerError?.message ?? "Group could not be saved.");
    return fail(`Group could not be saved: ${customerError?.message ?? "Unknown error"}`);
  }

  const cleanup = async () => { await admin.from("customers").delete().eq("id", customer.id); };

  const { error: groupError } = await admin.from("group_profiles").insert({
    customer_id: customer.id,
    group_name: groupName,
    owner_name: ownerName,
    company_name: groupName
  });
  if (groupError) {
    await cleanup();
    await correction(groupError.message);
    return fail(`Group profile could not be saved: ${groupError.message}`);
  }

  const { error: contactError } = await admin.from("customer_onboarding_contacts").insert({
    application_id: application.id,
    contact_role: "group_owner",
    full_name: ownerName,
    phone: contactNumber,
    email,
    login_required: true
  });
  if (contactError) {
    await cleanup();
    await correction(contactError.message);
    return fail(`Group contact could not be saved: ${contactError.message}`);
  }

  const { error: membershipError } = await admin.from("customer_memberships").insert({
    customer_id: customer.id,
    invited_phone: contactNumber,
    invited_email: email,
    membership_role: "group_owner",
    is_primary: true,
    status: "pending",
    created_by: profile.id
  });
  if (membershipError) {
    await cleanup();
    await correction(membershipError.message);
    return fail(`Group login access could not be prepared: ${membershipError.message}`);
  }

  try {
    await approvePortalOnboardingApplication(admin, application.id, customer.id, profile.id);
  } catch (error) {
    return fail(`Group was created, but its onboarding application could not be completed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  redirect("/customers?success=group_created");
}
