import { getWorkspaceSessionBoundary } from "../../../../lib/control-plane/session";
import { resolveDeveloperIdentity } from "../../../../lib/control-plane/developer-auth";

export const dynamic = "force-dynamic";

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : null;
}

export async function GET(request: Request) {
  const boundary = getWorkspaceSessionBoundary();
  const identity = await resolveDeveloperIdentity(bearerToken(request));

  return Response.json({
    ...identity,
    infrastructureProtection: boundary.infrastructureProtection,
    globalWriteActionsEnabled: boundary.writeActionsEnabled,
    canCreatePreviewDraft: identity.draftWriteEligible,
    canMutateConfiguration: false
  }, {
    headers: { "Cache-Control": "private, no-store" }
  });
}
