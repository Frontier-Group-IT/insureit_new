import { getWorkspaceSessionBoundary } from "../../../../lib/control-plane/session";
import { ACTION_CONTRACTS, WRITE_ACTIONS_ENABLED, NATIVE_BUILDS_ENABLED } from "../../../../lib/control-plane/contracts";
import { CONFIGURATION_CANDIDATES, CONFIGURATION_READINESS } from "../../../../lib/control-plane/configuration";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    mode: "read-only-contract-preview",
    writeActionsEnabled: WRITE_ACTIONS_ENABLED,
    nativeBuildsEnabled: NATIVE_BUILDS_ENABLED,
    sessionBoundary: getWorkspaceSessionBoundary(),
    readiness: CONFIGURATION_READINESS,
    candidates: CONFIGURATION_CANDIDATES,
    actionContracts: ACTION_CONTRACTS
  }, { headers: { "Cache-Control": "private, no-store" } });
}
