export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    service: "insureit-developer-workspace",
    mode: "read-only-foundation",
    status: "healthy",
    write_actions_enabled: false,
    apk_build_enabled: false
  });
}
