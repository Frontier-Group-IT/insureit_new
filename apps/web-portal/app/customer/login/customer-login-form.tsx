"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { customerPhoneE164, establishCustomerWebSession, normalizeCustomerPhone10 } from "@/lib/customer-web-auth-client";

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
    const normalizedPhone = customerPhoneE164(phone);
    if (!normalizedPhone) {
      setMessage("Enter a valid 10 digit mobile number.");
      setBusy(false);
      return;
    }
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
      phone: customerPhoneE164(phone),
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

    try {
      await establishCustomerWebSession(data.session);
    } catch (sessionError) {
      await supabase.auth.signOut();
      setMessage(sessionError instanceof Error ? sessionError.message : "The secure Customer Web session could not be created.");
      setBusy(false);
      return;
    }

    window.location.replace("/customer/home");
  }

  return (
    <form className="space-y-4" onSubmit={otpSent ? verifyOtp : sendOtp}>
      <div className="grid gap-2">
        <label htmlFor="customer-phone" className="text-sm font-semibold text-[#10213D]">Registered mobile number</label>
        <div className="flex h-12 overflow-hidden rounded-xl border border-[#CFD8E6] bg-white transition focus-within:border-[#245A9A] focus-within:ring-2 focus-within:ring-[#245A9A]/15">
          <div className="grid min-w-[64px] place-items-center border-r border-[#DCE4EF] bg-[#F3F7FC] px-3 text-sm font-bold text-[#10213D]">+91</div>
          <input
            id="customer-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={phone}
            onChange={(event) => setPhone(normalizeCustomerPhone10(event.target.value))}
            disabled={busy || otpSent}
            maxLength={10}
            placeholder="Enter 10 digit number"
            className="min-w-0 flex-1 bg-white px-3 text-sm outline-none disabled:bg-slate-50"
            required
          />
        </div>
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