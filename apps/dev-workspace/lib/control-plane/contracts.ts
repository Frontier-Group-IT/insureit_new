/**
 * Phase 2 contracts only. This module authorizes no production writes.
 * All proposed mutations require an authenticated Action Gateway in a later phase.
 */
export const WRITE_ACTIONS_ENABLED = false as const;
export const NATIVE_BUILDS_ENABLED = false as const;

export type RiskLevel = "green" | "blue" | "amber" | "red" | "black";
export type ActionKind =
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
