"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getIntermediaryGroupEmployeeScope,
  requireIntermediaryGroupManager,
} from "@/lib/intermediary-group-access";

type PartnerRow = { id: string; source_application_id: string | null };
type OwnerRow = { application_id: string | null; associate_employee_id: string | null };

export async function createBranchProfile(formData: FormData) {
  const profile = await requireIntermediaryGroupManager();
  const branchName = text(formData, "branch_name");
  const phone = text(formData, "phone");
  const email = text(formData, "email").toLowerCase();
  const contactName = text(formData, "contact_name");
  const address = text(formData, "address");
  const parentPartnerId = text(formData, "parent_partner_id");

  if (!branchName || !phone || !email || !contactName || !address || !parentPartnerId) {
    return fail("All Branch onboarding fields are required.");
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid email address.");
  if (!/^\+?[0-9 ()-]{7,20}$/.test(phone)) return fail("Enter a valid phone number.");
  if (!(await canAccessParentPartner(profile, parentPartnerId))) {
    return fail("The selected Partner is outside your permitted hierarchy.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("service_create_partner_branch_profile", {
    p_branch_name: branchName,
    p_phone: phone,
    p_email: email,
    p_contact_name: contactName,
    p_address: address,
    p_parent_partner_id: parentPartnerId,
    p_actor_profile_id: profile.id,
  });
  if (error) return fail(error.message || "Branch could not be created.");

  revalidatePath("/intermediaries/groups");
  revalidatePath("/intermediaries/groups/branches/new");
  redirect("/intermediaries/groups?success=branch_created");
}

async function canAccessParentPartner(
  profile: Awaited<ReturnType<typeof requireIntermediaryGroupManager>>,
  partnerId: string,
) {
  const scope = await getIntermediaryGroupEmployeeScope(profile);
  if (scope.mode === "organization") return true;
  if (!scope.employeeIds.length) return false;

  const admin = createSupabaseAdminClient();
  const { data: partner } = await admin
    .from("partners")
    .select("id,source_application_id")
    .eq("id", partnerId)
    .eq("partner_status", "active_partner")
    .is("parent_partner_id", null)
    .maybeSingle<PartnerRow>();
  if (!partner?.source_application_id) return false;

  const [{ data: intermediary }, { data: onboarding }] = await Promise.all([
    admin
      .from("intermediaries")
      .select("application_id,associate_employee_id")
      .eq("application_id", partner.source_application_id)
      .eq("intermediary_type", "partner")
      .maybeSingle<OwnerRow>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("application_id,associate_employee_id")
      .eq("application_id", partner.source_application_id)
      .maybeSingle<OwnerRow>(),
  ]);

  const ownerId = intermediary?.associate_employee_id ?? onboarding?.associate_employee_id ?? null;
  return Boolean(ownerId && scope.employeeIds.includes(ownerId));
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(`/intermediaries/groups/branches/new?error=${encodeURIComponent(message)}`);
}
