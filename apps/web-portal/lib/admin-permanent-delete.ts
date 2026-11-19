import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PermanentDeleteKind = "user" | "branch" | "partner" | "onboarding_application";
export type PermanentDeleteResult = { status: "success" | "error"; message: string };

type Blocker = { table: string; column: string; delete_rule: string; count: number };

async function requireItSuperUser() {
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile?.id || profile.role !== "it_super_user") {
    throw new Error("Only an IT Super User can permanently delete records.");
  }
  return profile;
}

async function blockers(targetTable: "profiles" | "employees" | "partners" | "intermediaries", id: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_hard_delete_blockers", {
    p_target_table: targetTable,
    p_target_id: id,
  });
  if (error) throw new Error("Deletion safety check could not be completed.");
  return (Array.isArray(data) ? data : []) as Blocker[];
}

function formatBlockers(items: Blocker[]) {
  if (!items.length) return "";
  const names = [...new Set(items.map((item) => item.table.replaceAll("_", " ")))].slice(0, 4);
  const suffix = items.length > names.length ? " and other protected records" : "";
  return `${names.join(", ")}${suffix}`;
}

async function deleteAuthBackedProfile(profileId: string) {
  const admin = createSupabaseAdminClient();
  const { data: authLookup } = await admin.auth.admin.getUserById(profileId);

  const { error: profileError } = await admin.from("profiles").delete().eq("id", profileId);
  if (profileError) throw new Error("The portal profile could not be permanently removed.");

  if (authLookup?.user) {
    const { error: authError } = await admin.auth.admin.deleteUser(profileId);
    if (authError) throw new Error("The portal profile was removed, but the authentication user could not be removed. Retry the deletion from IT administration.");
  }
}

async function deleteUser(profileId: string, actorId: string): Promise<PermanentDeleteResult> {
  if (profileId === actorId) return { status: "error", message: "You cannot permanently delete your own IT Super User account." };

  const admin = createSupabaseAdminClient();
  const { data: target, error } = await admin
    .from("profiles")
    .select("id,full_name,role,employee_id")
    .eq("id", profileId)
    .maybeSingle<{ id: string; full_name: string; role: string; employee_id: string | null }>();
  if (error || !target) return { status: "error", message: "The User Management record could not be found." };
  const targetKind = target.role === "customer" ? "customer account" : target.role === "intermediary" ? "intermediary account" : "employee";
  const profileBlockers = await blockers("profiles", profileId);
  const cleanupTables = target.role === "customer"
    ? new Set(["customer_firebase_identity_links", "customer_onboarding_contacts", "customer_onboarding_applications", "customer_memberships"])
    : new Set<string>();
  const protectedProfileBlockers = profileBlockers.filter((item) => !cleanupTables.has(item.table));

  if (protectedProfileBlockers.length) {
    return { status: "error", message: `Cannot permanently delete this ${targetKind} because protected history exists in ${formatBlockers(protectedProfileBlockers)}. Deactivate or disable access instead.` };
  }

  if (target.role === "customer") {
    const { error: firebaseIdentityError } = await admin
      .from("customer_firebase_identity_links")
      .delete()
      .eq("profile_id", profileId);
    if (firebaseIdentityError) {
      return { status: "error", message: "The customer login identity could not be detached safely." };
    }

    const { error: onboardingContactError } = await admin
      .from("customer_onboarding_contacts")
      .update({ linked_profile_id: null })
      .eq("linked_profile_id", profileId);
    if (onboardingContactError) {
      return { status: "error", message: "The customer onboarding profile link could not be detached safely." };
    }

    const { error: onboardingApplicationError } = await admin
      .from("customer_onboarding_applications")
      .update({ profile_id: null })
      .eq("profile_id", profileId);
    if (onboardingApplicationError) {
      return { status: "error", message: "The customer onboarding history could not be preserved safely." };
    }

    const { error: membershipProfileError } = await admin
      .from("customer_memberships")
      .update({ profile_id: null })
      .eq("profile_id", profileId);
    if (membershipProfileError) {
      return { status: "error", message: "The customer membership link could not be preserved safely." };
    }

    const { error: membershipCreatorError } = await admin
      .from("customer_memberships")
      .update({ created_by: null })
      .eq("created_by", profileId);
    if (membershipCreatorError) {
      return { status: "error", message: "The customer membership history could not be preserved safely." };
    }
  }

  if (target.role === "intermediary") {
    const { error: portalAccountError } = await admin
      .from("intermediary_portal_accounts")
      .update({ auth_user_id: null })
      .eq("auth_user_id", profileId);
    if (portalAccountError) {
      return { status: "error", message: "The intermediary portal login could not be detached safely." };
    }
  }

  if (target.employee_id) {
    const employeeBlockers = await blockers("employees", target.employee_id);
    if (employeeBlockers.length) {
      return { status: "error", message: `Cannot permanently delete this employee because protected business history exists in ${formatBlockers(employeeBlockers)}. Deactivate the employee instead.` };
    }
  }

  await deleteAuthBackedProfile(profileId);

  if (target.employee_id) {
    const { error: employeeDeleteError } = await admin.from("employees").delete().eq("id", target.employee_id);
    if (employeeDeleteError) {
      return { status: "error", message: "The portal login was removed, but the employee directory record could not be removed. Refresh and contact the IT administrator." };
    }
  }

  revalidatePath("/users");
  revalidatePath("/employees");
  revalidatePath("/customers");
  revalidatePath("/intermediaries");
  revalidatePath("/intermediaries/partner");
  revalidatePath("/organization");
  revalidatePath("/system/access-control");
  return { status: "success", message: `${target.full_name} was permanently deleted from User Management.` };
}

