"use server";

import { createHmac, randomInt, randomUUID } from "node:crypto";
import { requirePolicyCreator, requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { indiaDate, policyDateDecision, policyDateApprovalReason, POLICY_DATE_APPROVERS } from "@/lib/policy-date-rule";

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
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function istTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(date) + " IST";
}
function formatPolicyDate(date: string): string {
  const [y, m, d] = date.split("-");
  return [d, m, y].join("/");
}

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
    const requesterName = profile.full_name?.trim();
    if (!requesterName) return { ok: false, error: "Your profile name is missing. Ask an administrator to update it before requesting approval." };
    const ruleReason = policyDateApprovalReason(input.issuanceDate);
    if (!ruleReason) return { ok: false, error: "No earlier-month approval reason could be established." };
    const approver = POLICY_DATE_APPROVERS.find(value => value.key === input.approverKey);
    const policyNumber = input.policyNumber.trim().toUpperCase();
    if (!approver || !policyNumber || policyNumber.length > 120) return { ok: false, error: "Select an approver and enter a valid policy number." };
    const emailKey = process.env.RESEND_API_KEY;
    const from = process.env.POLICY_DATE_OTP_FROM?.trim() || process.env.RESEND_FROM_EMAIL?.trim();
    if (!emailKey || !from || !process.env.POLICY_DATE_OTP_SECRET) {
      return { ok: false, error: "Email approval is not available yet. Contact your administrator." };
    }
    const admin = createSupabaseAdminClient();
    let originalDate: string | null = null;
    if (input.operation === "edit") {
      const { data: prior, error: priorError } = await admin.from("policies")
        .select("issuance_date").eq("id", input.existingPolicyId!).single<{ issuance_date: string | null }>();
      if (priorError || !prior) return { ok: false, error: "Could not retrieve the existing policy date for approval." };
      originalDate = prior.issuance_date;
    }
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

    const requestedAt = new Date();
    const approvalId = randomUUID();
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const { error: insertError } = await admin.from(TABLE).insert({
      id: approvalId, requester_id: profile.id, approver_key: approver.key,
      approver_name: approver.name, approver_email: approver.email,
      issuance_date: input.issuanceDate, policy_number: policyNumber,
      operation: input.operation, existing_policy_id: input.operation === "edit" ? input.existingPolicyId : null,
      requester_name: requesterName, approval_reason: ruleReason, requester_justification: null,
      code_hash: otpHash(approvalId, code), expires_at: expiresAt,
    });
    if (insertError) return { ok: false, error: "Couldn't start email approval. Please try again." };
    const action = input.operation === "edit" ? "Edit policy issuance date" : "Create policy with an earlier issuance date";
    const dateLabel = formatPolicyDate(input.issuanceDate);
    const requestTime = istTimestamp(requestedAt);
    const details: Array<[string, string]> = [
      ["Requested by", requesterName],
      ["Employee role", profile.role],
      ["Action", action],
      ["Policy number", policyNumber],
      ["Requested issuance date", dateLabel],
      ...(originalDate ? [["Previous issuance date", formatPolicyDate(originalDate)] as [string, string]] : []),
      ...(input.intermediaryCode ? [["Policy source", input.intermediaryCode.trim()] as [string, string]] : []),
      ["System approval reason", ruleReason],
      ["Requested at", requestTime],
    ];
    const textDetails = details.map(([label, value]) => label + ": " + value).join("\\n");
    const htmlDetails = details.map(([label, value]) =>
      '<tr><th style="text-align:left;padding:9px 12px;border-bottom:1px solid #e5edf6;color:#506783;width:42%;font-size:13px">' +
      escapeHtml(label) + '</th><td style="padding:9px 12px;border-bottom:1px solid #e5edf6;color:#152d4b;font-size:13px;font-weight:600;overflow-wrap:anywhere">' +
      escapeHtml(value) + '</td></tr>'
    ).join("");
    const emailText = "INSUREIT — Policy Date Approval Required\\n\\n" + textDetails +
      "\\n\\nVerification code: " + code + "\\nValid for 5 minutes. " +
      "Only share the code after reviewing and approving this request. If unexpected, do not share it.";
    const emailHtml = '<div style="background:#f2f6fc;padding:24px;font-family:Arial,sans-serif;color:#152d4b">' +
      '<div style="max-width:590px;margin:auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #dce7f4">' +
      '<div style="background:#17365d;padding:20px;color:white"><div style="font-size:22px;font-weight:800">INSUREIT</div>' +
      '<div style="font-size:13px;margin-top:5px">Policy Issuance Date Approval</div></div>' +
      '<div style="padding:20px"><p style="margin-top:0">Approval requested by <strong>' + escapeHtml(requesterName) + '</strong>.</p>' +
      '<table role="presentation" style="width:100%;border-collapse:collapse">' + htmlDetails + '</table>' +
      '<div style="background:#f0f6ff;border-radius:12px;padding:16px;text-align:center;margin:18px 0">' +
      '<div style="font-size:12px;color:#506783">Verification code</div><div style="font-size:30px;font-weight:800;letter-spacing:6px;margin:8px 0">' + code + '</div>' +
      '<div style="font-size:12px;color:#506783">Expires in 5 minutes</div></div>' +
      '<p style="font-size:13px;line-height:1.5">Only share this code after reviewing and approving the request. If unexpected, do not share it.</p></div></div></div>';
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + emailKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [approver.email], subject: "INSUREIT — Policy Date Approval Required — " + policyNumber,
        text: emailText, html: emailHtml,
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
    const { data: verified, error } = await admin.rpc("verify_policy_date_otp_v1", {
      p_approval_id: approvalId,
      p_requester: profile.id,
      p_supplied_hash: otpHash(approvalId, otp),
      p_date: input.issuanceDate,
      p_policy_number: input.policyNumber,
      p_operation: input.operation,
      p_existing_policy_id: input.existingPolicyId ?? null,
    });
    if (error) return { ok: false, error: "Couldn't verify approval right now. Please try again." };
    if (verified !== true) return { ok: false, error: "The code is incorrect, expired, already used, or doesn't match this policy. Check the email or request a new OTP." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Approval verification is unavailable. Please try again." };
  }
}
