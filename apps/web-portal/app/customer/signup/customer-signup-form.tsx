"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { Mail, UserRound, UserRoundCheck } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { CustomerPhoneField, toIndianE164 } from "../login/customer-phone-field";

type ExistingAccount = {
  customer_id: string;
  customer_code: string;
  account_name: string;
  city: string | null;
  state: string | null;
  vehicle_count: number | string | null;
  policy_count: number | string | null;
  claim_count: number | string | null;
};

function validEmail(value: string) {
  return !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function friendlySignupError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("rate") || lower.includes("too many")) return "Too many OTP attempts. Please wait a moment and try again.";
  if (lower.includes("invalid") || lower.includes("expired")) return "The OTP is invalid or expired. Please request a new code.";
  if (lower.includes("already linked to another login")) return "This customer account is already linked to another login. Please contact support.";
  if (lower.includes("existing_customer_selection_required")) return "We found an existing customer record for this mobile number. Select it below to continue.";
  return message || "Something went wrong. Please try again.";
}

async function createCustomerWebSession(session: { access_token: string; refresh_token: string; expires_in?: number }) {
  const response = await fetch("/api/customer/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
    }),
  });
  if (!response.ok) throw new Error("Your account was created, but the secure Customer Web session could not be started. Please login.");
}