async function deleteBranch(partnerId: string): Promise<PermanentDeleteResult> {
  const admin = createSupabaseAdminClient();
  const { data: branch, error: branchError } = await admin
    .from("partners")
    .select("id,display_name,source_application_id,partner_branch_profiles!partner_branch_profiles_partner_id_fkey!inner(id,source_application_id)")
    .eq("id", partnerId)
    .maybeSingle<{ id: string; display_name: string; source_application_id: string | null; partner_branch_profiles: Array<{ id: string; source_application_id: string }> }>();
  if (branchError) return { status: "error", message: "The branch lookup failed. Please retry or contact IT support." };
  if (!branch) return { status: "error", message: "The branch record could not be found." };

  const allBlockers = await blockers("partners", partnerId);
  // Onboarding-only references are administrative history, not business activity.
  // Preserve those applications by removing their branch link before deletion.
  const onboardingReferences = allBlockers.filter((item) =>
    item.table === "intermediary_onboarding_applications" && item.column === "partner_record_id"
  );
  const { data: onboardingRows, error: onboardingError } = await admin
    .from("intermediary_onboarding_applications")
    .select("id,source,partner_record_id")
    .eq("partner_record_id", partnerId)
    .returns<Array<{ id: string; source: string; partner_record_id: string | null }>>();
  if (onboardingError) {
    return { status: "error", message: "The branch onboarding references could not be verified." };
  }
  const detachableApplicationIds = (onboardingRows ?? [])
    .filter((row) => row.source === "branch_onboarding")
    .map((row) => row.id);
  const referencedCount = onboardingReferences.reduce((total, item) => total + item.count, 0);
  // Any unexpected onboarding reference remains protected, as do business records.
  const allOnboardingReferencesVerified = referencedCount === detachableApplicationIds.length;
  const blocking = allBlockers.filter((item) =>
    item.table !== "partner_branch_profiles"
    && !(allOnboardingReferencesVerified && item.table === "intermediary_onboarding_applications" && item.column === "partner_record_id")
  );
  if (blocking.length) {
    return { status: "error", message: `Cannot permanently delete this branch because protected business history exists in ${formatBlockers(blocking)}.` };
  }

  // Snapshot the branch profile so a late FK error cannot silently remove it.
  const { data: savedBranchProfile, error: savedProfileError } = await admin
    .from("partner_branch_profiles").select("*").eq("partner_id", partnerId).maybeSingle();
  if (savedProfileError || !savedBranchProfile) {
    return { status: "error", message: "The branch profile could not be loaded for safe deletion." };
  }

  const { data: portal } = await admin
    .from("portal_access_identities")
    .select("profile_id")
    .eq("entity_type", "branch")
    .eq("entity_id", partnerId)
    .maybeSingle<{ profile_id: string }>();

  if (portal?.profile_id) {
    const profileBlockers = await blockers("profiles", portal.profile_id);
    if (profileBlockers.length) {
      return { status: "error", message: "This branch has a portal login referenced by protected history. Disable the login instead of deleting the branch." };
    }
    await deleteAuthBackedProfile(portal.profile_id);
  }

  // Keep the application rows and remove only their branch references.
  if (detachableApplicationIds.length) {
    const { error: detachError } = await admin.from("intermediary_onboarding_applications")
      .update({ partner_record_id: null }).in("id", detachableApplicationIds).eq("partner_record_id", partnerId);
    if (detachError) return { status: "error", message: "The branch onboarding link could not be detached safely." };
  }
  const restoreOnboardingLinks = async () => {
    if (!detachableApplicationIds.length) return;
    await admin.from("intermediary_onboarding_applications")
      .update({ partner_record_id: partnerId }).in("id", detachableApplicationIds).is("partner_record_id", null);
  };

  const { error: profileError } = await admin.from("partner_branch_profiles").delete().eq("partner_id", partnerId);
  if (profileError) {
    await restoreOnboardingLinks();
    return { status: "error", message: "The branch profile could not be removed." };
  }

  const { error: partnerError } = await admin.from("partners").delete().eq("id", partnerId);
  if (partnerError) {
    // Restore saved profile and its onboarding back-reference on a late FK failure.
    const { error: restoreError } = await admin.from("partner_branch_profiles").insert(savedBranchProfile);
    if (!restoreError) await restoreOnboardingLinks();
    return { status: "error", message: restoreError
      ? "Deletion was blocked and restoring the branch profile failed. Contact IT administration."
      : "The branch is still referenced by protected records and cannot be permanently deleted." };
  }

  revalidatePath("/intermediaries/groups/branches");
  revalidatePath("/intermediaries/groups");
  revalidatePath("/intermediaries/applications");
  return { status: "success", message: `${branch.display_name} was permanently deleted.` };
}

