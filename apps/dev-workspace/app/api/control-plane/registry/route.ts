import { createDeveloperSupabaseClient, resolveDeveloperIdentity } from "../../../../lib/control-plane/developer-auth";
import { evaluateDraftAction } from "../../../../lib/control-plane/contracts";

export const dynamic = "force-dynamic";

const FIRST_CONFIG_KEY = "tech.site.hero_subtitle";

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : null;
}

async function requireDeveloper(request: Request) {
  const token = bearerToken(request);
  const identity = await resolveDeveloperIdentity(token);
  return { token, identity };
}

export async function GET(request: Request) {
  const { token, identity } = await requireDeveloper(request);
  if (!token || !identity.authorized) {
    return Response.json({ error: identity.reason }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = createDeveloperSupabaseClient(token);
  const [{ data: registry, error: registryError }, { data: revisions, error: revisionsError }, { data: audit, error: auditError }] = await Promise.all([
    supabase
      .from("developer_config_registry")
      .select("key,app,section,label,value_type,description,validation,preview_enabled,consumer_status")
      .order("key"),
    supabase
      .from("developer_config_revisions")
      .select("id,config_key,revision,value,state,change_note,source_revision_id,created_by,created_at")
      .eq("config_key", FIRST_CONFIG_KEY)
      .order("revision", { ascending: false })
      .limit(20),
    supabase
      .from("developer_config_audit")
      .select("id,actor_id,action,config_key,revision_id,details,created_at")
      .eq("config_key", FIRST_CONFIG_KEY)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (registryError || revisionsError || auditError) {
    return Response.json({
      error: registryError?.message ?? revisionsError?.message ?? auditError?.message ?? "Registry read failed."
    }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }

  return Response.json({
    mode: "preview-only",
    firstConfigKey: FIRST_CONFIG_KEY,
    identity: {
      fullName: identity.fullName,
      email: identity.email,
      assuranceLevel: identity.assuranceLevel,
      capabilities: identity.capabilities,
      draftWriteEligible: identity.draftWriteEligible
    },
    registry: registry ?? [],
    revisions: revisions ?? [],
    audit: audit ?? [],
    publishEnabled: false,
    productionConsumerConnected: false
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const { token, identity } = await requireDeveloper(request);
  if (!token || !identity.authorized) {
    return Response.json({ error: identity.reason }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }

  let body: {
    action?: "draft" | "rollback_preview";
    configKey?: string;
    value?: unknown;
    changeNote?: string;
    sourceRevisionId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.configKey !== FIRST_CONFIG_KEY) {
    return Response.json({ error: "Only the first controlled configuration key is enabled for preview drafts." }, { status: 403 });
  }

  const action = body.action === "rollback_preview" ? "config.rollback_preview" : "config.draft";
  const decision = evaluateDraftAction({
    kind: action,
    authorized: identity.authorized,
    assuranceLevel: identity.assuranceLevel,
    capabilities: identity.capabilities
  });

  if (!decision.allowed) {
    return Response.json({ error: decision.reason }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }

  if (action === "config.draft") {
    if (typeof body.value !== "string") {
      return Response.json({ error: "Hero subtitle must be text." }, { status: 400 });
    }
    const value = body.value.trim();
    if (!value || value.length > 240) {
      return Response.json({ error: "Hero subtitle must contain 1–240 characters." }, { status: 400 });
    }
    if ((body.changeNote ?? "").length > 300) {
      return Response.json({ error: "Change note must be at most 300 characters." }, { status: 400 });
    }

    const supabase = createDeveloperSupabaseClient(token);
    const { data, error } = await supabase
      .from("developer_config_revisions")
      .insert({
        config_key: FIRST_CONFIG_KEY,
        revision: 0,
        value,
        state: "draft",
        change_note: body.changeNote?.trim() || null,
        created_by: identity.userId
      })
      .select("id,config_key,revision,value,state,change_note,source_revision_id,created_at")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true, revision: data, productionChanged: false }, { status: 201 });
  }

  if (!body.sourceRevisionId) {
    return Response.json({ error: "A source revision is required for rollback preview." }, { status: 400 });
  }

  const supabase = createDeveloperSupabaseClient(token);
  const { data, error } = await supabase
    .from("developer_config_revisions")
    .insert({
      config_key: FIRST_CONFIG_KEY,
      revision: 0,
      value: "",
      state: "rollback_draft",
      change_note: body.changeNote?.trim() || "Rollback preview",
      source_revision_id: body.sourceRevisionId,
      created_by: identity.userId
    })
    .select("id,config_key,revision,value,state,change_note,source_revision_id,created_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true, revision: data, productionChanged: false }, { status: 201 });
}
