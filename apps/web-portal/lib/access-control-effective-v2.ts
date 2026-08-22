import type { AccessLevel, DataScope, PermissionKeyV2 } from "@/lib/access-control-catalogue-v2";
import type { EmployeeRoleCodeV2, RoleDefinitionV2, RoleGrantV2 } from "@/lib/access-control-role-matrix-v2";

export type V2RoleAssignment = {
  roleCode: EmployeeRoleCodeV2;
  isActive: boolean;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  isPrimary?: boolean;
};

export type V2EmployeePermissionOverride = {
  permission: PermissionKeyV2;
  access: AccessLevel;
  scope?: DataScope | null;
  isActive: boolean;
  expiresAt?: string | Date | null;
  reason?: string | null;
};

export type EffectiveAccessSourceV2 =
  | "inactive_identity"
  | "protected_role"
  | "employee_override"
  | "employee_deny"
  | "role_grant"
  | "no_grant";

export type EffectivePermissionDecisionV2 = {
  permission: PermissionKeyV2;
  allowed: boolean;
  access: AccessLevel;
  scopes: readonly DataScope[];
  source: EffectiveAccessSourceV2;
  contributingRoles: readonly EmployeeRoleCodeV2[];
  reason: string;
};

export type ResolveEffectivePermissionV2Input = {
  permission: PermissionKeyV2;
  employeeActive: boolean;
  portalIdentityActive: boolean;
  assignments: readonly V2RoleAssignment[];
  overrides?: readonly V2EmployeePermissionOverride[];
  now?: Date;
};

const accessRank: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  approve: 3,
};

const backofficePermissionCeiling: Partial<Record<PermissionKeyV2, Exclude<AccessLevel, "none">>> = {
  "dashboard.view": "view",
  "customers.view": "view",
  "customers.create": "edit",
  "vehicles.view": "view",
  "vehicles.create": "edit",
  "policies.view": "view",
  "policies.create": "edit",
  "reports.view": "view",
  "notifications.view": "view",
};

