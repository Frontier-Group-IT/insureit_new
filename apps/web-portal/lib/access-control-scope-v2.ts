import { permissionCatalogueV2ByKey, type DataScope, type PermissionKeyV2 } from "@/lib/access-control-catalogue-v2";
import type { EffectivePermissionDecisionV2 } from "@/lib/access-control-effective-v2";

export type ScopeTargetV2 = {
  principalEmployeeIds?: readonly string[];
  assigneeEmployeeIds?: readonly string[];
  branchId?: string | null;
  zoneId?: string | null;
  departmentId?: string | null;
  verticalId?: string | null;
  locationId?: string | null;
};

export type ScopeActorContextV2 = {
  actorEmployeeId: string;
  teamEmployeeIds?: readonly string[];
  hierarchyEmployeeIds?: readonly string[];
  branchId?: string | null;
  zoneId?: string | null;
  departmentId?: string | null;
  verticalId?: string | null;
  selectedLocationIds?: readonly string[];
  selectedEmployeeIds?: readonly string[];
};

export type ScopedAccessDecisionV2 = {
  permission: PermissionKeyV2;
  allowed: boolean;
  matchedScope: DataScope | null;
  evaluatedScopes: readonly DataScope[];
  reason: string;
};

function normalized(values: readonly string[] | undefined) {
  return new Set((values ?? []).filter(Boolean));
}

function targetPrincipals(target: ScopeTargetV2) {
  return normalized(target.principalEmployeeIds);
}

function intersects(left: Set<string>, right: Set<string>) {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function equalsKnown(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left === right);
}

/**
 * Pure shadow-only scope predicate. Callers supply all actor and target facts;
 * this module performs no database lookup and is not wired to production RLS.
 */
export function scopeAllowsTargetV2(
  scope: DataScope,
  actor: ScopeActorContextV2,
  target: ScopeTargetV2,
) {
  const principals = targetPrincipals(target);
  const assignees = normalized(target.assigneeEmployeeIds);

  switch (scope) {
    case "organization":
      return true;
    case "self":
      return principals.has(actor.actorEmployeeId);
    case "assigned":
      return assignees.has(actor.actorEmployeeId);
    case "team": {
      const team = normalized([actor.actorEmployeeId, ...(actor.teamEmployeeIds ?? [])]);
      return intersects(principals, team) || intersects(assignees, team);
    }
    case "hierarchy": {
      const hierarchy = normalized([actor.actorEmployeeId, ...(actor.hierarchyEmployeeIds ?? [])]);
      return intersects(principals, hierarchy) || intersects(assignees, hierarchy);
    }
    case "branch":
      return equalsKnown(actor.branchId, target.branchId);
    case "zone":
      return equalsKnown(actor.zoneId, target.zoneId);
    case "department":
      return equalsKnown(actor.departmentId, target.departmentId);
    case "vertical":
      return equalsKnown(actor.verticalId, target.verticalId);
    case "selected_locations":
      return Boolean(target.locationId && normalized(actor.selectedLocationIds).has(target.locationId));
    case "selected_employees": {
      const selected = normalized(actor.selectedEmployeeIds);
      return intersects(principals, selected) || intersects(assignees, selected);
    }
  }
}

/**
 * Applies an effective permission decision to one target record. Permissions
 * that do not require record scope remain governed only by the permission
 * decision itself; scoped permissions require at least one granted scope to
 * match the target.
 */
export function evaluateScopedAccessV2(
  decision: EffectivePermissionDecisionV2,
  actor: ScopeActorContextV2,
  target: ScopeTargetV2,
): ScopedAccessDecisionV2 {
  if (!decision.allowed) {
    return {
      permission: decision.permission,
      allowed: false,
      matchedScope: null,
      evaluatedScopes: decision.scopes,
      reason: decision.reason,
    };
  }

  const definition = permissionCatalogueV2ByKey.get(decision.permission);
  if (!definition) {
    return {
      permission: decision.permission,
      allowed: false,
      matchedScope: null,
      evaluatedScopes: decision.scopes,
      reason: "Permission is not present in the V2 catalogue.",
    };
  }

  if (!definition.scopeRequired) {
    return {
      permission: decision.permission,
      allowed: true,
      matchedScope: null,
      evaluatedScopes: decision.scopes,
      reason: "Permission does not require record-level scope evaluation.",
    };
  }

  for (const scope of decision.scopes) {
    if (scopeAllowsTargetV2(scope, actor, target)) {
      return {
        permission: decision.permission,
        allowed: true,
        matchedScope: scope,
        evaluatedScopes: decision.scopes,
        reason: `Target is inside the granted ${scope} scope.`,
      };
    }
  }

  return {
    permission: decision.permission,
    allowed: false,
    matchedScope: null,
    evaluatedScopes: decision.scopes,
    reason: decision.scopes.length
      ? "Target is outside every granted data scope."
      : "Scoped permission has no effective data scope.",
  };
}
