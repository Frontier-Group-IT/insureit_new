"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Mail, ShieldCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { customerPhoneE164, establishCustomerWebSession, normalizeCustomerPhone10 } from "@/lib/customer-web-auth-client";

type ExistingCustomerAccount = {
  customer_id: string;
  customer_code: string;
  account_name: string;
  city: string | null;
  state: string | null;
  vehicle_count: number;
  policy_count: number;
  claim_count: number;
  is_current_profile_customer: boolean;
};

export function CustomerSignupForm() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingAccounts, setExistingAccounts] = useState<ExistingCustomerAccount[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const emailValid = useMemo(() => !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const formValid = fullName.trim().length >= 2 && phone.length === 10 && emailValid;
  const choosingExistingAccount = existingAccounts.length > 0;

  async function requestOtp(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    setError(null);
    setMessage(null);

    if (fullName.trim().length < 2) return setError("Enter your full name.");
    if (phone.length !== 10) return setError("Enter a valid 10 digit mobile number.");
    if (!emailValid) return setError("Enter a valid email address, or leave it blank.");

    const fullPhone = customerPhoneE164(phone);
    if (!fullPhone) return setError("Enter a valid 10 digit mobile number.");

    setBusy(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: fullPhone,
      options: {
        channel: "sms",
        shouldCreateUser: true,
        data: {
          app_role: "customer",
          full_name: fullName.trim(),
          phone: fullPhone,
          ...(email.trim() ? { email: email.trim() } : {}),
        },
      },
    });

    if (otpError) {
      setError(signupErrorMessage(otpError, "send"));
      setBusy(false);
      return;
    }

    setOtpSent(true);
    setMessage("OTP sent to your mobile number.");
    setBusy(false);
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setMessage(null);

    if (otp.trim().length < 4) return setError("Enter the OTP sent to your mobile number.");

    const fullPhone = customerPhoneE164(phone);
    if (!fullPhone) return setError("Enter a valid 10 digit mobile number.");

    setBusy(true);
    const supabase = createClient();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: otp.trim(),
      type: "sms",
    });

    if (verifyError || !data.session || !data.user) {
      setError(signupErrorMessage(verifyError ?? new Error("OTP verification did not return a valid session."), "verify"));
      setBusy(false);
      return;
    }

    const { data: matches, error: matchesError } = await (supabase.rpc as any)("get_existing_customer_accounts_for_signup");
    if (matchesError) {
      setError(matchesError.message);
      setBusy(false);
      return;
    }

    const normalizedMatches = ((matches ?? []) as ExistingCustomerAccount[]).map((account) => ({
      ...account,
      vehicle_count: Number(account.vehicle_count ?? 0),
      policy_count: Number(account.policy_count ?? 0),
      claim_count: Number(account.claim_count ?? 0),
      is_current_profile_customer: Boolean(account.is_current_profile_customer),
    }));

    if (normalizedMatches.length > 0) {
      setExistingAccounts(normalizedMatches);
      setSelectedCustomerId(normalizedMatches.length === 1 ? normalizedMatches[0].customer_id : null);
      setMessage(normalizedMatches.length === 1
        ? "We found your existing INSUREIT customer account. Continue with it to keep your vehicles, policies and claims."
        : "We found customer accounts registered with this mobile number. Select the account you want to continue with.");
      setBusy(false);
      return;
    }

    await finishSignup(data.session);
  }

  async function finishSignup(existingSession?: Parameters<typeof establishCustomerWebSession>[0]) {
    const supabase = createClient();
    const fullPhone = customerPhoneE164(phone);
    if (!fullPhone) {
      setError("Enter a valid 10 digit mobile number.");
      setBusy(false);
      return;
    }

    setBusy(true);
    const { data: profile, error: profileError } = await (supabase.rpc as any)("ensure_customer_signup_profile", {
      p_full_name: fullName.trim(),
      p_phone: fullPhone,
      p_email: email.trim() || null,
    }).single();

    if (profileError) {
      if (String(profileError.message || "").includes("EXISTING_CUSTOMER_SELECTION_REQUIRED")) {
        const { data: matches, error: matchesError } = await (supabase.rpc as any)("get_existing_customer_accounts_for_signup");
        if (!matchesError && Array.isArray(matches) && matches.length > 0) {
          setExistingAccounts(matches as ExistingCustomerAccount[]);
          setSelectedCustomerId(matches.length === 1 ? matches[0].customer_id : null);
          setMessage("We found an existing customer account for this mobile number. Select it to continue.");
          setBusy(false);
          return;
        }
      }
      setError(profileError.message);
      setBusy(false);
      return;
    }

    if (!profile || profile.role !== "customer" || profile.is_active === false) {
      await supabase.auth.signOut();
      setError("This account is not authorized for Customer Web.");
      setBusy(false);
      return;
    }

    let session = existingSession;
    if (!session) {
      const { data } = await supabase.auth.getSession();
      session = data.session ?? undefined;
    }
    if (!session) {
      setError("Your OTP session expired. Please request a new OTP.");
      setBusy(false);
      return;
    }

    try {
      await establishCustomerWebSession(session);
      window.location.replace("/customer/home");
    } catch (sessionError) {
      await supabase.auth.signOut();
      setError(sessionError instanceof Error ? sessionError.message : "The secure Customer Web session could not be created.");
      setBusy(false);
    }
  }

  async function continueWithExistingAccount() {
    if (!selectedCustomerId || busy) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();

    const { error: linkError } = await (supabase.rpc as any)("link_existing_customer_account", {
      p_customer_id: selectedCustomerId,
    });
    if (linkError) {
      setError(linkError.message);
      setBusy(false);
      return;
    }

    await finishSignup();
  }

  function editDetails() {
    if (busy) return;
    setOtpSent(false);
    setOtp("");
    setExistingAccounts([]);
    setSelectedCustomerId(null);
    setMessage(null);
    setError(null);
  }

  if (choosingExistingAccount) {
    return (
      <div className="space-y-4">
        {message ? <p className="rounded-xl bg-[#EDF8F3] px-3 py-2.5 text-sm text-[#17694A]">{message}</p> : null}
        {error ? <p className="rounded-xl bg-[#FFF1F1] px-3 py-2.5 text-sm text-[#A93838]">{error}</p> : null}
        <div className="space-y-3">
          {existingAccounts.map((account) => {
            const selected = selectedCustomerId === account.customer_id;
            return (
              <button
                key={account.customer_id}
                type="button"
                onClick={() => setSelectedCustomerId(account.customer_id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-[#245A9A] bg-[#F4F8FD]" : "border-[#D8E2EF] bg-white hover:border-[#AFC4DD]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#10213D]">{account.account_name}</p>
                    <p className="mt-0.5 text-xs text-[#66758A]">{account.customer_code}</p>
                  </div>
                  <span className={`mt-0.5 h-4 w-4 rounded-full border-4 ${selected ? "border-[#245A9A] bg-white" : "border-[#CBD5E1] bg-white"}`} />
                </div>
                <div className="mt-3 grid grid-cols-3 divide-x divide-[#E3EAF2] border-t border-[#E8EEF6] pt-3 text-center">
                  <div><p className="text-sm font-bold text-[#10213D]">{account.vehicle_count}</p><p className="text-[10px] text-[#7A8799]">Vehicles</p></div>
                  <div><p className="text-sm font-bold text-[#10213D]">{account.policy_count}</p><p className="text-[10px] text-[#7A8799]">Policies</p></div>
                  <div><p className="text-sm font-bold text-[#10213D]">{account.claim_count}</p><p className="text-[10px] text-[#7A8799]">Claims</p></div>
                </div>
                {account.city || account.state ? <p className="mt-2 text-xs text-[#66758A]">{[account.city, account.state].filter(Boolean).join(", ")}</p> : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!selectedCustomerId || busy}
          onClick={() => void continueWithExistingAccount()}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#142746] px-4 text-sm font-bold text-white transition hover:bg-[#0C1B35] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Linking account..." : "Continue with this account"}
        </button>
        <button type="button" disabled={busy} onClick={editDetails} className="w-full text-center text-xs font-semibold text-[#53627A] hover:text-[#142746]">
          Use another mobile number
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={otpSent ? verifyOtp : requestOtp}>
      <div className="grid gap-2">
        <label htmlFor="customer-signup-name" className="text-sm font-semibold text-[#10213D]">Full name</label>
        <div className="flex h-12 items-center gap-3 rounded-xl border border-[#CFD8E6] bg-white px-3 focus-within:border-[#245A9A] focus-within:ring-2 focus-within:ring-[#245A9A]/15">
          <UserRound className="h-5 w-5 shrink-0 text-[#2472CC]" />
          <input
            id="customer-signup-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            disabled={busy || otpSent}
            autoComplete="name"
            placeholder="Your full name"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            required
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="customer-signup-phone" className="text-sm font-semibold text-[#10213D]">Mobile number</label>
        <div className="flex h-12 overflow-hidden rounded-xl border border-[#CFD8E6] bg-white transition focus-within:border-[#245A9A] focus-within:ring-2 focus-within:ring-[#245A9A]/15">
          <div className="grid min-w-[64px] place-items-center border-r border-[#DCE4EF] bg-[#EAF3FF] px-3 text-sm font-bold text-[#10213D]">+91</div>
          <input
            id="customer-signup-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={phone}
            onChange={(event) => setPhone(normalizeCustomerPhone10(event.target.value))}
            disabled={busy || otpSent}
            maxLength={10}
            placeholder="98765 43210"
            className="min-w-0 flex-1 bg-white px-3 text-sm outline-none"
            required
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="customer-signup-email" className="text-sm font-semibold text-[#10213D]">Email <span className="font-normal text-[#7A8799]">optional</span></label>
        <div className="flex h-12 items-center gap-3 rounded-xl border border-[#CFD8E6] bg-white px-3 focus-within:border-[#245A9A] focus-within:ring-2 focus-within:ring-[#245A9A]/15">
          <Mail className="h-5 w-5 shrink-0 text-[#2472CC]" />
          <input
            id="customer-signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy || otpSent}
            placeholder="name@example.com"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      {otpSent ? (
        <div className="grid gap-2">
          <label htmlFor="customer-signup-otp" className="text-sm font-semibold text-[#10213D]">Enter OTP</label>
          <div className="flex h-12 items-center gap-3 rounded-xl border border-[#CFD8E6] bg-white px-3 focus-within:border-[#245A9A] focus-within:ring-2 focus-within:ring-[#245A9A]/15">
            <ShieldCheck className="h-5 w-5 shrink-0 text-[#0F9F6E]" />
            <input
              id="customer-signup-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="Enter OTP"
              className="min-w-0 flex-1 bg-transparent text-sm tracking-[0.18em] outline-none"
              required
            />
          </div>
        </div>
      ) : null}

      {message ? <p className="rounded-xl bg-[#EDF8F3] px-3 py-2.5 text-sm text-[#17694A]">{message}</p> : null}
      {error ? <p className="rounded-xl bg-[#FFF1F1] px-3 py-2.5 text-sm text-[#A93838]">{error}</p> : null}

      <button
        type="submit"
        disabled={busy || (!otpSent && !formValid)}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#54BEA0] px-4 text-sm font-bold text-white transition hover:bg-[#43AF91] disabled:cursor-not-allowed disabled:opacity-55"
      >
        {busy ? (otpSent ? "Verifying..." : "Sending OTP...") : (otpSent ? "Verify & continue" : "Get OTP")}
      </button>

      {otpSent ? (
        <div className="flex items-center justify-between text-xs font-semibold">
          <button type="button" disabled={busy} onClick={editDetails} className="text-[#53627A] hover:text-[#142746]">Edit details</button>
          <button type="button" disabled={busy} onClick={() => void requestOtp()} className="text-[#245A9A] hover:text-[#17365D]">Resend OTP</button>
        </div>
      ) : null}

      <p className="text-center text-[11px] leading-5 text-[#66758A]">
        By continuing, you agree to our Terms &amp; Conditions and{" "}
        <Link href="/privacy-policy" className="font-semibold text-[#176BB4] hover:underline">Privacy Policy</Link>.
      </p>
    </form>
  );
}

function signupErrorMessage(error: unknown, action: "send" | "verify") {
  const message = error instanceof Error ? error.message : String((error as { message?: string } | null)?.message ?? "");
  const lower = message.toLowerCase();
  if (lower.includes("rate") || lower.includes("too many")) return "Too many OTP attempts. Please wait a moment and try again.";
  if (lower.includes("invalid") || lower.includes("expired")) return "The OTP is invalid or expired. Please request a new code.";
  if (lower.includes("network") || lower.includes("fetch")) return "Could not reach the INSUREIT server. Check your internet connection and try again.";
  if (lower.includes("another login")) return "This customer account is already linked to another login. Please contact support.";
  if (message) return message;
  return action === "send" ? "Could not send OTP. Please try again." : "Could not verify OTP. Please try again.";
}
