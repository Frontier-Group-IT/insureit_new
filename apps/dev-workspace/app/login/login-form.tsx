"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import type { DeveloperIdentity } from "../../lib/control-plane/developer-auth";

type MfaState = {
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
  verifiedTotpFactorId: string | null;
};

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Checking current session…");
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState<DeveloperIdentity | null>(null);
  const [mfa, setMfa] = useState<MfaState | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");

  async function readMfaState(): Promise<MfaState> {
    const supabase = getSupabaseBrowserClient();
    const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors()
    ]);

    if (assuranceError) throw assuranceError;
    if (factorsError) throw factorsError;

    const verifiedTotp = factors.totp.find(factor => factor.status === "verified") ?? null;
    return {
      currentLevel: assurance.currentLevel,
      nextLevel: assurance.nextLevel,
      verifiedTotpFactorId: verifiedTotp?.id ?? null
    };
  }

  async function resolveIdentity() {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setIdentity(null);
      setMfa(null);
      setEnrollment(null);
      setMessage("No app-level developer session.");
      return;
    }

    const response = await fetch("/api/control-plane/session", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    const result = await response.json() as DeveloperIdentity;
    setIdentity(result);

    if (!result.authorized) {
      setMfa(null);
      setEnrollment(null);
      setMessage(result.reason);
      return;
    }

    try {
      const mfaState = await readMfaState();
      setMfa(mfaState);
      setMessage(
        result.assuranceLevel === "aal2"
          ? "AAL2 verified. Preview-draft capability is available; production publishing remains disabled."
          : mfaState.verifiedTotpFactorId
            ? "Password verified. Enter the current code from your authenticator app to elevate this session to AAL2."
            : "Password verified. Set up an authenticator app to enable AAL2 preview-draft access."
      );
    } catch (error) {
      setMfa(null);
      setMessage(error instanceof Error ? error.message : "Could not read MFA status.");
    }
  }

  useEffect(() => { void resolveIdentity(); }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("Verifying InsureIT identity…");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setMessage(error.message);
        return;
      }
      setPassword("");
      await resolveIdentity();
    } finally {
      setBusy(false);
    }
  }

  async function beginEnrollment() {
    if (!identity?.authorized) return;
    setBusy(true);
    setMessage("Creating a private TOTP enrollment…");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "InsureIT Developer Workspace"
      });
      if (error) {
        setMessage(error.message);
        return;
      }

      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret
      });
      setCode("");
      setMessage("Scan the QR code with your authenticator app, then enter the 6-digit code to verify.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnrollment() {
    if (!enrollment || !/^\d{6}$/.test(code)) {
      setMessage("Enter the current 6-digit authenticator code.");
      return;
    }

    setBusy(true);
    setMessage("Verifying authenticator setup…");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollment.factorId
      });
      if (challengeError) {
        setMessage(challengeError.message);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challenge.id,
        code
      });
      if (verifyError) {
        setMessage(verifyError.message);
        return;
      }

      await supabase.auth.refreshSession();
      setEnrollment(null);
      setCode("");
      await resolveIdentity();
    } finally {
      setBusy(false);
    }
  }

  async function elevateExistingFactor() {
    if (!mfa?.verifiedTotpFactorId || !/^\d{6}$/.test(code)) {
      setMessage("Enter the current 6-digit authenticator code.");
      return;
    }

    setBusy(true);
    setMessage("Elevating this developer session to AAL2…");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfa.verifiedTotpFactorId
      });
      if (challengeError) {
        setMessage(challengeError.message);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfa.verifiedTotpFactorId,
        challengeId: challenge.id,
        code
      });
      if (verifyError) {
        setMessage(verifyError.message);
        return;
      }

      await supabase.auth.refreshSession();
      setCode("");
      await resolveIdentity();
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setIdentity(null);
    setMfa(null);
    setEnrollment(null);
    setCode("");
    setMessage("Signed out.");
  }

  if (identity?.authenticated) {
    const aal2 = identity.authorized && identity.assuranceLevel === "aal2";
    const hasVerifiedTotp = Boolean(mfa?.verifiedTotpFactorId);

    return (
      <div className="identity-summary">
        <div><span>Identity</span><b>{identity.fullName || identity.email || "Authenticated user"}</b></div>
        <div><span>Role</span><b>{identity.role || "No governed role"}</b></div>
        <div><span>MFA assurance</span><b className={aal2 ? "good" : ""}>{identity.assuranceLevel.toUpperCase()}</b></div>
        <div><span>Workspace authorization</span><b className={identity.authorized ? "good" : "bad"}>{identity.authorized ? (identity.draftWriteEligible ? "Authorized · preview drafts" : "Authorized · read only") : "Denied"}</b></div>

        {identity.authorized && !aal2 ? (
          <section className="mfa-panel">
            <div className="mfa-panel-head">
              <span>SECURITY ELEVATION</span>
              <b>{hasVerifiedTotp ? "Verify authenticator" : "Set up authenticator"}</b>
            </div>

            {!hasVerifiedTotp && !enrollment ? (
              <>
                <p>Use a TOTP authenticator such as 1Password, Google Authenticator, Microsoft Authenticator or Authy. This enrollment belongs to your existing InsureIT account.</p>
                <button type="button" className="mfa-primary" onClick={beginEnrollment} disabled={busy}>
                  {busy ? "Preparing…" : "Set up MFA"}
                </button>
              </>
            ) : null}

            {enrollment ? (
              <div className="mfa-enrollment">
                <div className="mfa-qr"><img src={enrollment.qrCode} alt="Authenticator enrollment QR code" /></div>
                <div className="mfa-secret">
                  <span>Manual setup key</span>
                  <code>{enrollment.secret}</code>
                  <small>Store this only in your authenticator. Do not share it or place it in source code.</small>
                </div>
                <label>Authenticator code
                  <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" />
                </label>
                <button type="button" className="mfa-primary" onClick={verifyEnrollment} disabled={busy || code.length !== 6}>
                  {busy ? "Verifying…" : "Verify and enable AAL2"}
                </button>
              </div>
            ) : null}

            {hasVerifiedTotp && !enrollment ? (
              <div className="mfa-challenge">
                <label>Authenticator code
                  <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" />
                </label>
                <button type="button" className="mfa-primary" onClick={elevateExistingFactor} disabled={busy || code.length !== 6}>
                  {busy ? "Verifying…" : "Verify MFA"}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {aal2 ? (
          <div className="mfa-success">
            <b>AAL2 session active</b>
            <span>Append-only configuration preview drafts are unlocked. Production publishing is still disabled.</span>
          </div>
        ) : null}

        <p>{message}</p>
        <div className="login-actions">
          {identity.authorized ? <a href={aal2 ? "/configuration" : "/"}>{aal2 ? "Open Configuration Registry" : "Open Developer Workspace"}</a> : null}
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <form className="developer-login-form" onSubmit={signIn}>
      <label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
      <button type="submit" disabled={busy}>{busy ? "Verifying…" : "Sign in"}</button>
      <p className="login-message">{message}</p>
    </form>
  );
}
