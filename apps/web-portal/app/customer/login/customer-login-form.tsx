"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { createClient } from "@/lib/supabase";

function normalizeIndianPhone(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/\s+/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return trimmed;
}

function customerSessionErrorMessage(status: number, code?: string) {
  if (status === 503 || code === "customer_session_unavailable") {
    return "Customer Web session service is temporarily unavailable. Please try again.";
  }
  if (status === 403 || code === "customer_session_forbidden") {
    return "This account is not authorized for Customer Web.";
  }
  if (status === 401 || code === "customer_session_invalid") {
    return "OTP was verified, but the secure Customer Web session could not be validated.";
  }
  return `Signed in, but the secure Customer Web session could not be created. (CW-${status || "ERR"})`;
}

export function CustomerLoginForm() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const normalizedPhone = normalizeIndianPhone(phone);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: { channel: "sms", shouldCreateUser: false },
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }
    setPhone(normalizedPhone);
    setOtpSent(true);
    setMessage("OTP sent to your registered mobile number.");
    setBusy(false);
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalizeIndianPhone(phone),
      token: otp.trim(),
      type: "sms",
    });

    if (error || !data.session || !data.user) {
      setMessage(error?.message ?? "OTP verification did not return a valid session.");
      setBusy(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", data.user.id)
      .maybeSingle<{ role: string; is_active: boolean }>();

    if (profileError || !profile?.is_active || profile.role !== "customer") {
      await supabase.auth.signOut();
      setMessage(profileError?.message ?? "This account is not authorized for Customer Web.");
      setBusy(false);
      return;
    }

    const response = await fetch("/api/customer/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      }),
    });

    if (!response.ok) {
      let code: string | undefined;
      try {
        const body = (await response.json()) as { code?: string };
        code = body.code;
      } catch {
        code = undefined;
      }
      await supabase.auth.signOut();
      setMessage(customerSessionErrorMessage(response.status, code));
      setBusy(false);
      return;
    }

    window.location.replace("/customer/home");
  }

  return (
    <form className="space-y-4" onSubmit={otpSent ? verifyOtp : sendOtp}>
      <div className="grid gap-2">
        <label htmlFor="customer-phone" className="text-sm font-semibold text-[#10213D]">Registered mobile number</label>
        <input
          id="customer-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          disabled={busy || otpSent}
          placeholder="+91 98765 43210"
          className="h-12 rounded-xl border border-[#CFD8E6] bg-white px-3 text-sm outline-none transition focus:border-[#245A9A] focus:ring-2 focus:ring-[#245A9A]/15 disabled:bg-slate-50"
          required
        />
      </div>

      {otpSent ? (
        <div className="grid gap-2">
          <label htmlFor="customer-otp" className="text-sm font-semibold text-[#10213D]">OTP</label>
          <input
            id="customer-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="Enter OTP"
            className="h-12 rounded-xl border border-[#CFD8E6] bg-white px-3 text-sm tracking-[0.22em] outline-none transition focus:border-[#245A9A] focus:ring-2 focus:ring-[#245A9A]/15"
            required
          />
        </div>
      ) : null}

      {message ? <p className="rounded-xl bg-[#F4F7FB] px-3 py-2.5 text-sm text-[#53627A]">{message}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#142746] px-4 text-sm font-bold text-white transition hover:bg-[#0C1B35] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (otpSent ? "Verifying..." : "Sending OTP...") : (otpSent ? "Verify & continue" : "Send OTP")}
      </button>

      {otpSent ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => { setOtpSent(false); setOtp(""); setMessage(null); }}
          className="w-full text-center text-xs font-semibold text-[#53627A] hover:text-[#142746]"
        >
          Use another mobile number
        </button>
      ) : null}
    </form>
  );
}