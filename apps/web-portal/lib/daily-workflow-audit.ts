import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase-admin";

// Additive, privacy-safe events for successful user actions only.
// Do not store free-text remarks, rejection reasons, OCR contents or customer details.
// Audit failures must never roll back or prevent the underlying business operation.
const ALLOWED = {
  policy_intake_requests: new Set([
    "policy_intake_review_started",
    "policy_intake_attention_requested",
    "policy_intake_rejected",
    "policy_intake_response_uploaded",
  ]),
  life_health_cases: new Set([
    "life_health_case_edited",
    "life_health_case_remark_added",
    "life_health_case_rejected",
  ]),
} as const;

type Admin = ReturnType<typeof createSupabaseAdminClient>;
type Table = keyof typeof ALLOWED;

export async function recordDailyWorkflowActivity(
  admin: Admin,
  entry: { actorId: string; table: Table; recordId: string; action: string },
): Promise<void> {
  if (!entry.actorId || !entry.recordId || !ALLOWED[entry.table].has(entry.action as never)) {
    console.error("[daily-activity] Refused invalid audit event", { table: entry.table, action: entry.action });
    return;
  }

  try {
    const { error } = await admin.from("audit_logs").insert({
      actor_id: entry.actorId,
      action: entry.action,
      table_name: entry.table,
      record_id: entry.recordId,
    });
    if (error) {
      // Exclude IDs and untrusted text from logs; no PII or operational error details.
      console.error("[daily-activity] Audit insert failed", { table: entry.table, action: entry.action, code: error.code });
    }
  } catch {
    console.error("[daily-activity] Audit service unavailable", { table: entry.table, action: entry.action });
  }
}
