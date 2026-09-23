"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { AuthPortalShell } from "@/components/auth-portal-shell";
import { createClient } from "@/lib/supabase";

type RecoveryStatus = "checking" | "ready" | "saving" | "done" | "error";

function readAuthRedirectError() {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return hash.get("error_description") ?? query.get("error_description") ?? hash.get("error") ?? query.get("error");
}

function hasRecoveryMarker() {
  if (typeof window === "undefined") return false;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return hash.get("type") === "recovery" || query.get("type") === "recovery" || Boolean(query.get("code"));
}

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<RecoveryStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("Validating your password reset link...");

  useEffect(() => {
    let active = true;
    let recoveryEventSeen = false;

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        recoveryEventSeen = true;
        setStatus("ready");
        setMessage("");
      }
    });

    async function prepareRecovery() {
      const redirectError = readAuthRedirectError();
      if (redirectError) {
        if (active) {
          setStatus("error");
          setMessage(redirectError);
        }
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const recoveryMarker = hasRecoveryMarker();

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) {
            setStatus("error");
            setMessage(exchangeError.message);
          }
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error || !data.session) {
        setStatus("error");
        setMessage(error?.message ?? "This password reset link is invalid or has expired. Request a new reset email.");
        return;
      }

      if (!recoveryMarker && !recoveryEventSeen) {
        setStatus("error");
        setMessage("Open the latest password reset link from your email before creating a new password.");
        return;
      }

      window.history.replaceState({}, document.title, window.location.pathname);
      setStatus("ready");
      setMessage("");
    }

    const timer = window.setTimeout(() => void prepareRecovery(), 100);
    return () => {
      active = false;
      window.clearTimeout(timer);
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (status !== "ready") {
      setStatus("error");
      setMessage("The password reset session is not ready. Open the latest reset email and try again.");
      return;
    }
    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setStatus("saving");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setStatus("ready");
      setMessage(updateError.message);
      return;
    }

    window.history.replaceState({}, document.title, window.location.pathname);
    setPassword("");
    setConfirmPassword("");
    setStatus("done");
    setMessage("Your password has been updated. Sign in with the new password.");
  }

  return (
    <AuthPortalShell
      icon={<KeyRound className="h-5 w-5" />}
      title="Create a new password"
      subtitle="Choose a secure password for your InsureIT workspace."
    >
      {status === "checking" ? (
        <div className="rounded-2xl border border-[#DCE5EF] bg-[#F8FAFC] p-4 text-center text-sm font-medium text-[#334155]">
          Validating your password reset link...
        </div>
      ) : null}

      {status === "error" ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">This password reset link cannot be used.</p>
          <p className="mt-1 text-[12px] leading-5">{message}</p>
          <Link className="mt-4 inline-flex rounded-xl bg-[#071D49] px-4 py-2 text-[12px] font-semibold text-white" href="/forgot-password">
            Request a new reset link
          </Link>
        </div>
      ) : null}

      {status === "ready" || status === "saving" ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} disabled={status === "saving"} />
          <PasswordField id="confirm-password" label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} disabled={status === "saving"} />
          {message ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-semibold text-red-700">{message}</p> : null}
          <button type="submit" disabled={status === "saving"} className="inline-flex w-full items-center justify-center rounded-xl bg-[#071D49] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0F2A55] disabled:opacity-60">
            {status === "saving" ? "Updating password…" : "Update password"}
          </button>
        </form>
      ) : null}

      {status === "done" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <p className="font-semibold">Password updated successfully.</p>
          <p className="mt-1 text-[12px] leading-5">{message}</p>
          <Link className="mt-4 inline-flex rounded-xl bg-[#071D49] px-4 py-2 text-[12px] font-semibold text-white" href="/login">
            Go to sign in
          </Link>
        </div>
      ) : null}

      {status !== "done" ? (
        <div className="mt-5 flex justify-center">
          <Link href="/login" className="text-[11px] font-bold text-[#071D49] hover:text-[#635BFF]">Back to sign in</Link>
        </div>
      ) : null}
    </AuthPortalShell>
  );
}

function PasswordField({ id, label, value, onChange, visible, onToggle, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void; disabled: boolean }) {
  return <div className="grid gap-2"><label htmlFor={id}>{label}</label><div className="relative"><input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} minLength={8} required disabled={disabled} className="w-full pr-12" placeholder="At least 8 characters" autoComplete="new-password" /><button type="button" onClick={onToggle} disabled={disabled} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#53627A] hover:text-[#071D49]" aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}</button></div></div>;
}
