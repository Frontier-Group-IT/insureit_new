"use server";

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
  if (!profile?.id || !editableRoles.has(profile.role ?? "")) redirect("/access-denied");
  return profile;
}

export async function saveEmployeePermissionOverride(formData: FormData) {
  const actor = await requirePermissionAdministrator();
  const profileId = String(formData.get("profile_id") ?? "");
  const capability = String(formData.get("capability") ?? "") as Capability;
  const access = String(formData.get("access_level") ?? "inherit") as EmployeePermissionAccess;
  const scope = String(formData.get("scope_type") ?? "inherit") as PermissionScope;
  const reason = String(formData.get("reason") ?? "").trim();
  const expiresAt = String(formData.get("expires_at") ?? "").trim() || null;
  const returnTo = String(formData.get("return_to") ?? "/system/access-control");

  if (!profileId || !permissionDefinitions.some((item) => item.capability === capability)) redirect(`${returnTo}?error=${encodeURIComponent("Invalid permission selection")}`);
  if (!allowedAccess.has(access) || !allowedScope.has(scope)) redirect(`${returnTo}?error=${encodeURIComponent("Invalid access configuration")}`);
  if (!reason || reason.length < 5) redirect(`${returnTo}?error=${encodeURIComponent("Please enter a clear reason for the change")}`);
  if (profileId === actor.id && (capability === "manage_users" || capability === "manage_system") && access === "none") redirect(`${returnTo}?error=${encodeURIComponent("You cannot remove your own critical administration access")}`);

  const admin = createSupabaseAdminClient();
  const { data: target } = await admin.from("profiles").select("id,role,is_active").eq("id", profileId).maybeSingle();
  if (!target?.id || !target.is_active || !isAppRole(target.role)) redirect(`${returnTo}?error=${encodeURIComponent("The selected active portal user could not be found")}`);

  const { data: existing } = await admin.from("employee_permission_overrides").select("access_level,scope_type").eq("profile_id", profileId).eq("capability", capability).maybeSingle();

  if (access === "inherit" && scope === "inherit") {
    await admin.from("employee_permission_overrides").delete().eq("profile_id", profileId).eq("capability", capability);
  } else {
    const { error } = await admin.from("employee_permission_overrides").upsert({
      profile_id: profileId,
      capability,
      access_level: access,
      scope_type: scope,
      reason,
      expires_at: expiresAt,
      created_by: actor.id,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "profile_id,capability" });
    if (error) redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);
  }

  await admin.from("permission_change_logs").insert({
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

  revalidatePath("/system/access-control");
  revalidatePath(`/system/access-control/employees/${profileId}`);
  redirect(`${returnTo}?success=${encodeURIComponent("Permission updated")}`);
}

export async function resetEmployeePermissionOverrides(formData: FormData) {
  const actor = await requirePermissionAdministrator();
  const profileId = String(formData.get("profile_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!profileId || reason.length < 5) redirect(`/system/access-control/employees/${profileId}?error=${encodeURIComponent("Please enter a clear reset reason")}`);

  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin.from("employee_permission_overrides").select("capability,access_level,scope_type").eq("profile_id", profileId);
  if (rows?.length) {
    await admin.from("permission_change_logs").insert(rows.map((row) => ({
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
  }
  await admin.from("employee_permission_overrides").delete().eq("profile_id", profileId);
  revalidatePath("/system/access-control");
  revalidatePath(`/system/access-control/employees/${profileId}`);
  redirect(`/system/access-control/employees/${profileId}?success=${encodeURIComponent("Custom permissions reset")}`);
}
