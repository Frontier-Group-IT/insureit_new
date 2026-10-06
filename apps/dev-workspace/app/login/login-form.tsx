"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import type { DeveloperIdentity } from "../../lib/control-plane/developer-auth";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Checking current session…");
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState<DeveloperIdentity | null>(null);

  async function resolveIdentity() {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setIdentity(null);
      setMessage("No app-level developer session.");
      return;
    }

    const response = await fetch("/api/control-plane/session", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    const result = await response.json() as DeveloperIdentity;
    setIdentity(result);
    setMessage(result.reason);
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
      await resolveIdentity();
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setIdentity(null);
    setMessage("Signed out.");
  }

  if (identity?.authenticated) {
    return (
      <div className="identity-summary">
        <div><span>Identity</span><b>{identity.fullName || identity.email || "Authenticated user"}</b></div>
        <div><span>Role</span><b>{identity.role || "No governed role"}</b></div>
        <div><span>MFA assurance</span><b>{identity.assuranceLevel.toUpperCase()}</b></div>
        <div><span>Workspace authorization</span><b className={identity.authorized ? "good" : "bad"}>{identity.authorized ? (identity.draftWriteEligible ? "Authorized · preview drafts" : "Authorized · read only") : "Denied"}</b></div>
        <p>{message}</p>
        <div className="login-actions">
          {identity.authorized ? <a href="/">Open Developer Workspace</a> : null}
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <form className="developer-login-form" onSubmit={signIn}>
      <label>Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      <button type="submit" disabled={busy}>{busy ? "Verifying…" : "Sign in"}</button>
      <p className="login-message">{message}</p>
    </form>
  );
}
