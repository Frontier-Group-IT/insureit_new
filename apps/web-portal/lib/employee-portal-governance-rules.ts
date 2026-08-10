import type { AppRole } from "@/lib/roles";

export type EmployeePortalOperation = "invite" | "suspend" | "restore";

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
