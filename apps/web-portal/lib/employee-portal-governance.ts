import "server-only";

import type { AppRole } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type EmployeePortalOperation = "invite" | "suspend" | "restore";

type GovernanceGuardInput = {
  operation: EmployeePortalOperation;
  actorProfileId: string;
  actorRole: AppRole;
  targetProfileId?: string | null;
  targetRole?: AppRole | null;
  activeTargetRoleCount?: number;
  assigningRole?: AppRole | null;
  targetHasExistingProfile?: boolean;
};

export type GovernanceGuardResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Pure guard for high-risk employee portal lifecycle operations.
 * This is exported so the security invariants can be regression-tested without
 * touching Supabase Auth or production data.
 */
export function evaluateEmployeePortalGovernanceGuard(input: GovernanceGuardInput): GovernanceGuardResult {
  if ((input.operation === "suspend" || input.operation === "restore") && !input.targetProfileId) {
    return { allowed: true };
  }

  if (input.operation === "suspend" && input.targetProfileId === input.actorProfileId) {
    return { allowed: false, reason: "You cannot suspend your own portal access." };
  }

  if (input.operation === "suspend" && (input.targetRole === "super_admin" || input.targetRole === "it_super_user")) {
    if ((input.activeTargetRoleCount ?? 0) <= 1) {
      const label = input.targetRole === "super_admin" ? "Super Admin" : "IT Super User";
      return { allowed: false, reason: `The final active ${label} account cannot be suspended.` };
    }
  }

  if (input.operation === "invite" && input.assigningRole === "it_super_user" && !input.targetHasExistingProfile) {
    return { allowed: false, reason: "IT Super User is a protected technical role and cannot be assigned through normal user management." };
  }

  if (input.operation === "invite" && input.assigningRole === "super_admin") {
    if (input.actorRole !== "super_admin" && input.actorRole !== "it_super_user") {
      return { allowed: false, reason: "Only a Super Admin or IT Super User can assign Super Admin access." };
    }
  }

  return { allowed: true };
}

type PortalEmployeeRecord = {
  id: string;
  employee_code: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  department: string | null;
  designation: string | null;
  employment_status: string | null;
};

type PortalProfileRecord = {
  id: string;
  role: AppRole;
  is_active: boolean | null;
};

async function writeLifecycleAudit(input: {
  actorProfileId: string;
  employeeId: string;
  action: string;
  oldData: Record<string, unknown>;
  newData: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_id: input.actorProfileId,
    action: input.action,
    table_name: "employees",
    record_id: input.employeeId,
    old_data: input.oldData,
    new_data: input.newData,
  });
  if (error) {
    console.error("Employee portal lifecycle audit write failed", error.message);
  }
}

async function loadEmployeePortalContext(employeeId: string) {
  const admin = createSupabaseAdminClient();
  const [{ data: employee, error: employeeError }, { data: profile, error: profileError }] = await Promise.all([
    admin
      .from("employees")
      .select("id,employee_code,full_name,phone,email,department,designation,employment_status")
      .eq("id", employeeId)
      .single(),
    admin
      .from("profiles")
      .select("id,role,is_active")
      .eq("employee_id", employeeId)
      .maybeSingle(),
  ]);

  if (employeeError || !employee) throw new Error("Employee could not be found.");
  if (profileError) throw new Error("Portal access details could not be checked.");

  return {
    employee: employee as PortalEmployeeRecord,
    profile: profile as PortalProfileRecord | null,
  };
}

async function activeRoleCount(role: AppRole) {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", role)
    .eq("is_active", true);
  if (error) throw new Error("Protected-role availability could not be verified.");
  return count ?? 0;
}

