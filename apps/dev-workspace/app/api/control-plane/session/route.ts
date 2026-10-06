import { getWorkspaceSessionBoundary } from "../../../../lib/control-plane/session";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getWorkspaceSessionBoundary(), {
    headers: { "Cache-Control": "private, no-store" }
  });
}
