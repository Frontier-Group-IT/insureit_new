import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { indiaDate, policyDateDecision } from "@/lib/policy-date-rule";

type Admin = ReturnType<typeof createSupabaseAdminClient>;
type Request = {
  requesterId: string;
  issuanceDate: string;
  policyNumber: string;
  operation: "create" | "edit";
  existingPolicyId?: string | null;
  originalIssuanceDate?: string | null;
  approvalId?: string | null;
};
type Result = { ok: true; approverName: string | null; previousMonth: boolean } | { ok: false; error: string };

export async function consumePolicyDateApproval(admin: Admin, input: Request): Promise<Result> {
  const decision = policyDateDecision(input.issuanceDate);
  if (decision === "invalid" || decision === "future") {
    return { ok: false, error: "Choose a valid issuance date within the current or an earlier month." };
  }
  const changed = input.originalIssuanceDate !== input.issuanceDate;
  const previousMonth = changed && decision === "otp_required" || (
    changed && input.issuanceDate.slice(0, 7) < indiaDate().slice(0, 7)
  );
  if (!changed || decision === "allowed") return { ok: true, approverName: null, previousMonth };
  if (!input.approvalId || !/^[0-9a-f-]{36}$/i.test(input.approvalId)) {
    return { ok: false, error: "Please verify an approver's email OTP before saving this earlier-month policy." };
  }
  const { data: record, error } = await admin.from("policy_date_otp_approvals")
    .select("id,requester_id,issuance_date,policy_number,operation,existing_policy_id,verified_at,consumed_at,approver_name")
    .eq("id", input.approvalId).eq("requester_id", input.requesterId).maybeSingle();
  if (error || !record || !record.verified_at || record.consumed_at ||
      Date.now() - new Date(record.verified_at).getTime() > 15 * 60_000 ||
      record.issuance_date !== input.issuanceDate ||
      record.policy_number !== input.policyNumber.trim().toUpperCase() ||
      record.operation !== input.operation ||
      (record.existing_policy_id ?? null) !== (input.existingPolicyId ?? null)) {
    return { ok: false, error: "The approval is expired or does not match this policy. Request and verify a new OTP." };
  }
  const { data: claimed, error: claimError } = await admin.from("policy_date_otp_approvals")
    .update({ consumed_at: new Date().toISOString() }).eq("id", record.id)
    .is("consumed_at", null).eq("verified_at", record.verified_at)
    .select("id").maybeSingle();
  if (claimError || !claimed) return { ok: false, error: "This approval has already been used. Request a new OTP." };
  return { ok: true, approverName: record.approver_name, previousMonth: true };
}

export async function recordPreviousMonthPolicyUpload(
  admin: Admin, policyId: string, requesterId: string,
  issuanceDate: string, approverName: string | null,
) {
  const { error } = await admin.from("audit_logs").insert({
    actor_id: requesterId,
    table_name: "policies",
    record_id: policyId,
    action: "previous_month_policy_uploaded",
    new_data: { issuance_date: issuanceDate, approved_by: approverName },
  });
  if (error) console.error("policy_date_activity_failed", { code: error.code });
}
