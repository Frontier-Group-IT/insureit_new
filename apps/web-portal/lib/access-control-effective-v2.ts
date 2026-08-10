import type { AccessLevel, DataScope, PermissionKeyV2 } from "@/lib/access-control-catalogue-v2";
import type { EmployeeRoleCodeV2, RoleDefinitionV2 } from "@/lib/access-control-role-matrix-v2";

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
 * 3. active employee override => explicit deny or direct grant
 * 4. active role grants => strongest access level, union of scopes at that level
 * 5. no grant => deny
 *
 * The function is intentionally pure and receives the role matrix as data. It is
 * not connected to production authorization, RLS, navigation or server actions.
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
    .filter((role): role is RoleDefinitionV2 => Boolean(role?.isActive ?? true));

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

  const matchingOverrides = (input.overrides ?? []).filter(
    (override) => override.permission === input.permission && overrideIsCurrent(override, now),
  );
  const directOverride = matchingOverrides.at(-1);
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

  const roleGrants = activeRoles
    .map((role) => ({ role, grant: role.grants.find((grant) => grant.permission === input.permission) }))
    .filter((entry): entry is { role: RoleDefinitionV2; grant: NonNullable<(typeof entry)["grant"]> } => Boolean(entry.grant));

  if (!roleGrants.length) {
    return noAccess(input.permission, "no_grant", "No active role grants this permission.", activeRoles.map((role) => role.code));
  }

  const strongestRank = Math.max(...roleGrants.map(({ grant }) => accessRank[grant.access]));
  const strongest = roleGrants.filter(({ grant }) => accessRank[grant.access] === strongestRank);
  const access = strongest[0]?.grant.access ?? "none";
  if (access === "none") {
    return noAccess(input.permission, "no_grant", "Active roles do not grant this permission.", activeRoles.map((role) => role.code));
  }

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