async function deletePartner(intermediaryId: string, partnerRecordId?: string): Promise<PermanentDeleteResult> {
  const admin = createSupabaseAdminClient();
  const { data: intermediary } = await admin
    .from("intermediaries")
    .select("id,display_name,intermediary_type,application_id")
    .eq("id", intermediaryId)
    .eq("intermediary_type", "partner")
    .maybeSingle<{ id: string; display_name: string; intermediary_type: string; application_id: string | null }>();
  if (!intermediary) return { status: "error", message: "The partner record could not be found." };

  const intermediaryBlockers = await blockers("intermediaries", intermediaryId);
  if (intermediaryBlockers.length) {
    return { status: "error", message: `Cannot permanently delete this partner because protected business history exists in ${formatBlockers(intermediaryBlockers)}.` };
  }

  const { data: portalAccounts } = await admin
    .from("intermediary_portal_accounts")
    .select("auth_user_id")
    .eq("intermediary_id", intermediaryId)
    .returns<Array<{ auth_user_id: string }>>();

  for (const portalAccount of portalAccounts ?? []) {
    const profileBlockers = await blockers("profiles", portalAccount.auth_user_id);
    if (profileBlockers.length) {
      return { status: "error", message: "This partner has a portal login referenced by protected history. Disable the login instead of deleting the partner." };
    }
  }

  if (partnerRecordId) {
    const partnerBlockers = await blockers("partners", partnerRecordId);
    const cleanupTables = new Set(["intermediary_onboarding_applications", "posp_misp_onboarding_profiles", "intermediary_group_memberships"]);
    const blocking = partnerBlockers.filter((item) => !cleanupTables.has(item.table));
    if (blocking.length) {
      return { status: "error", message: `Cannot permanently delete this partner because protected business history exists in ${formatBlockers(blocking)}.` };
    }

    await admin.from("intermediary_group_memberships").delete().eq("partner_id", partnerRecordId);
    await admin.from("intermediary_onboarding_applications").update({ partner_record_id: null }).eq("partner_record_id", partnerRecordId);
    await admin.from("posp_misp_onboarding_profiles").update({ partner_record_id: null }).eq("partner_record_id", partnerRecordId);

    const { error: partnerDeleteError } = await admin.from("partners").delete().eq("id", partnerRecordId);
    if (partnerDeleteError) return { status: "error", message: "The partner remains linked to protected business records and cannot be permanently deleted." };
  }

  for (const portalAccount of portalAccounts ?? []) {
    await deleteAuthBackedProfile(portalAccount.auth_user_id);
  }

  const { error: intermediaryDeleteError } = await admin.from("intermediaries").delete().eq("id", intermediaryId);
  if (intermediaryDeleteError) {
    return { status: "error", message: "The partner account could not be permanently removed because protected history still references it." };
  }

  revalidatePath("/intermediaries/partner");
  revalidatePath("/intermediaries");
  return { status: "success", message: `${intermediary.display_name} was permanently deleted.` };
}


/**
 * Application-only Partner onboarding deletion.
 * The database cascades application-owned draft tables (documents, contacts and onboarding profile).
 * Any business, registration, identity or portal-account association must block deletion.
 * This is deliberately separate from deleting a Partner master.
 */
