"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isAllowedAdminRole } from "@/lib/auth-config";
import { createClient } from "@/lib/supabase";
import { BlockingWorkPanel, InsureItButtonLoader } from "@/components/loading/insureit-loader";

type InviteStatus = "checking" | "ready" | "expired" | "error" | "done";

function readInviteError() {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return hash.get("error_description") ?? query.get("error_description") ?? hash.get("error") ?? query.get("error");
}

export function InviteSetupForm() {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<InviteStatus>("checking");
  const [message, setMessage] = useState("Checking your invitation link...");
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepareInvite() {
      const inviteError = readInviteError();
      if (inviteError) {
        if (!cancelled) {
          setStatus("expired");
          setMessage(inviteError);
        }
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!cancelled) {
            setStatus("expired");
            setMessage(error.message);
          }
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error || !data.session) {
        setStatus("expired");
        setMessage(error?.message ?? "This invitation link is invalid or has expired.");
        return;
      }

      setSession(data.session);
      setEmail(data.session.user.email ?? "");
      setStatus("ready");
      setMessage("");
    }

    void prepareInvite();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!session) {
      setStatus("expired");
      setMessage("This invitation session is no longer available. Please request a fresh invite.");
      return;
    }
    if (password.length < 8) {
      setStatus("ready");
      setMessage("Use at least 8 characters for the password.");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("ready");
      setMessage("The password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setIsSubmitting(false);
      setStatus("ready");
      setMessage(updateError.message);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", session.user.id)
      .maybeSingle<{ id: string; role: string; is_active: boolean }>();

    if (profileError || !profile?.is_active || !isAllowedAdminRole(profile.role)) {
      await supabase.auth.signOut();
      setIsSubmitting(false);
      setStatus("error");
      setMessage(profileError?.message ?? "Your portal profile is not active yet. Ask an administrator to review the employee record.");
      return;
    }

    const { data: refreshed } = await supabase.auth.getSession();
    const activeSession = refreshed.session ?? session;
    const response = await fetch("/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: activeSession.access_token,
        refresh_token: activeSession.refresh_token,
        expires_in: activeSession.expires_in,
      }),
    });

    if (!response.ok) {
      setIsSubmitting(false);
      setStatus("error");
      setMessage("Your password was saved, but the secure portal session could not be created. Please sign in with your new password.");
      return;
    }

    setStatus("done");
    window.location.replace("/");
  }

  if (status === "checking") {
    return <BlockingWorkPanel title="Opening invitation" detail="Preparing your secure first login." />;
  }

  if (status === "expired" || status === "error") {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
        <p className="font-semibold">This invitation link cannot be used.</p>
        <p className="mt-1 text-[12px] leading-5">{message}</p>
        <a className="mt-4 inline-flex rounded-xl bg-[#071D49] px-4 py-2 text-[12px] font-semibold text-white" href="/login">
          Go to sign in
        </a>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="rounded-2xl border border-[#D7E6F5] bg-[#F8FBFF] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#607086]">Portal invitation</p>
        <p className="mt-1 text-[14px] font-semibold text-[#071D49]">{email || "Invited employee"}</p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="password">Create password</label>
        <input
          id="password"
          type="password"
          className="rounded-xl border border-[#CAD7E6] px-4 py-3 text-sm outline-none focus:border-[#071D49] focus:ring-2 focus:ring-[#071D49]/10"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isSubmitting}
          required
          minLength={8}
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="confirm-password">Confirm password</label>
        <input
          id="confirm-password"
          type="password"
          className="rounded-xl border border-[#CAD7E6] px-4 py-3 text-sm outline-none focus:border-[#071D49] focus:ring-2 focus:ring-[#071D49]/10"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={isSubmitting}
          required
          minLength={8}
        />
      </div>

      {message ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}
      {isSubmitting ? <BlockingWorkPanel title="Activating account" detail="Saving your password and opening the portal." /> : null}

      <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy-700 px-4 py-3 text-sm font-semibold text-white hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting}>
        {isSubmitting ? <InsureItButtonLoader label="Activating" /> : "Activate portal access"}
      </button>
    </form>
  );
}
