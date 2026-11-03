"use server";

import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { requirePolicyCreator, requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { policyDateDecision, POLICY_DATE_APPROVERS } from "@/lib/policy-date-rule";

type ApprovalInput = {
  issuanceDate: string;
  policyNumber: string;
  approverKey: string;
  operation: "create" | "edit";
  existingPolicyId?: string | null;
  intermediaryCode?: string;
};
type ApprovalResponse = { ok: true; approvalId: string; expiresAt: string } | { ok: false; error: string };
const TABLE = "policy_date_otp_approvals";

function otpHash(approvalId: string, otp: string) {
  const secret = process.env.POLICY_DATE_OTP_SECRET;
  if (!secret || secret.length < 32) throw new Error("OTP secret not configured");
  return createHmac("sha256", secret).update(approvalId + ":" + otp).digest("hex");
}

async function profileFor(input: Pick<ApprovalInput, "operation" | "existingPolicyId" | "intermediaryCode">) {
  if (input.operation === "edit") {
    if (!input.existingPolicyId || !/^[0-9a-f-]{36}$/i.test(input.existingPolicyId)) return null;
    return requirePolicyEditor(input.existingPolicyId);
  }
  return requirePolicyCreator(input.intermediaryCode);
}

export async function requestPolicyDateApproval(input: ApprovalInput): Promise<ApprovalResponse> {
  try {
    const profile = await profileFor(input);
    if (!profile) return { ok: false, error: "Choose a valid policy before requesting approval." };
    if (policyDateDecision(input.issuanceDate) !== "otp_required") {
      return { ok: false, error: "This policy date does not need an OTP approval." };
    }
    const approver = POLICY_DATE_APPROVERS.find(value => value.key === input.approverKey);
    const policyNumber = input.policyNumber.trim().toUpperCase();
    if (!approver || !policyNumber || policyNumber.length > 120) return { ok: false, error: "Select an approver and enter a valid policy number." };
    const emailKey = process.env.RESEND_API_KEY;
    const from = process.env.POLICY_DATE_OTP_FROM;
    if (!emailKey || !from || !process.env.POLICY_DATE_OTP_SECRET) {
      return { ok: false, error: "Email approval is not available yet. Contact your administrator." };
    }
    const admin = createSupabaseAdminClient();
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count, error: countError } = await admin.from(TABLE)
      .select("id", { count: "exact", head: true }).eq("requester_id", profile.id).gte("created_at", since);
    if (countError) return { ok: false, error: "Couldn't check approval availability. Please try again." };
    if ((count ?? 0) >= 8) return { ok: false, error: "Too many approval requests. Please try again later." };
    const { data: recent, error: recentError } = await admin.from(TABLE).select("created_at")
      .eq("requester_id", profile.id).order("created_at", { ascending: false }).limit(1).maybeSingle<{ created_at: string }>();
    if (recentError) return { ok: false, error: "Couldn't check approval availability. Please try again." };
    if (recent && Date.now() - new Date(recent.created_at).getTime() < 60_000) {
      return { ok: false, error: "Please wait one minute before requesting another OTP." };
    }

    const approvalId = randomUUID();
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const { error: insertError } = await admin.from(TABLE).insert({
      id: approvalId, requester_id: profile.id, approver_key: approver.key,
      approver_name: approver.name, approver_email: approver.email,
      issuance_date: input.issuanceDate, policy_number: policyNumber,
      operation: input.operation, existing_policy_id: input.operation === "edit" ? input.existingPolicyId : null,
      code_hash: otpHash(approvalId, code), expires_at: expiresAt,
    });
    if (insertError) return { ok: false, error: "Couldn't start email approval. Please try again." };
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + emailKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [approver.email], subject: "INSUREIT - Policy date approval code",
        text: "An INSUREIT user has requested approval to save policy " + policyNumber +
          " dated " + input.issuanceDate + ".\n\nYour verification code is " + code +
          ".\n\nIt expires in 5 minutes. Only share it if you approve this request. If you did not expect this request, do not share the code.",
      }),
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) {
      await admin.from(TABLE).delete().eq("id", approvalId).eq("requester_id", profile.id);
      return { ok: false, error: "We couldn't send the email. Please try again or choose another approver." };
    }
    const { error: markError } = await admin.from(TABLE).update({ delivered_at: new Date().toISOString() }).eq("id", approvalId);
    if (markError) return { ok: false, error: "The email was sent, but we couldn't confirm the request. Please request a new OTP." };
    return { ok: true, approvalId, expiresAt };
  } catch {
    return { ok: false, error: "Unable to request approval right now. Please try again." };
  }
}

export async function verifyPolicyDateApproval(
  approvalId: string,
  otp: string,
  input: Omit<ApprovalInput, "approverKey">,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const profile = await profileFor(input);
    if (!profile) return { ok: false, error: "This policy cannot be approved from your account." };
    if (!/^[0-9a-f-]{36}$/i.test(approvalId) || !/^\d{6}$/.test(otp)) {
      return { ok: false, error: "Enter the six-digit code sent to the approver." };
    }
    const admin = createSupabaseAdminClient();
    const { data: record, error } = await admin.from(TABLE)
      .select("id,requester_id,code_hash,attempts,delivered_at,expires_at,verified_at,consumed_at,issuance_date,policy_number,operation,existing_policy_id")
      .eq("id", approvalId).eq("requester_id", profile.id).maybeSingle();
    if (error || !record) return { ok: false, error: "This approval request is no longer available. Request a new OTP." };
    if (record.issuance_date !== input.issuanceDate ||
      record.policy_number !== input.policyNumber.trim().toUpperCase() ||
      record.operation !== input.operation ||
      (record.existing_policy_id ?? null) !== (input.existingPolicyId ?? null)) {
      return { ok: false, error: "Policy details changed. Request a fresh approval." };
    }
    if (!record.delivered_at || record.consumed_at || record.verified_at ||
      new Date(record.expires_at).getTime() <= Date.now() || record.attempts >= 5) {
      return { ok: false, error: "This code is expired or already used. Request a new OTP." };
    }
    const received = Buffer.from(otpHash(approvalId, otp), "hex");
    const expected = Buffer.from(record.code_hash, "hex");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      await admin.from(TABLE).update({ attempts: record.attempts + 1 })
        .eq("id", approvalId).eq("attempts", record.attempts).is("verified_at", null);
      return { ok: false, error: "The code doesn't match. Please check the email and try again." };
    }
    const { data: verified, error: updateError } = await admin.from(TABLE)
      .update({ verified_at: new Date().toISOString() })
      .eq("id", approvalId).eq("requester_id", profile.id)
      .eq("attempts", record.attempts).is("verified_at", null)
      .select("id").maybeSingle();
    if (updateError || !verified) return { ok: false, error: "Couldn't verify the code. Please request a fresh OTP." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Approval verification is unavailable. Please try again." };
  }
}