function asDate(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function assignmentIsCurrent(assignment: V2RoleAssignment, now: Date) {
  if (!assignment.isActive) return false;
  const startsAt = asDate(assignment.startsAt);
  const endsAt = asDate(assignment.endsAt);
  if (startsAt && startsAt.getTime() > now.getTime()) return false;
  if (endsAt && endsAt.getTime() <= now.getTime()) return false;
  return true;
}

function overrideIsCurrent(override: V2EmployeePermissionOverride, now: Date) {
  if (!override.isActive) return false;
  const expiresAt = asDate(override.expiresAt);
  return !expiresAt || expiresAt.getTime() > now.getTime();
}

function dedupeScopes(scopes: readonly (DataScope | undefined)[]) {
  return Array.from(new Set(scopes.filter((scope): scope is DataScope => Boolean(scope))));
}

function noAccess(
  permission: PermissionKeyV2,
  source: EffectiveAccessSourceV2,
  reason: string,
  contributingRoles: readonly EmployeeRoleCodeV2[] = [],
): EffectivePermissionDecisionV2 {
  return {
    permission,
    allowed: false,
    access: "none",
    scopes: [],
    source,
    contributingRoles,
    reason,
  };
}

/**
 * Shadow-only V2 effective-access resolver.
 *
 * Precedence:
 * 1. inactive employee or portal identity => deny
 * 2. protected IT Super User grant => protected grant, ordinary overrides ignored
 * 3. Backoffice Executive safety ceiling => create/view operational data only
 * 4. active employee override => explicit deny or direct grant
 * 5. active role grants => strongest access level, union of scopes at that level
 * 6. no grant => deny
 */
export function resolveEffectivePermissionV2(
  input: ResolveEffectivePermissionV2Input,
  roleMatrix: readonly RoleDefinitionV2[],
): EffectivePermissionDecisionV2 {
  const now = input.now ?? new Date();

  if (!input.employeeActive) {
    return noAccess(input.permission, "inactive_identity", "Employee record is inactive.");
  }
  if (!input.portalIdentityActive) {
    return noAccess(input.permission, "inactive_identity", "Portal identity is inactive.");
  }

  const roleByCode = new Map(roleMatrix.map((role) => [role.code, role]));
  const activeAssignments = input.assignments.filter((assignment) => assignmentIsCurrent(assignment, now));
  const activeRoles = activeAssignments
    .map((assignment) => roleByCode.get(assignment.roleCode))
    .filter((role): role is RoleDefinitionV2 => Boolean(role));

  const protectedItRole = activeRoles.find((role) => role.code === "it_super_user" && role.status === "protected");
  if (protectedItRole) {
    const protectedGrant = protectedItRole.grants.find((grant) => grant.permission === input.permission);
    if (protectedGrant) {
      return {
        permission: input.permission,
        allowed: true,
        access: protectedGrant.access,
        scopes: dedupeScopes([protectedGrant.scope]),
        source: "protected_role",
        contributingRoles: ["it_super_user"],
        reason: "Protected IT Super User access cannot be downgraded by an ordinary employee override.",
      };
    }
  }

  const backofficeOnly = activeRoles.length > 0 && activeRoles.every((role) => role.code === "backoffice_executive");
  const matchingOverrides = (input.overrides ?? []).filter(
    (override) => override.permission === input.permission && overrideIsCurrent(override, now),
  );
  const directOverride = matchingOverrides.at(-1);

  if (backofficeOnly) {
    const ceiling = backofficePermissionCeiling[input.permission];
    if (!ceiling) {
      return noAccess(
        input.permission,
        "no_grant",
        "Backoffice Executive is restricted to operational create/view permissions.",
        ["backoffice_executive"],
      );
    }
    if (directOverride?.access === "none") {
      return noAccess(
        input.permission,
        "employee_deny",
        directOverride.reason?.trim() || "An active employee-specific deny overrides the Backoffice baseline.",
        ["backoffice_executive"],
      );
    }
    if (directOverride) {
      const cappedAccess = accessRank[directOverride.access] > accessRank[ceiling] ? ceiling : directOverride.access;
      return {
        permission: input.permission,
        allowed: true,
        access: cappedAccess,
        scopes: dedupeScopes([directOverride.scope ?? "organization"]),
        source: "employee_override",
        contributingRoles: [],
        reason: "Employee override is capped by the Backoffice Executive safety ceiling.",
      };
    }
    return {
      permission: input.permission,
      allowed: true,
      access: ceiling,
      scopes: input.permission === "notifications.view" ? ["self"] : ["organization"],
      source: "role_grant",
      contributingRoles: ["backoffice_executive"],
      reason: "Granted by the Backoffice Executive operational data-entry baseline.",
    };
  }

  if (directOverride) {
    if (directOverride.access === "none") {
      return noAccess(
        input.permission,
        "employee_deny",
        directOverride.reason?.trim() || "An active employee-specific deny overrides inherited role grants.",
        activeRoles.map((role) => role.code),
      );
    }
    return {
      permission: input.permission,
      allowed: true,
      access: directOverride.access,
      scopes: dedupeScopes([directOverride.scope ?? undefined]),
      source: "employee_override",
      contributingRoles: [],
      reason: directOverride.reason?.trim() || "Active employee-specific override takes precedence over role defaults.",
    };
  }

  const roleGrants: Array<{ role: RoleDefinitionV2; grant: RoleGrantV2 }> = [];
  for (const role of activeRoles) {
    const roleGrant = role.grants.find((grant) => grant.permission === input.permission);
    if (roleGrant) roleGrants.push({ role, grant: roleGrant });
  }

  if (!roleGrants.length) {
    return noAccess(input.permission, "no_grant", "No active role grants this permission.", activeRoles.map((role) => role.code));
  }

  const strongestRank = Math.max(...roleGrants.map(({ grant }) => accessRank[grant.access]));
  const strongest = roleGrants.filter(({ grant }) => accessRank[grant.access] === strongestRank);
  const access = strongest[0].grant.access;

  return {
    permission: input.permission,
    allowed: true,
    access,
    scopes: dedupeScopes(strongest.map(({ grant }) => grant.scope)),
    source: "role_grant",
    contributingRoles: strongest.map(({ role }) => role.code),
    reason: strongest.length === 1
      ? `Granted by ${strongest[0].role.label}.`
      : `Granted by ${strongest.map(({ role }) => role.label).join(", ")}.`,
  };
}
