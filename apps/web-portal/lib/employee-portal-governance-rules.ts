import type { AppRole } from "@/lib/roles";

export type EmployeePortalOperation = "invite" | "suspend" | "restore" | "change_role";

export type EmployeePortalGovernanceGuardInput = {
  operation: EmployeePortalOperation;
  actorProfileId: string;
  actorRole: AppRole;
  targetProfileId?: string | null;
  targetRole?: AppRole | null;
  activeTargetRoleCount?: number;
  assigningRole?: AppRole | null;
  targetHasExistingProfile?: boolean;
};

export type EmployeePortalGovernanceGuardResult =
  | { allowed: true }
  | { allowed: false; reason: string };

const portalManagerRoles: readonly AppRole[] = ["super_admin", "admin", "it_super_user"];

/** Pure security rules for employee portal lifecycle operations. */
export function evaluateEmployeePortalGovernanceGuard(
  input: EmployeePortalGovernanceGuardInput,
): EmployeePortalGovernanceGuardResult {
  // The original primary IT account is the only authority for IT identity lifecycle actions.
  const primaryItId = "dd3a036f-2cca-4a1e-b639-21fc1cc807ef";
  if (input.assigningRole === "it_super_user") {
    return { allowed: false, reason: "IT Super User is a protected sole-owner role and cannot be assigned through the portal." };
  }
  if (input.targetProfileId === primaryItId && (input.operation === "suspend" || input.operation === "change_role")) {
    return { allowed: false, reason: "The primary IT Super User account is protected from portal role and status changes." };
  }
  if ((input.targetRole === "it_user" || input.targetRole === "it_super_user" || input.assigningRole === "it_user") && input.actorProfileId !== primaryItId) {
    return { allowed: false, reason: "Only the primary IT Super User can manage IT administrator identities." };
  }

  if ((input.operation === "suspend" || input.operation === "restore") && !input.targetProfileId) {
    return { allowed: true };
  }

  if (
    (input.operation === "suspend" || input.operation === "restore")
    && input.targetProfileId
    && !portalManagerRoles.includes(input.actorRole)
  ) {
    return { allowed: false, reason: "You do not have permission to manage employee portal access." };
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

  if (input.operation === "invite" && !portalManagerRoles.includes(input.actorRole)) {
    return { allowed: false, reason: "You do not have permission to manage employee portal access." };
  }

  if (input.operation === "change_role" && !portalManagerRoles.includes(input.actorRole)) {
    return { allowed: false, reason: "You do not have permission to manage employee portal access." };
  }

  if (input.operation === "change_role" && input.assigningRole === "super_admin") {
    if (input.actorRole !== "super_admin" && input.actorRole !== "it_super_user") {
      return { allowed: false, reason: "Only a Super Admin or IT Super User can assign Super Admin access." };
    }
  }

  if (
    input.operation === "change_role"
    && input.targetRole
    && input.assigningRole
    && input.assigningRole !== input.targetRole
    && (input.targetRole === "super_admin" || input.targetRole === "it_super_user")
    && (input.activeTargetRoleCount ?? 0) <= 1
  ) {
    const label = input.targetRole === "super_admin" ? "Super Admin" : "IT Super User";
    return { allowed: false, reason: `The final active ${label} account cannot be moved to another role.` };
  }

  if (input.operation === "invite" && input.assigningRole === "super_admin") {
    if (input.actorRole !== "super_admin" && input.actorRole !== "it_super_user") {
      return { allowed: false, reason: "Only a Super Admin or IT Super User can assign Super Admin access." };
    }
  }

  return { allowed: true };
}
