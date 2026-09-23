"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { AuthPortalShell } from "@/components/auth-portal-shell";
import { createClient } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    setMessage("");

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSending(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage("If this email has portal access, password reset instructions have been sent.");
  }

  return (
    <AuthPortalShell
      icon={<MailCheck className="h-5 w-5" />}
      title="Reset your password"
      subtitle="Enter your portal email and we’ll send secure reset instructions."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-2">
          <label htmlFor="recovery-email">Email</label>
          <input id="recovery-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required disabled={sending} />
        </div>
        {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-semibold text-red-700">{error}</p> : null}
        <button type="submit" disabled={sending} className="inline-flex w-full items-center justify-center rounded-xl bg-[#071D49] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0F2A55] disabled:opacity-60">
          {sending ? "Sending instructions…" : "Send reset link"}
        </button>
      </form>
      <div className="mt-5 flex justify-center">
        <Link href="/login" className="inline-flex items-center gap-2 text-[11px] font-bold text-[#071D49] hover:text-[#635BFF]">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </AuthPortalShell>
  );
}
