import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accessTokenCookie } from "@/lib/auth-config";
import { getAuthenticatedProfile } from "@/lib/auth";
import {
  getEffectivePermissionAccessMapForRoleFresh,
  getEffectivePermissionFresh,
  permissionDefinitions,
  type PermissionAccess,
} from "@/lib/permission-management";
import { isAppRole, type Capability } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createMetadataOnlyAssistantAuditWriter } from "@/lib/assistant/audit";
import { acquireDistributedAssistantLease } from "@/lib/assistant/limits";
import { createPermissionAwareNavigationResolver } from "@/lib/assistant/navigation";
import { runAssistant, type AssistantUsageAuditWriter } from "@/lib/assistant/orchestrator";
import { ASSISTANT_LIMITS, isInternalEmployeeRole, validateAssistantRequest, validateRequestEnvelope } from "@/lib/assistant/policy";
import { createPostgresKnowledgeRepository } from "@/lib/assistant/postgres-knowledge";
import { createOperationalSummaryRepository } from "@/lib/assistant/operational";
import { AssistantProviderError, createConfiguredAssistantProvider } from "@/lib/assistant/provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 45;

const RESPONSE_HEADERS = { "Cache-Control": "no-store", Pragma: "no-cache" } as const;
const ASSISTANT_CAPABILITY = "use_assistant" as const;
const ACCESS_RANK: Record<PermissionAccess, number> = { none: 0, view: 1, edit: 2, approve: 3 };

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

async function auditAuthenticatedRequest(audit: AssistantUsageAuditWriter, input: {
  requestId: string;
  actorProfileId: string;
  decision: "denied" | "error";
  errorCode: string;
  route?: string;
  startedAt: number;
}) {
  await audit.write({
    requestId: input.requestId,
    actorProfileId: input.actorProfileId,
    capability: ASSISTANT_CAPABILITY,
    eventType: "request",
    allowed: false,
    decision: input.decision,
    rowCount: 0,
    latencyMs: Date.now() - input.startedAt,
    errorCode: input.errorCode,
    route: input.route,
  });
}

export async function POST(request: Request) {
  const token = (await cookies()).get(accessTokenCookie)?.value;
  const authenticated = await getAuthenticatedProfile(token);
  const profile = authenticated.profile;
  if (!authenticated.user || !profile || authenticated.user.id !== profile.id) {
    return json({ error: "authentication_required" }, 401);
  }

  const requestId = randomUUID();
  const startedAt = Date.now();
  const admin = createSupabaseAdminClient();
  const audit = createMetadataOnlyAssistantAuditWriter(admin);
  const auditedResponse = async (decision: "denied" | "error", errorCode: string, response: NextResponse, route?: string) => {
    try {
      await auditAuthenticatedRequest(audit, { requestId, actorProfileId: profile.id, decision, errorCode, route, startedAt });
      return response;
    } catch {
      return json({ error: "assistant_unavailable" }, 503);
    }
  };

  const envelope = validateRequestEnvelope(request);
  if (!envelope.ok) return auditedResponse("denied", envelope.code, json({ error: envelope.code }, envelope.status));

  const role = profile.role;
  if (!profile.is_active || !isAppRole(role) || !isInternalEmployeeRole(role)) {
    return auditedResponse("denied", "role_denied", json({ error: "assistant_forbidden" }, 403));
  }

  const resolveCurrentAuthorization = async () => {
    const { data: currentProfile, error } = await admin.from("profiles").select("id,role,is_active").eq("id", profile.id).maybeSingle();
    if (error || !currentProfile || !currentProfile.is_active || !isAppRole(currentProfile.role) || !isInternalEmployeeRole(currentProfile.role)) {
      throw new Error("assistant_authorization_revoked");
    }
    return {
      role: currentProfile.role,
      permissionAccess: await getEffectivePermissionAccessMapForRoleFresh(currentProfile.id, currentProfile.role),
    };
  };
  const resolvePermissionAccess = async () => (await resolveCurrentAuthorization()).permissionAccess;
  const canCapability = async (capability: Capability, minimumAccess?: Exclude<PermissionAccess, "none">) => {
    const { data: currentProfile, error } = await admin.from("profiles").select("id,role,is_active").eq("id", profile.id).maybeSingle();
    if (error || !currentProfile || !currentProfile.is_active || !isAppRole(currentProfile.role) || !isInternalEmployeeRole(currentProfile.role)) {
      throw new Error("assistant_authorization_revoked");
    }
    const result = await getEffectivePermissionFresh(currentProfile.id, currentProfile.role, capability);
    const required = minimumAccess ?? permissionDefinitions.find((definition) => definition.capability === capability)?.roleAccess ?? "view";
    return ACCESS_RANK[result.access] >= ACCESS_RANK[required];
  };

  try {
    if (!(await canCapability(ASSISTANT_CAPABILITY))) {
      return auditedResponse("denied", "capability_denied", json({ error: "assistant_forbidden" }, 403));
    }
  } catch {
    return auditedResponse("error", "permission_lookup_failed", json({ error: "assistant_unavailable" }, 503));
  }

  const parsed = await readBoundedJson(request);
  if (!parsed.ok) return auditedResponse("denied", parsed.code, json({ error: parsed.code }, parsed.status));
  const validated = validateAssistantRequest(parsed.value);
  if (!validated.ok) return auditedResponse("denied", validated.code, json({ error: validated.code }, 400));

  let provider;
  try {
    provider = createConfiguredAssistantProvider();
  } catch {
    return auditedResponse("error", "provider_configuration_failed", json({ error: "assistant_unavailable" }, 503), validated.value.currentPath);
  }

  let lease;
  try {
    lease = await acquireDistributedAssistantLease(admin, profile.id);
  } catch {
    return auditedResponse("error", "lease_unavailable", json({ error: "assistant_unavailable" }, 503), validated.value.currentPath);
  }
  if (!lease.ok) {
    const code = lease.reason === "rate" ? "rate_limited" : "request_in_progress";
    return auditedResponse(
      "denied",
      code,
      NextResponse.json(
        { error: code },
        { status: 429, headers: { ...RESPONSE_HEADERS, "Retry-After": lease.reason === "rate" ? "60" : "2" } },
      ),
      validated.value.currentPath,
    );
  }

  try {
    const result = await runAssistant({
      requestId,
      actor: { profileId: profile.id, role },
      ...validated.value,
      provider,
      knowledgeRepository: createPostgresKnowledgeRepository(admin, resolvePermissionAccess),
      operationalRepository: createOperationalSummaryRepository({ admin, profileId: profile.id, role, can: canCapability }),
      navigationResolver: {
        async search(query, actor) {
          const authorization = await resolveCurrentAuthorization();
          return createPermissionAwareNavigationResolver(authorization.permissionAccess, { role: authorization.role, intermediaryOnly: false }).search(query, actor);
        },
      },
      can: canCapability,
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