export function CustomerSignupForm() {
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingAccounts, setExistingAccounts] = useState<ExistingAccount[]>([]);
  const [verifiedSession, setVerifiedSession] = useState<{ access_token: string; refresh_token: string; expires_in?: number } | null>(null);

  const phone = toIndianE164(mobile);
  const detailsValid = fullName.trim().length >= 2 && mobile.length === 10 && validEmail(email);

  async function requestOtp(event?: FormEvent) {
    event?.preventDefault();
    if (!detailsValid || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        channel: "sms",
        shouldCreateUser: true,
        data: {
          app_role: "customer",
          full_name: fullName.trim(),
          phone,
          ...(email.trim() ? { email: email.trim() } : {}),
        },
      },
    });
    if (otpError) {
      setError(friendlySignupError(otpError.message));
      setBusy(false);
      return;
    }
    setOtpSent(true);
    setMessage(`OTP sent to +91 ${mobile.slice(0, 5)} ${mobile.slice(5)}.`);
    setBusy(false);
  }

  async function finalizeFreshSignup(session: { access_token: string; refresh_token: string; expires_in?: number }) {
    const supabase = createClient();
    const { error: profileError } = await supabase.rpc("ensure_customer_signup_profile", {
      p_full_name: fullName.trim(),
      p_phone: phone,
      p_email: email.trim() || null,
    });
    if (profileError) throw profileError;
    await createCustomerWebSession(session);
    window.location.replace("/customer/home");
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    if (otp.trim().length < 6 || busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: otp.trim(),
      type: "sms",
    });
    if (verifyError || !data.user || !data.session) {
      setError(friendlySignupError(verifyError?.message ?? "OTP verification did not return a valid session."));
      setBusy(false);
      return;
    }

    const session = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
    };

    const { data: matches, error: matchError } = await supabase.rpc("get_existing_customer_accounts_for_signup");
    if (matchError) {
      setError(friendlySignupError(matchError.message));
      setBusy(false);
      return;
    }

    const accounts = ((matches ?? []) as ExistingAccount[]).map((account) => ({
      ...account,
      vehicle_count: Number(account.vehicle_count ?? 0),
      policy_count: Number(account.policy_count ?? 0),
      claim_count: Number(account.claim_count ?? 0),
    }));

    if (accounts.length > 0) {
      setExistingAccounts(accounts);
      setVerifiedSession(session);
      setMessage("We found an existing INSUREIT customer account for this mobile number. Select the correct account to continue.");
      setBusy(false);
      return;
    }

    try {
      await finalizeFreshSignup(session);
    } catch (nextError) {
      setError(friendlySignupError(nextError instanceof Error ? nextError.message : "Could not create customer account."));
      setBusy(false);
    }
  }

  async function linkExistingAccount(customerId: string) {
    if (!verifiedSession || busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: linkError } = await supabase.rpc("link_existing_customer_account", { p_customer_id: customerId });
    if (linkError) {
      setError(friendlySignupError(linkError.message));
      setBusy(false);
      return;
    }

    const { error: profileError } = await supabase.rpc("ensure_customer_signup_profile", {
      p_full_name: fullName.trim(),
      p_phone: phone,
      p_email: email.trim() || null,
    });
    if (profileError) {
      setError(friendlySignupError(profileError.message));
      setBusy(false);
      return;
    }

    try {
      await createCustomerWebSession(verifiedSession);
      window.location.replace("/customer/home");
    } catch (nextError) {
      setError(friendlySignupError(nextError instanceof Error ? nextError.message : "Could not start Customer Web."));
      setBusy(false);
    }
  }

  if (existingAccounts.length > 0) {
    return (
      <div>
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#E7F8F1] text-[#0E9F6E]">
            <UserRoundCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-[#10213D]">Existing account found</h1>
            <p className="mt-1 text-sm leading-5 text-[#66758A]">Select the customer account you want to use.</p>
          </div>
        </div>

        {message ? <p className="mb-4 rounded-xl bg-[#F0F8F4] px-3 py-2.5 text-sm text-[#3F6D5B]">{message}</p> : null}
        {error ? <p className="mb-4 rounded-xl bg-[#FFF1F0] px-3 py-2.5 text-sm text-[#A43B34]">{error}</p> : null}

        <div className="space-y-3">
          {existingAccounts.map((account) => (
            <button
              key={account.customer_id}
              type="button"
              disabled={busy}
              onClick={() => void linkExistingAccount(account.customer_id)}
              className="w-full rounded-2xl border border-[#D8E2EF] bg-white p-4 text-left transition hover:border-[#8DB5E3] hover:bg-[#F8FBFF] disabled:opacity-60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[#10213D]">{account.account_name}</p>
                  <p className="mt-1 text-xs text-[#6B7B90]">{account.customer_code}{account.city || account.state ? ` · ${[account.city, account.state].filter(Boolean).join(", ")}` : ""}</p>
                </div>
                <span className="rounded-lg bg-[#EAF3FF] px-2.5 py-1 text-[11px] font-bold text-[#0B63CE]">SELECT</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#E8EEF6] pt-3 text-center">
                <div><p className="font-bold text-[#10213D]">{account.vehicle_count}</p><p className="text-[10px] text-[#75849A]">Vehicles</p></div>
                <div><p className="font-bold text-[#10213D]">{account.policy_count}</p><p className="text-[10px] text-[#75849A]">Policies</p></div>
                <div><p className="font-bold text-[#10213D]">{account.claim_count}</p><p className="text-[10px] text-[#75849A]">Claims</p></div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={otpSent ? verifyOtp : requestOtp}>
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#E7F8F1] text-[#0E9F6E]">
          <UserRoundCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-[#10213D]">Create customer account</h1>
          <p className="mt-1 text-sm leading-5 text-[#66758A]">Register with your mobile number to access your INSUREIT customer account.</p>
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="customer-signup-name" className="text-sm font-semibold text-[#10213D]">Full name</label>
        <div className="flex h-12 items-center gap-3 rounded-xl border border-[#CFD8E6] bg-white px-3 focus-within:border-[#245A9A] focus-within:ring-2 focus-within:ring-[#245A9A]/15">
          <UserRound className="h-5 w-5 shrink-0 text-[#1F6FEB]" />
          <input
            id="customer-signup-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            disabled={busy || otpSent}
            autoComplete="name"
            placeholder="Your full name"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#10213D] outline-none placeholder:text-[#A0AABD]"
            required
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="customer-signup-phone" className="text-sm font-semibold text-[#10213D]">Mobile number</label>
        <CustomerPhoneField id="customer-signup-phone" value={mobile} onChange={setMobile} disabled={busy || otpSent} />
      </div>

      <div className="grid gap-2">
        <label htmlFor="customer-signup-email" className="text-sm font-semibold text-[#10213D]">Email <span className="font-normal text-[#7B8798]">optional</span></label>
        <div className="flex h-12 items-center gap-3 rounded-xl border border-[#CFD8E6] bg-white px-3 focus-within:border-[#245A9A] focus-within:ring-2 focus-within:ring-[#245A9A]/15">
          <Mail className="h-5 w-5 shrink-0 text-[#1F6FEB]" />
          <input
            id="customer-signup-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy || otpSent}
            autoComplete="email"
            placeholder="name@example.com"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#10213D] outline-none placeholder:text-[#A0AABD]"
          />
        </div>
      </div>

      {otpSent ? (
        <div className="grid gap-2">
          <label htmlFor="customer-signup-otp" className="text-sm font-semibold text-[#10213D]">Enter OTP</label>
          <input
            id="customer-signup-otp"
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

      {message ? <p className="rounded-xl bg-[#F0F8F4] px-3 py-2.5 text-sm text-[#3F6D5B]">{message}</p> : null}
      {error ? <p className="rounded-xl bg-[#FFF1F0] px-3 py-2.5 text-sm text-[#A43B34]">{error}</p> : null}

      <button
        type="submit"
        disabled={busy || (!otpSent && !detailsValid) || (otpSent && otp.trim().length < 6)}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#55BFA0] px-4 text-sm font-bold text-white transition hover:bg-[#43AD8E] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (otpSent ? "Verifying OTP..." : "Sending OTP...") : (otpSent ? "Verify & create account" : "Get OTP")}
      </button>

      {otpSent ? (
        <div className="flex items-center justify-between text-xs">
          <button type="button" disabled={busy} onClick={() => { setOtpSent(false); setOtp(""); setMessage(null); setError(null); }} className="font-semibold text-[#53627A] hover:text-[#142746]">Edit details</button>
          <button type="button" disabled={busy} onClick={() => void requestOtp()} className="font-semibold text-[#0B63CE] hover:text-[#084B9C]">Resend OTP</button>
        </div>
      ) : null}

      <p className="text-center text-[11px] leading-5 text-[#66758A]">
        By continuing, you agree to our Terms &amp; Conditions and{" "}
        <Link href="/privacy-policy" className="font-semibold text-[#0B63CE] hover:underline">Privacy Policy</Link>.
      </p>
    </form>
  );
}
