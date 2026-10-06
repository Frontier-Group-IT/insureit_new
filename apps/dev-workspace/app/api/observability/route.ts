import { getObservabilitySnapshot } from "../../../lib/observability";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getObservabilitySnapshot();
  return Response.json(snapshot, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0"
    }
  });
}
