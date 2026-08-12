import type { AssistantAuditEvent, AssistantUsageAuditWriter } from "./orchestrator.ts";

type AuditInsertResult = { error: { message?: string } | null };
type AuditClient = {
  from(table: "assistant_usage_events"): {
    insert(row: {
      request_id: string;
      actor_profile_id: string;
      capability: "use_assistant";
      decision: "allowed" | "denied" | "error";
      tool_name: string | null;
      route: string | null;
      row_count: number;
      latency_ms: number;
      error_code: string | null;
    }): PromiseLike<AuditInsertResult>;
  };
};

/** Writes operational metadata only. Prompts, tool queries, results, and answers are not accepted by this interface. */
export function createMetadataOnlyAssistantAuditWriter(client: AuditClient): AssistantUsageAuditWriter {
  return {
    async write(event: AssistantAuditEvent) {
      const { error } = await client.from("assistant_usage_events").insert({
        request_id: event.requestId,
        actor_profile_id: event.actorProfileId,
        capability: event.capability,
        decision: event.decision,
        tool_name: event.toolName ?? null,
        route: event.route ?? null,
        row_count: Math.max(0, Math.trunc(event.rowCount)),
        latency_ms: Math.max(0, Math.trunc(event.latencyMs)),
        error_code: event.errorCode ?? null,
      });
      if (error) throw new Error("assistant_audit_unavailable");
    },
  };
}
