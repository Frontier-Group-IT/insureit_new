import "server-only";

import type { AppRole } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  evaluateEmployeePortalGovernanceGuard,
  type EmployeePortalOperation,
} from "@/lib/employee-portal-governance-rules";

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

type RecoverableInviteProfile = {
  id: string;
  role: AppRole;
  email: string | null;
  employee_id: string | null;
};

function normalizedEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

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

async function findRecoverableAccountsInvite(employee: PortalEmployeeRecord, requestedRole: AppRole | null) {
  if (requestedRole !== "accounts" || !employee.email) return null;

  const admin = createSupabaseAdminClient();
  const { data: candidates, error } = await admin
    .from("profiles")
    .select("id,role,email,employee_id")
    .eq("email", employee.email)
    .is("employee_id", null)
    .in("role", ["customer", "accounts"])
    .limit(2)
    .returns<RecoverableInviteProfile[]>();

  if (error) throw new Error("Existing portal invitation could not be checked.");
  if (!candidates?.length) return null;
  if (candidates.length > 1) throw new Error("Multiple unlinked portal identities exist for this email. Please contact the IT administrator.");

  const candidate = candidates[0];
  const { data: authResult, error: authError } = await admin.auth.admin.getUserById(candidate.id);
  if (authError || !authResult.user) throw new Error("Existing portal invitation could not be verified.");

  const authUser = authResult.user;
  const requestedMetadataRole = typeof authUser.user_metadata?.app_role === "string"
    ? authUser.user_metadata.app_role
    : null;
  const appMetadataRole = typeof authUser.app_metadata?.app_role === "string"
    ? authUser.app_metadata.app_role
    : null;
  const emailMatches = normalizedEmail(authUser.email) === normalizedEmail(employee.email);
  const roleMatches = requestedMetadataRole === "accounts" || appMetadataRole === "accounts";

  if (!emailMatches || !roleMatches) return null;
  return { profile: candidate, user: authUser };
}

async function synchronizePortalIdentity(input: {
  employee: PortalEmployeeRecord;
  actorProfileId: string;
  portalRole: AppRole;
  user: {
    id: string;
    app_metadata?: Record<string, unknown>;
  };
  deleteUserOnFailure: boolean;
}) {
  const admin = createSupabaseAdminClient();
  const nextAppMetadata = {
    ...(input.user.app_metadata ?? {}),
    app_role: input.portalRole,
    employee_id: input.employee.id,
  };

  const { error: authMetadataError } = await admin.auth.admin.updateUserById(input.user.id, {
    app_metadata: nextAppMetadata,
  });
  if (authMetadataError) {
    if (input.deleteUserOnFailure) await admin.auth.admin.deleteUser(input.user.id);
    throw new Error("The portal invitation could not be finalized because authentication role metadata could not be synchronized. Please try again.");
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: input.user.id,
    role: input.portalRole,
    full_name: input.employee.full_name,
    phone: input.employee.phone,
    email: input.employee.email,
    employee_code: input.employee.employee_code,
    department: input.employee.department,
    designation: input.employee.designation,
    employee_id: input.employee.id,
    is_active: true,
    created_by: input.actorProfileId,
    updated_by: input.actorProfileId,
  }, { onConflict: "id" });
  if (profileError) {
    if (input.deleteUserOnFailure) await admin.auth.admin.deleteUser(input.user.id);
    throw new Error("The invitation was sent, but the portal profile could not be synchronized. Please contact the IT administrator before the user signs in.");
  }
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

  const recoverableInvite = profile ? null : await findRecoverableAccountsInvite(employee, input.requestedRole);
  let invitedUser = recoverableInvite?.user ?? null;
  let deleteUserOnFailure = false;

  if (!invitedUser) {
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
    invitedUser = invited.user;
    deleteUserOnFailure = true;
  }

  await synchronizePortalIdentity({
    employee,
    actorProfileId: input.actorProfileId,
    portalRole,
    user: invitedUser,
    deleteUserOnFailure,
  });

  await writeLifecycleAudit({
    actorProfileId: input.actorProfileId,
    employeeId: employee.id,
    action: recoverableInvite
      ? "employee_portal_invite_recovered"
      : profile
        ? "employee_portal_reinvited"
        : "employee_portal_invited",
    oldData: {
      profile_id: recoverableInvite?.profile.id ?? profile?.id ?? null,
      role: recoverableInvite?.profile.role ?? profile?.role ?? null,
    },
    newData: { profile_id: invitedUser.id, role: portalRole, email: employee.email },
  });

  return {
    employee,
    profile,
    invitedUserId: invitedUser.id,
    role: portalRole,
    recovered: Boolean(recoverableInvite),
  };
}
