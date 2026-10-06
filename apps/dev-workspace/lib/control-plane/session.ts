import { WRITE_ACTIONS_ENABLED } from "./contracts";

export type WorkspaceSessionBoundary = Readonly<{
  infrastructureProtection: "vercel-authentication";
  appIdentity: "not-configured";
  authenticatedPrincipal: null;
  capabilities: readonly string[];
  writeActionsEnabled: false;
  canMutateConfiguration: false;
  reason: string;
}>;

export function getWorkspaceSessionBoundary(): WorkspaceSessionBoundary {
  return {
    infrastructureProtection: "vercel-authentication",
    appIdentity: "not-configured",
    authenticatedPrincipal: null,
    capabilities: [],
    writeActionsEnabled: WRITE_ACTIONS_ENABLED,
    canMutateConfiguration: false,
    reason: "Vercel Authentication protects the deployment, but app-level developer identity, MFA and capability grants are not implemented yet."
  };
}
