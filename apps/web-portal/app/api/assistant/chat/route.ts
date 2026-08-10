import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accessTokenCookie } from "@/lib/auth-config";
import { getAuthenticatedProfile } from "@/lib/auth";
import { accessRank, getEffectivePermissionAccessMap } from "@/lib/effective-permissions";
import { permissionDefinitions } from "@/lib/permission-management";
import { isAppRole, type Capability } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createMetadataOnlyAssistantAuditWriter } from "@/lib/assistant/audit";
import { acquireDistributedAssistantLease } from "@/lib/assistant/limits";
import { createPermissionAwareNavigationResolver } from "@/lib/assistant/navigation";
import { runAssistant } from "@/lib/assistant/orchestrator";
import { ASSISTANT_LIMITS, isInternalEmployeeRole, validateAssistantRequest, validateRequestEnvelope } from "@/lib/assistant/policy";
import { createPostgresKnowledgeRepository } from "@/lib/assistant/postgres-knowledge";
import { AssistantProviderError, createConfiguredAssistantProvider } from "@/lib/assistant/provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RESPONSE_HEADERS = { "Cache-Control": "no-store", Pragma: "no-cache" } as const;
const ASSISTANT_CAPABILITY = "use_assistant" as const;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: RESPONSE_HEADERS });
}

async function readBoundedJson(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; status: 400 | 413; code: string }> {
  if (!request.body) return { ok: false, status: 400, code: "invalid_body" };
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > ASSISTANT_LIMITS.maxBodyBytes) {
        await reader.cancel();
        return { ok: false, status: 413, code: "body_too_large" };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, code: "invalid_body" };
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const envelope = validateRequestEnvelope(request);
  if (!envelope.ok) return json({ error: envelope.code }, envelope.status);

  const token = (await cookies()).get(accessTokenCookie)?.value;
  const authenticated = await getAuthenticatedProfile(token);
  const profile = authenticated.profile;
  if (!authenticated.user || !profile || authenticated.user.id !== profile.id) {
    return json({ error: "authentication_required" }, 401);
  }
  const role = profile.role;
  if (!profile.is_active || !isAppRole(role) || !isInternalEmployeeRole(role)) {
    return json({ error: "assistant_forbidden" }, 403);
  }

  const admin = createSupabaseAdminClient();
  const audit = createMetadataOnlyAssistantAuditWriter(admin);
  const permissionAccess = await getEffectivePermissionAccessMap(profile);
  const canCapability = (capability: Capability) => {
    const minimum = permissionDefinitions.find((definition) => definition.capability === capability)?.roleAccess ?? "view";
    return accessRank[permissionAccess[capability] ?? "none"] >= accessRank[minimum];
  };
  if (!canCapability(ASSISTANT_CAPABILITY)) {
    try {
      await audit.write({ actorProfileId: profile.id, capability: ASSISTANT_CAPABILITY, eventType: "request", allowed: false, rowCount: 0, latencyMs: 0, errorCode: "capability_denied" });
    } catch { /* A failed audit write must not turn a denial into access. */ }
    return json({ error: "assistant_forbidden" }, 403);
  }

  const parsed = await readBoundedJson(request);
  if (!parsed.ok) return json({ error: parsed.code }, parsed.status);
  const validated = validateAssistantRequest(parsed.value);
  if (!validated.ok) return json({ error: validated.code }, 400);

  let lease;
  try {
    lease = await acquireDistributedAssistantLease(admin, profile.id);
  } catch {
    return json({ error: "assistant_unavailable" }, 503);
  }
  if (!lease.ok) {
    return NextResponse.json(
      { error: lease.reason === "rate" ? "rate_limited" : "request_in_progress" },
      { status: 429, headers: { ...RESPONSE_HEADERS, "Retry-After": lease.reason === "rate" ? "60" : "2" } },
    );
  }

  try {
    const allowedKnowledgeCapabilities = permissionDefinitions.map((definition) => definition.capability).filter(canCapability);
    const result = await runAssistant({
      actor: { profileId: profile.id, role },
      ...validated.value,
      provider: createConfiguredAssistantProvider(),
      knowledgeRepository: createPostgresKnowledgeRepository(admin, allowedKnowledgeCapabilities),
      navigationResolver: createPermissionAwareNavigationResolver(permissionAccess, { role, intermediaryOnly: false }),
      can: async (capability) => canCapability(capability),
      audit,
    });
    return json(result);
  } catch (error) {
    if (error instanceof AssistantProviderError) {
      return json({ error: error.code }, error.code === "provider_timeout" ? 504 : 503);
    }
    return json({ error: "assistant_unavailable" }, 503);
  } finally {
    try { await lease.release(); } catch { /* An expired database lease fails closed until its short TTL elapses. */ }
  }
}