export async function governedSetEmployeePortalStatus(input: {
  actorProfileId: string;
  actorRole: AppRole;
  employeeId: string;
  nextStatus: "active" | "inactive";
}) {
  const admin = createSupabaseAdminClient();
  const { employee, profile } = await loadEmployeePortalContext(input.employeeId);
  const operation: EmployeePortalOperation = input.nextStatus === "active" ? "restore" : "suspend";
  const roleCount = profile && (profile.role === "super_admin" || profile.role === "it_super_user")
    ? await activeRoleCount(profile.role)
    : undefined;

  const guard = evaluateEmployeePortalGovernanceGuard({
    operation,
    actorProfileId: input.actorProfileId,
    actorRole: input.actorRole,
    targetProfileId: profile?.id,
    targetRole: profile?.role,
    activeTargetRoleCount: roleCount,
  });
  if (!guard.allowed) throw new Error(guard.reason);

  const wasEmployeeActive = employee.employment_status === "active";
  const wasProfileActive = profile?.is_active ?? null;

  // Employee-only records remain valid without a portal identity.
  if (!profile) {
    const { error } = await admin
      .from("employees")
      .update({ employment_status: input.nextStatus, updated_by: input.actorProfileId })
      .eq("id", employee.id);
    if (error) throw new Error("The employee status could not be changed. Please try again.");

    await writeLifecycleAudit({
      actorProfileId: input.actorProfileId,
      employeeId: employee.id,
      action: input.nextStatus === "active" ? "employee_reactivated" : "employee_deactivated",
      oldData: { employment_status: employee.employment_status, portal_profile: null },
      newData: { employment_status: input.nextStatus, portal_profile: null },
    });
    return { employee, profile: null };
  }

  if (input.nextStatus === "inactive") {
    // Suspend Auth first: if a later synchronization step fails, the safer
    // failure mode is a locked account rather than an active credential.
    const { error: authError } = await admin.auth.admin.updateUserById(profile.id, { ban_duration: "876000h" });
    if (authError) throw new Error("Portal authentication could not be suspended. No employee status was changed.");

    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({ is_active: false, updated_by: input.actorProfileId })
      .eq("id", profile.id);
    if (profileUpdateError) {
      throw new Error("Authentication was suspended, but the portal profile could not be synchronized. Contact IT before restoring access.");
    }

    const { error: employeeUpdateError } = await admin
      .from("employees")
      .update({ employment_status: "inactive", updated_by: input.actorProfileId })
      .eq("id", employee.id);
    if (employeeUpdateError) {
      throw new Error("Portal access was suspended, but the employee directory status could not be synchronized. Contact IT before restoring access.");
    }
  } else {
    // Restore database state first. Auth remains banned until every internal
    // state is active, so a partial restore cannot accidentally grant login.
    const { error: employeeUpdateError } = await admin
      .from("employees")
      .update({ employment_status: "active", updated_by: input.actorProfileId })
      .eq("id", employee.id);
    if (employeeUpdateError) throw new Error("The employee could not be reactivated. Please try again.");

    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({ is_active: true, updated_by: input.actorProfileId })
      .eq("id", profile.id);
    if (profileUpdateError) {
      await admin.from("employees").update({ employment_status: wasEmployeeActive ? "active" : "inactive", updated_by: input.actorProfileId }).eq("id", employee.id);
      throw new Error("The employee was not restored because the portal profile could not be synchronized.");
    }

    const { error: authError } = await admin.auth.admin.updateUserById(profile.id, { ban_duration: "none" });
    if (authError) {
      await admin.from("profiles").update({ is_active: wasProfileActive === true, updated_by: input.actorProfileId }).eq("id", profile.id);
      await admin.from("employees").update({ employment_status: wasEmployeeActive ? "active" : "inactive", updated_by: input.actorProfileId }).eq("id", employee.id);
      throw new Error("The employee was not restored because portal authentication could not be re-enabled.");
    }
  }

  await writeLifecycleAudit({
    actorProfileId: input.actorProfileId,
    employeeId: employee.id,
    action: input.nextStatus === "active" ? "employee_portal_restored" : "employee_portal_suspended",
    oldData: {
      employment_status: employee.employment_status,
      profile_active: wasProfileActive,
      role: profile.role,
    },
    newData: {
      employment_status: input.nextStatus,
      profile_active: input.nextStatus === "active",
      auth_suspended: input.nextStatus !== "active",
      role: profile.role,
    },
  });

  return { employee, profile };
}

export async function governedInviteEmployeePortalUser(input: {
  actorProfileId: string;
  actorRole: AppRole;
  employeeId: string;
  requestedRole: AppRole | null;
  redirectTo: string;
}) {
  const admin = createSupabaseAdminClient();
  const { employee, profile } = await loadEmployeePortalContext(input.employeeId);
  if (employee.employment_status !== "active") throw new Error("Reactivate this employee before sending portal access.");
  if (!employee.email) throw new Error("Add a work email to this employee before sending portal access.");

  const portalRole = profile?.role ?? input.requestedRole;
  if (!portalRole || portalRole === "customer" || portalRole === "intermediary") {
    throw new Error("Select a valid staff portal role before sending the invitation.");
  }

  const guard = evaluateEmployeePortalGovernanceGuard({
    operation: "invite",
    actorProfileId: input.actorProfileId,
    actorRole: input.actorRole,
    targetProfileId: profile?.id,
    targetRole: profile?.role,
    assigningRole: portalRole,
    targetHasExistingProfile: Boolean(profile),
  });
  if (!guard.allowed) throw new Error(guard.reason);

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(employee.email, {
    redirectTo: input.redirectTo,
    data: {
      full_name: employee.full_name,
      phone: employee.phone,
      app_role: portalRole,
      employee_id: employee.id,
    },
  });
  if (inviteError || !invited.user) throw new Error(inviteError?.message ?? "Could not send portal invitation.");

  const { error: profileError } = await admin.from("profiles").upsert({
    id: invited.user.id,
    role: portalRole,
    full_name: employee.full_name,
    phone: employee.phone,
    email: employee.email,
    employee_code: employee.employee_code,
    department: employee.department,
    designation: employee.designation,
    employee_id: employee.id,
    is_active: true,
    created_by: input.actorProfileId,
    updated_by: input.actorProfileId,
  }, { onConflict: "id" });
  if (profileError) {
    throw new Error("The invitation was sent, but the portal profile could not be synchronized. Please contact the IT administrator before the user signs in.");
  }

  await writeLifecycleAudit({
    actorProfileId: input.actorProfileId,
    employeeId: employee.id,
    action: profile ? "employee_portal_reinvited" : "employee_portal_invited",
    oldData: { profile_id: profile?.id ?? null, role: profile?.role ?? null },
    newData: { profile_id: invited.user.id, role: portalRole, email: employee.email },
  });

  return { employee, profile, invitedUserId: invited.user.id, role: portalRole };
}
