"use server";

import { hasEffectiveCapability, hasAnyEffectiveCapability } from "@/lib/effective-permissions";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAppRole, type Capability } from "@/lib/roles";
import { permissionDefinitions, type EmployeePermissionAccess, type PermissionScope } from "@/lib/permission-management";

const editableRoles = new Set(["it_super_user", "super_admin"]);
const allowedAccess = new Set<EmployeePermissionAccess>(["inherit", "none", "view", "edit", "approve"]);
const allowedScope = new Set<PermissionScope>(["inherit", "self", "hierarchy", "organization"]);

async function requirePermissionAdministrator() {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id || !(await hasEffectiveCapability(profile, "manage_system", "approve"))) redirect("/access-denied");
  return profile;
}

function safeReturnPath(value: string) {
  return value.startsWith("/system/access-control") ? value : "/system/access-control";
}

function redirectWithMessage(returnTo: string, key: "success" | "error", message: string): never {
  const safePath = safeReturnPath(returnTo);
  const [pathname, query = ""] = safePath.split("?", 2);
  const params = new URLSearchParams(query);
  params.delete("success");
  params.delete("error");
  params.set(key, message);
  redirect(`${pathname}?${params.toString()}`);
}

export async function saveEmployeePermissionOverride(formData: FormData) {
  const actor = await requirePermissionAdministrator();
  const profileId = String(formData.get("profile_id") ?? "");
  const capability = String(formData.get("capability") ?? "") as Capability;
  const access = String(formData.get("access_level") ?? "inherit") as EmployeePermissionAccess;
  const scope = String(formData.get("scope_type") ?? "inherit") as PermissionScope;
  const reason = String(formData.get("reason") ?? "").trim();
  const expiresAt = String(formData.get("expires_at") ?? "").trim() || null;
  const returnTo = safeReturnPath(String(formData.get("return_to") ?? "/system/access-control"));

  if (!profileId || !permissionDefinitions.some((item) => item.capability === capability)) redirectWithMessage(returnTo, "error", "Invalid permission selection");
  if (!allowedAccess.has(access) || !allowedScope.has(scope)) redirectWithMessage(returnTo, "error", "Invalid access configuration");
  if (!reason || reason.length < 5) redirectWithMessage(returnTo, "error", "Please enter a clear reason for the change");
  if (profileId === actor.id && (capability === "manage_users" || capability === "manage_system") && access === "none") redirectWithMessage(returnTo, "error", "You cannot remove your own critical administration access");

  const admin = createSupabaseAdminClient();
  const { data: target, error: targetError } = await admin.from("profiles").select("id,role,is_active").eq("id", profileId).maybeSingle();
  if (targetError || !target?.id || !target.is_active || !isAppRole(target.role)) redirectWithMessage(returnTo, "error", "The selected active portal user could not be found");

  const { data: existing, error: existingError } = await admin
    .from("employee_permission_overrides")
    .select("access_level,scope_type")
    .eq("profile_id", profileId)
    .eq("capability", capability)
    .maybeSingle();
  if (existingError) redirectWithMessage(returnTo, "error", "Current access settings could not be loaded. Please try again.");

  if (access === "inherit" && scope === "inherit") {
    const { error: deleteError } = await admin
      .from("employee_permission_overrides")
      .delete()
      .eq("profile_id", profileId)
      .eq("capability", capability);
    if (deleteError) redirectWithMessage(returnTo, "error", "The custom permission could not be removed. Please try again.");
  } else {
    const { data: saved, error: saveError } = await admin
      .from("employee_permission_overrides")
      .upsert({
        profile_id: profileId,
        capability,
        access_level: access,
        scope_type: scope,
        reason,
        expires_at: expiresAt,
        created_by: actor.id,
        updated_by: actor.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "profile_id,capability" })
      .select("profile_id,capability,access_level,scope_type")
      .single();

    if (saveError) redirectWithMessage(returnTo, "error", "The permission change could not be saved. Please try again.");
    if (!saved || saved.access_level !== access || saved.scope_type !== scope) {
      redirectWithMessage(returnTo, "error", "The permission could not be verified after saving. Please try again.");
    }
  }

  const { error: auditError } = await admin.from("permission_change_logs").insert({
    changed_by_profile_id: actor.id,
    target_profile_id: profileId,
    target_role: target.role,
    capability,
    previous_access: existing?.access_level ?? "inherit",
    new_access: access,
    previous_scope: existing?.scope_type ?? "inherit",
    new_scope: scope,
    change_type: access === "inherit" && scope === "inherit" ? "employee_reset" : "employee_override",
    reason,
  });
  if (auditError) redirectWithMessage(returnTo, "error", "The permission was saved, but its audit record could not be completed. Please contact the system administrator before making another change.");

  revalidatePath("/system/access-control");
  revalidatePath(`/system/access-control/employees/${profileId}`);
  redirectWithMessage(returnTo, "success", "Permission updated");
}

export async function resetEmployeePermissionOverrides(formData: FormData) {
  const actor = await requirePermissionAdministrator();
  const profileId = String(formData.get("profile_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const returnTo = `/system/access-control/employees/${profileId}`;
  if (!profileId || reason.length < 5) redirectWithMessage(returnTo, "error", "Please enter a clear reset reason");

  const admin = createSupabaseAdminClient();
  const { data: rows, error: rowsError } = await admin
    .from("employee_permission_overrides")
    .select("capability,access_level,scope_type")
    .eq("profile_id", profileId);
  if (rowsError) redirectWithMessage(returnTo, "error", "Current custom permissions could not be loaded. Please try again.");

  if (rows?.length) {
    const { error: auditError } = await admin.from("permission_change_logs").insert(rows.map((row) => ({
      changed_by_profile_id: actor.id,
      target_profile_id: profileId,
      capability: row.capability,
      previous_access: row.access_level,
      new_access: "inherit",
      previous_scope: row.scope_type,
      new_scope: "inherit",
      change_type: "employee_reset",
      reason,
    })));
    if (auditError) redirectWithMessage(returnTo, "error", "The reset could not be recorded in the access audit. No further access changes should be made until this is reviewed.");
  }

  const { error: deleteError } = await admin.from("employee_permission_overrides").delete().eq("profile_id", profileId);
  if (deleteError) redirectWithMessage(returnTo, "error", "Custom permissions could not be reset. Please try again.");

  revalidatePath("/system/access-control");
  revalidatePath(returnTo);
  redirectWithMessage(returnTo, "success", "Custom permissions reset");
}