async function deletePendingPartnerApplication(applicationId: string): Promise<PermanentDeleteResult> {
  const admin = createSupabaseAdminClient();
  const { data: application, error: lookupError } = await admin
    .from("intermediary_onboarding_applications")
    .select("id,applicant_phone,status,registration_status,partner_status,partner_record_id,intermediary_id,registration_record_id,completed_at,partner_activated_at,requested_type")
    .eq("id", applicationId)
    .maybeSingle<{
      id: string; applicant_phone: string | null; status: string | null;
      registration_status: string | null; partner_status: string | null;
      partner_record_id: string | null; intermediary_id: string | null;
      registration_record_id: string | null; completed_at: string | null;
      partner_activated_at: string | null; requested_type: string | null;
    }>();
  if (lookupError) return { status: "error", message: "The onboarding application could not be checked." };
  if (!application) return { status: "error", message: "The pending onboarding application was not found." };

  // Fail closed if status is unexpected or anything has been activated/registered.
  const allowedStatuses = new Set(["draft", "submitted", "pending", "in_review"]);
  if (!allowedStatuses.has((application.status ?? "").toLowerCase())
    || application.completed_at || application.partner_activated_at
    || application.partner_record_id || application.intermediary_id || application.registration_record_id
    || !["draft", "pending", ""].includes((application.partner_status ?? "").toLowerCase())
    || !["partner", "posp", "misp"].includes((application.requested_type ?? "").toLowerCase())
    || !["primary_pending", "draft", "pending", "", "submitted"].includes((application.registration_status ?? "").toLowerCase())) {
    return { status: "error", message: "This application is no longer an unlinked pending onboarding record. Review it instead of permanently deleting it." };
  }

  // Check every reference that could carry live business, identity, portal login,
  // import or registration history. Do not silently detach SET NULL relationships.
  const protectedLinks: Array<[string, string]> = [
    ["business_referral_identities", "intermediary_application_id"],
    ["intermediaries", "application_id"],
    ["intermediary_portal_accounts", "application_id"],
    ["intermediary_registrations", "application_id"],
    ["partner_branch_profiles", "source_application_id"],
    ["partner_portal_associate_accounts", "application_id"],
    ["partners", "source_application_id"],
    ["posp_misp_import_rows", "application_id"],
    ["intermediary_iib_submission_packets", "application_id"],
    ["intermediary_training_exam_assignments", "application_id"],
    ["pan_verification_jobs", "application_id"],
  ];
  for (const [table, column] of protectedLinks) {
    const { data, error } = await admin.from(table).select(column).eq(column, applicationId).limit(1);
    if (error) return { status: "error", message: "A dependency safety check failed. Nothing was deleted." };
    if (data?.length) return { status: "error", message: "This application has linked registration, verification or business history and cannot be permanently deleted." };
  }

  // Equality guards prevent acting on a different status after review.
  // PostgreSQL foreign-key restrictions still prevent late creation of protected RESTRICT rows.
  const deleteQuery = admin
    .from("intermediary_onboarding_applications")
    .delete()
    .eq("id", applicationId)
    .eq("status", application.status);
  const guardedQuery = application.registration_status === null
    ? deleteQuery.is("registration_status", null)
    : deleteQuery.eq("registration_status", application.registration_status);
  const { data: deleted, error: deleteError } = await guardedQuery
    .is("partner_record_id", null)
    .is("intermediary_id", null)
    .is("registration_record_id", null)
    .is("completed_at", null)
    .is("partner_activated_at", null)
    .select("id");
  if (deleteError) return { status: "error", message: "Deletion was blocked by linked records or a database safety constraint. No successful deletion was confirmed." };
  if (deleted?.length !== 1) return { status: "error", message: "The application changed while being reviewed. Refresh and select the exact pending record again." };

  revalidatePath("/intermediaries/partner");
  revalidatePath("/intermediaries/applications");
  revalidatePath("/intermediaries");
  return { status: "success", message: "The pending onboarding application and its application-owned draft data were deleted." };
}

export async function permanentDeleteEntity(
  kind: PermanentDeleteKind,
  id: string,
  relatedId?: string,
): Promise<PermanentDeleteResult> {
  try {
    const actor = await requireItSuperUser();
    if (!id) return { status: "error", message: "The record identifier is missing." };
    if (kind === "user") return deleteUser(id, actor.id);
    if (kind === "branch") return deleteBranch(id);
    if (kind === "partner") return deletePartner(id, relatedId);
    if (kind === "onboarding_application") return deletePendingPartnerApplication(id);
    return { status: "error", message: "Unsupported permanent-delete request." };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Permanent deletion could not be completed." };
  }
}
