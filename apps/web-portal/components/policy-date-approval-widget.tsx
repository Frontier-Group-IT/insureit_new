"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import {
  requestPolicyDateApproval, verifyPolicyDateApproval,
} from "@/app/policies/policy-date-approval-actions";
import { POLICY_DATE_APPROVERS } from "@/lib/policy-date-rule";

type Props = {
  issuanceDate: string;
  policyNumber: string;
  operation: "create" | "edit";
  existingPolicyId?: string | null;
  intermediaryCode?: string;
  verifiedApprovalId: string | null;
  onApproved: (approvalId: string | null) => void;
};

export function PolicyDateApprovalWidget(props: Props) {
  const [approver, setApprover] = useState("jatin");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();
  const input = {
    issuanceDate: props.issuanceDate,
    policyNumber: props.policyNumber,
    operation: props.operation,
    existingPolicyId: props.existingPolicyId,
    intermediaryCode: props.intermediaryCode,
  };

  function requestOtp() {
    setError("");
    props.onApproved(null);
    startTransition(async () => {
      const response = await requestPolicyDateApproval({ ...input, approverKey: approver });
      if (!response.ok) { setError(response.error); return; }
      setRequestId(response.approvalId);
      setOtp("");
    });
  }

  function verifyOtp() {
    if (!requestId) return;
    setError("");
    startTransition(async () => {
      const response = await verifyPolicyDateApproval(requestId, otp, input);
      if (!response.ok) { setError(response.error); return; }
      props.onApproved(requestId);
      setOtp("");
    });
  }

  return (
    <div className="col-span-full rounded-xl border border-[#C8D9EF] bg-[#F7FAFE] p-3">
      <div className="flex items-start gap-2">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#285A93]" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-[#17365D]">Earlier-month policy approval</p>
          <p className="mt-0.5 text-[11px] leading-5 text-[#536C8D]">
            This policy date requires approval. Select an approver and verify the email code before saving.
          </p>
          {props.verifiedApprovalId ? (
            <p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#14845B]">
              <CheckCircle2 className="h-4 w-4" /> Email OTP verified. You can now save the policy.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="min-w-[200px] flex-1 text-[10px] font-semibold text-[#536C8D]">
                Approver
                <select value={approver} disabled={busy} onChange={event => { setApprover(event.target.value); setRequestId(null); setOtp(""); setError(""); }} className="mt-1 h-9 w-full rounded-lg border border-[#C8D9EF] bg-white px-2 text-[12px] text-[#19375D]">
                  {POLICY_DATE_APPROVERS.map(person => <option key={person.key} value={person.key}>{person.name}</option>)}
                </select>
              </label>
              {!requestId ? (
                <button type="button" onClick={requestOtp} disabled={busy || !props.policyNumber.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#17365D] px-3 text-[11px] font-bold text-white disabled:opacity-50">
                  <Mail className="h-3.5 w-3.5" /> {busy ? "Sending…" : "Send OTP"}
                </button>
              ) : (
                <>
                  <label className="text-[10px] font-semibold text-[#536C8D]">
                    Email OTP
                    <input value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" maxLength={6} className="mt-1 h-9 w-28 rounded-lg border border-[#C8D9EF] bg-white px-2 text-[12px]" />
                  </label>
                  <button type="button" onClick={verifyOtp} disabled={busy || otp.length !== 6} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#17365D] px-3 text-[11px] font-bold text-white disabled:opacity-50">
                    <ShieldCheck className="h-3.5 w-3.5" /> {busy ? "Checking…" : "Verify"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => { setRequestId(null); setOtp(""); setError(""); }} className="h-9 text-[11px] font-semibold text-[#315B9A]">New OTP</button>
                </>
              )}
            </div>
          )}
          {requestId && !props.verifiedApprovalId ? <p className="mt-1 text-[10px] text-[#6A7F9A]">Code sent to the selected approver&apos;s email. Valid for 5 minutes.</p> : null}
          {error ? <p role="alert" className="mt-1 text-[11px] text-red-700">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
