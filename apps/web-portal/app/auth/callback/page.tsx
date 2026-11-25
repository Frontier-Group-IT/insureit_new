"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { createClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<"loading" | "mfa" | "verifying" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState("Validating your invitation...");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error || !data.session) {
        setStatus("error");
        setMessage(error?.message ?? "This invitation link is invalid or has expired. Ask the administrator to send a new invitation.");
        return;
      }
      // An invitation or recovery session is only AAL1 until a previously
      // enrolled authenticator factor is verified. Never bypass this guard
      // or ask Supabase to update a password from an insufficient AAL.
      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!active) return;
      if (assuranceError || !assurance) {
        setStatus("error");
        setMessage("Unable to verify session security. Sign in again and reopen the link.");
        return;
      }
      if (assurance.currentLevel !== "aal2" && assurance.nextLevel === "aal2") {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (!active) return;
        const factor = factors?.totp?.find(item => item.status === "verified");
        if (factorsError || !factor) {
          setStatus("error");
          setMessage("Your existing authenticator is required. Contact your administrator if it is unavailable.");
          return;
        }
        setMfaFactorId(factor.id);
        setStatus("mfa");
        setMessage("Enter the six-digit code from your existing authenticator app to continue securely.");
        return;
      }
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
      setStatus("ready");
      setMessage("Create your new password.");
    }

    const timer = window.setTimeout(() => void loadSession(), 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [supabase]);

  async function verifyAuthenticator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "mfa" || !mfaFactorId || !/^\\d{6}$/.test(mfaCode)) {
      setMessage("Enter the current six-digit code from your authenticator.");
      return;
    }
    setStatus("verifying");
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code: mfaCode,
    });
    setMfaCode("");
    if (error) {
      setStatus("mfa");
      setMessage("Authenticator verification failed. Check the current code and try again.");
      return;
    }
    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.currentLevel !== "aal2") {
      setStatus("error");
      setMessage("AAL2 verification was not confirmed. Sign in and try again.");
      return;
    }
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    setStatus("ready");
    setMessage("Identity verified. Create your new password.");
  }

  async function completeInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || !assurance ||
      (assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2")) {
      setStatus("error");
      setMessage("MFA verification is required before changing your password. Sign in and reopen the link.");
      return;
    }
    setStatus("saving");
    setMessage("Updating your password...");

    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      setStatus("ready");
      setMessage(passwordError.message);
      return;
    }

    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      setStatus("error");
      setMessage("Your password was saved, but the invitation session could not be completed. Sign in using your new password.");
      return;
    }

    const response = await fetch("/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in
      })
    });

    if (!response.ok) {
      setStatus("error");
      setMessage("Your password was saved, but the secure browser session could not be created. Sign in using your new password.");
      return;
    }

    window.location.replace("/partner");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F9FF] p-4 sm:p-6">
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#D8EBFF]" />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-96 rotate-[-12deg] rounded-[45%] bg-[#DDF6EC]" />
      <section className="relative w-full max-w-[470px] rounded-[28px] border border-[#D7E6F5] bg-white/95 px-6 py-7 shadow-[0_24px_70px_rgba(11,55,105,0.14)] backdrop-blur sm:px-9 sm:py-9">
        <div className="mb-7 flex justify-center"><BrandLockup size="hero" className="max-w-full" /></div>
        <div className="border-t border-[#E3ECF6] pt-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#64748B]">Intermediary portal</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.025em] text-[#071D49]">Secure account activation</h1>
          <p className={`mt-2 text-sm ${status === "error" ? "text-red-700" : "text-[#59687A]"}`}>{message}</p>
        </div>

        {(status === "loading" || status === "saving" || status === "verifying") && (
          <div className="mt-6 rounded-2xl border border-[#DCE5EF] bg-[#F8FAFC] p-4 text-center text-sm font-medium text-[#334155]">
            {status === "loading" ? "Checking your session..." : status === "verifying" ? "Verifying authenticator..." : "Saving password and opening your portal..."}
          </div>
        )}

        {status === "mfa" && (
          <form className="mt-6 space-y-4" onSubmit={verifyAuthenticator}>
            <label htmlFor="totp-code" className="block text-sm font-semibold text-[#334155]">
              Authenticator code
            </label>
            <input
              id="totp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={mfaCode}
              onChange={event=>setMfaCode(event.target.value.replace(/\\D/g,"").slice(0,6))}
              className="w-full rounded-xl border border-[#CBD5E1] px-3 py-3 text-center text-lg tracking-[0.3em] outline-none focus:border-[#635BFF]"
              aria-describedby="totp-help"
            />
            <p id="totp-help" className="text-xs text-[#59687A]">
              Use the existing authenticator for your INSUREIT account. Never share its code.
            </p>
            <button type="submit" className="w-full rounded-xl bg-[#071D49] px-4 py-3 text-sm font-semibold text-white">
              Verify and continue
            </button>
          </form>
        )}

        {status === "ready" && (
          <form className="mt-6 space-y-4" onSubmit={completeInvite}>
            <div className="grid gap-2">
              <label htmlFor="new-password" className="text-sm font-semibold text-[#334155]">Create password</label>
              <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-xl border border-[#CBD5E1] px-3 py-3 text-sm outline-none focus:border-[#635BFF]" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="confirm-password" className="text-sm font-semibold text-[#334155]">Confirm password</label>
              <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="rounded-xl border border-[#CBD5E1] px-3 py-3 text-sm outline-none focus:border-[#635BFF]" />
            </div>
            <button type="submit" className="w-full rounded-xl bg-[#071D49] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0F2A55]">Activate portal access</button>
          </form>
        )}

        {status === "error" && (
          <a href="/login" className="mt-6 block w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 text-center text-sm font-semibold text-[#071D49]">Go to login</a>
        )}
      </section>
    </main>
  );
}
