"use client";

import { Check, Pencil, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { requestCustomerMobileChangeOtp, verifyCustomerMobileChangeOtp } from "./customer-mobile-change-actions";

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const MOBILE_PATTERN = /^[6-9][0-9]{9}$/;

function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}

export function CustomerMobileOtpField({ customerId, initialMobile }: { customerId: string; initialMobile: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const verificationInputRef = useRef<HTMLInputElement>(null);
  const normalizedInitialMobile = normalizeMobile(initialMobile).slice(0, 10);
  const [editable, setEditable] = useState(false);
  const [mobile, setMobile] = useState(normalizedInitialMobile);
  const [challengeToken, setChallengeToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const normalizedMobile = normalizeMobile(mobile).slice(0, 10);
  const isMobileValid = MOBILE_PATTERN.test(normalizedMobile);

  function clearVerification() {
    if (verificationInputRef.current) verificationInputRef.current.value = "";
  }

  async function requestOtp() {
    if (!MOBILE_PATTERN.test(normalizedMobile)) {
      setMessage("Enter a valid 10-digit Indian login mobile number.");
      setModalOpen(true);
      return;
    }
    setRequesting(true);
    setMessage("");
    try {
      const result = await requestCustomerMobileChangeOtp(customerId, normalizedMobile);
      if (!result.ok) {
        setMessage(result.error);
        setModalOpen(true);
        return;
      }
      setChallengeToken(result.challengeToken);
      setMaskedEmail(result.maskedEmail);
      setOtp("");
      setCooldown(30);
      setModalOpen(true);
    } finally {
      setRequesting(false);
    }
  }

  function confirmMobileEdit() {
    if (!isMobileValid || requesting) return;
    if (normalizedMobile === normalizedInitialMobile) {
      setEditable(false);
      setMessage("");
      return;
    }
    void requestOtp();
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;

    const onSubmit = (event: SubmitEvent) => {
      const normalizedInitial = normalizeMobile(initialMobile);
      if (normalizedInitial === normalizedMobile) return;
      if (verificationInputRef.current?.value) return;

      if (!MOBILE_PATTERN.test(normalizedMobile)) return;

      const gstCheckbox = form.elements.namedItem("is_gst_registered");
      if (gstCheckbox instanceof HTMLInputElement && gstCheckbox.checked) {
        const legalTradeName = form.elements.namedItem("legal_trade_name");
        const gstNumber = form.elements.namedItem("gst_number");
        const legalValue = legalTradeName instanceof HTMLInputElement ? legalTradeName.value.trim() : "";
        const gstValue = gstNumber instanceof HTMLInputElement ? gstNumber.value.replace(/\s/g, "").toUpperCase() : "";
        if (!legalValue || !gstValue || !GSTIN_PATTERN.test(gstValue)) return;
      }

      event.preventDefault();
      void requestOtp();
    };

    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [customerId, initialMobile, normalizedMobile]);

  async function verifyOtp() {
    if (!challengeToken) {
      setMessage("Request a new OTP first.");
      return;
    }
    setVerifying(true);
    setMessage("");
    try {
      const result = await verifyCustomerMobileChangeOtp(customerId, challengeToken, otp);
      if (!result.ok) {
        if (result.challengeToken) setChallengeToken(result.challengeToken);
        setMessage(result.error);
        return;
      }

      if (verificationInputRef.current) verificationInputRef.current.value = result.authorizationToken;
      setModalOpen(false);
      setEditable(false);
      setOtp("");
      const form = rootRef.current?.closest("form");
      window.setTimeout(() => form?.requestSubmit(), 0);
    } finally {
      setVerifying(false);
    }
  }

  async function resendOtp() {
    if (cooldown > 0 || requesting) return;
    await requestOtp();
  }

  return (
    <>
      <div ref={rootRef}>
        <label className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#68758A]" htmlFor="phone">Login mobile *</label>
        <div className={`flex h-8 items-center overflow-hidden rounded-md border ${editable ? "border-[var(--accent)] bg-white ring-2 ring-[#E8E8FF]" : "border-[#E1E7EF] bg-[#F5F7FA]"}`}>
          <input
            ref={inputRef}
            id="phone"
            name="phone"
            type="tel"
            required
            inputMode="numeric"
            maxLength={10}
            value={mobile}
            readOnly={!editable}
            onChange={(event) => {
              setMobile(event.target.value.replace(/\D/g, "").slice(0, 10));
              clearVerification();
              setChallengeToken("");
              setMessage("");
            }}
            className={`min-w-0 flex-1 border-0 bg-transparent px-2.5 text-[11.5px] outline-none ${editable ? "text-[var(--text)]" : "cursor-default text-[#526176]"}`}
          />
          <button
            type="button"
            aria-label={editable ? "Confirm login mobile" : "Edit login mobile"}
            title={editable ? (isMobileValid ? "Confirm mobile" : "Enter a valid 10-digit mobile") : "Edit login mobile"}
            disabled={editable && (!isMobileValid || requesting)}
            onClick={() => {
              if (editable) {
                confirmMobileEdit();
                return;
              }
              setEditable(true);
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="grid h-full w-9 shrink-0 place-items-center border-l border-[#D7DFEA] text-[#315FEA] transition hover:bg-[#EEF3FF] hover:text-[#244ED5] disabled:cursor-not-allowed disabled:bg-[#F5F7FA] disabled:text-[#A8B2C3]"
          >
            {editable ? <Check className="h-4 w-4" strokeWidth={2.4} /> : <Pencil className="h-3.5 w-3.5" strokeWidth={2} />}
          </button>
        </div>
        <input ref={verificationInputRef} type="hidden" name="mobile_change_verification" defaultValue="" />
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-[170] grid place-items-center bg-[#0F172A]/45 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="mobile-otp-title">
          <div className="w-full max-w-[410px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.30)]">
            <div className="flex items-start justify-between gap-3 border-b border-[#E5EAF2] bg-[#F8FAFD] px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EAF0FF] text-[#315FEA]"><ShieldCheck className="h-5 w-5" /></span>
                <div>
                  <h3 id="mobile-otp-title" className="text-[14px] font-semibold text-[#0F2D5C]">Verify mobile change</h3>
                  <p className="mt-1 text-[11.5px] leading-5 text-[#64748B]">OTP sent to your registered Operations email{maskedEmail ? `: ${maskedEmail}` : "."}</p>
                </div>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#64748B] hover:bg-white hover:text-[#0F172A]" aria-label="Close OTP verification"><X className="h-4 w-4" /></button>
            </div>

            <div className="px-5 py-4">
              <label htmlFor="customer-mobile-otp" className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[#68758A]">Enter OTP</label>
              <input
                id="customer-mobile-otp"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit OTP"
                className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-center text-[16px] font-semibold tracking-[0.28em] text-[#0F172A] outline-none focus:border-[#315FEA] focus:ring-2 focus:ring-[#E8E8FF]"
              />
              <p className="mt-2 text-[10px] leading-4 text-[#64748B]">The OTP is valid for 5 minutes and is tied to this customer and the new mobile number.</p>
              {message ? <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[10.5px] font-medium text-red-700">{message}</div> : null}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#E5EAF2] px-5 py-3">
              <button type="button" onClick={() => void resendOtp()} disabled={cooldown > 0 || requesting} className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-[10.5px] font-semibold text-[#315FEA] hover:bg-[#F3F6FF] disabled:cursor-not-allowed disabled:text-[#94A3B8]">
                <RefreshCw className={`h-3.5 w-3.5 ${requesting ? "animate-spin" : ""}`} />
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
              </button>
              <button type="button" onClick={() => void verifyOtp()} disabled={verifying || otp.length !== 6} className="inline-flex h-9 items-center justify-center rounded-md bg-[#315FEA] px-4 text-[10.5px] font-semibold text-white shadow-sm hover:bg-[#2851D9] disabled:cursor-not-allowed disabled:opacity-50">
                {verifying ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
