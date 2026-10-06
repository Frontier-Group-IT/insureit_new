export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    service: "insureit-developer-workspace",
    mode: "guarded-preview-registry",
    status: "healthy",
    write_actions_enabled: false,
    draft_registry_writes_enabled: true,
    draft_registry_requires_aal2: true,
    production_publish_enabled: false,
    apk_build_enabled: false
  });
}
