/**
 * Phase 2 contracts only. This module authorizes no production writes.
 * All proposed mutations require an authenticated Action Gateway in a later phase.
 */
export const WRITE_ACTIONS_ENABLED = false as const;
export const DRAFT_REGISTRY_WRITES_ENABLED = true as const;
export const NATIVE_BUILDS_ENABLED = false as const;

export type RiskLevel = "green" | "blue" | "amber" | "red" | "black";
export type ActionKind =
  | "config.draft"
  | "config.rollback_preview"
  | "config.publish"
  | "config.rollback"
  | "assets.replace"
  | "feature.rollout"
  | "github.merge_pr"
  | "release.publish_ota"
  | "database.apply_migration"
  | "database.delete_data"
  | "secrets.rotate";

export type ActionContract = Readonly<{
  kind: ActionKind;
  risk: RiskLevel;
  capability: string;
  requiresReauthentication: boolean;
  requiresSecondApproval: boolean;
  requiresVerifiedChecks: boolean;
  auditRequired: true;
  rollbackPlanRequired: true;
}>;

export const ACTION_CONTRACTS: readonly ActionContract[] = [
  { kind: "config.draft", risk: "green", capability: "config:draft", requiresReauthentication: true, requiresSecondApproval: false, requiresVerifiedChecks: false, auditRequired: true, rollbackPlanRequired: true },
  { kind: "config.rollback_preview", risk: "green", capability: "config:rollback-preview", requiresReauthentication: true, requiresSecondApproval: false, requiresVerifiedChecks: false, auditRequired: true, rollbackPlanRequired: true },
  { kind: "config.publish", risk: "green", capability: "config:publish", requiresReauthentication: false, requiresSecondApproval: false, requiresVerifiedChecks: false, auditRequired: true, rollbackPlanRequired: true },
  { kind: "config.rollback", risk: "green", capability: "config:rollback", requiresReauthentication: false, requiresSecondApproval: false, requiresVerifiedChecks: false, auditRequired: true, rollbackPlanRequired: true },
  { kind: "assets.replace", risk: "green", capability: "assets:publish", requiresReauthentication: false, requiresSecondApproval: false, requiresVerifiedChecks: false, auditRequired: true, rollbackPlanRequired: true },
  { kind: "feature.rollout", risk: "blue", capability: "features:publish", requiresReauthentication: false, requiresSecondApproval: false, requiresVerifiedChecks: false, auditRequired: true, rollbackPlanRequired: true },
  { kind: "github.merge_pr", risk: "amber", capability: "code:merge", requiresReauthentication: false, requiresSecondApproval: false, requiresVerifiedChecks: true, auditRequired: true, rollbackPlanRequired: true },
  { kind: "release.publish_ota", risk: "blue", capability: "release:publish", requiresReauthentication: false, requiresSecondApproval: false, requiresVerifiedChecks: true, auditRequired: true, rollbackPlanRequired: true },
  { kind: "database.apply_migration", risk: "red", capability: "database:migrate", requiresReauthentication: true, requiresSecondApproval: false, requiresVerifiedChecks: true, auditRequired: true, rollbackPlanRequired: true },
  { kind: "database.delete_data", risk: "black", capability: "database:destroy", requiresReauthentication: true, requiresSecondApproval: true, requiresVerifiedChecks: true, auditRequired: true, rollbackPlanRequired: true },
  { kind: "secrets.rotate", risk: "black", capability: "secrets:rotate", requiresReauthentication: true, requiresSecondApproval: true, requiresVerifiedChecks: true, auditRequired: true, rollbackPlanRequired: true }
] as const;

/** Deny-by-default policy: absence of a gateway is never implicitly approval. */
export function evaluateActionContract(kind: ActionKind): { allowed: false; reason: string; contract: ActionContract } {
  const contract = ACTION_CONTRACTS.find(item => item.kind === kind);
  if (!contract) throw new Error("Unknown action kind");
  return {
    allowed: false,
    reason: "The authenticated Action Gateway, audit ledger, approval checks and rollback engine are not enabled.",
    contract
  };
}


export function evaluateDraftAction(input: {
  kind: "config.draft" | "config.rollback_preview";
  authorized: boolean;
  assuranceLevel: "aal1" | "aal2" | "unknown";
  capabilities: readonly string[];
}) {
  const contract = ACTION_CONTRACTS.find(item => item.kind === input.kind);
  if (!contract) throw new Error("Unknown draft action kind");

  if (!DRAFT_REGISTRY_WRITES_ENABLED) {
    return { allowed: false as const, reason: "Draft registry writes are disabled.", contract };
  }
  if (!input.authorized) {
    return { allowed: false as const, reason: "An active protected IT Super User identity is required.", contract };
  }
  if (input.assuranceLevel !== "aal2") {
    return { allowed: false as const, reason: "MFA/AAL2 is required before saving a configuration draft.", contract };
  }
  if (!input.capabilities.includes(contract.capability)) {
    return { allowed: false as const, reason: "The current session does not have the required draft capability.", contract };
  }

  return {
    allowed: true as const,
    reason: "Allowed for append-only preview registry only. This cannot publish to a production consumer.",
    contract
  };
}
