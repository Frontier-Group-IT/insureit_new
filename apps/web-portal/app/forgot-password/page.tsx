"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
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
    setMessage("Password reset instructions have been sent to your email address.");
  }

  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F9FF] p-4 sm:p-6">
    <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#D8EBFF]" />
    <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-96 rotate-[-12deg] rounded-[45%] bg-[#DDF6EC]" />
    <section className="relative w-full max-w-[470px] rounded-[28px] border border-[#D7E6F5] bg-white/95 px-6 py-7 shadow-[0_24px_70px_rgba(11,55,105,0.14)] backdrop-blur sm:px-9 sm:py-9">
      <div className="mb-8 flex justify-center"><BrandLockup size="hero" className="max-w-full" /></div>
      <div className="border-t border-[#E3ECF6] pt-6 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#EEF4FF] text-[#071D49]"><MailCheck className="h-5 w-5" /></span><h1 className="mt-4 text-[23px] font-extrabold tracking-[-0.025em] text-[#071D49]">Reset your password</h1><p className="mt-1.5 text-[12px] leading-5 text-[#59687A]">Enter your portal email and we’ll send secure reset instructions.</p></div>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4"><div className="grid gap-2"><label htmlFor="recovery-email">Email</label><input id="recovery-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required disabled={sending} /></div>{message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-700">{message}</p> : null}{error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-semibold text-red-700">{error}</p> : null}<button type="submit" disabled={sending} className="inline-flex w-full items-center justify-center rounded-xl bg-[#071D49] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0F2A55] disabled:opacity-60">{sending ? "Sending instructions…" : "Send reset link"}</button></form>
      <div className="mt-5 flex justify-center"><Link href="/login" className="inline-flex items-center gap-2 text-[11px] font-bold text-[#071D49] hover:text-[#635BFF]"><ArrowLeft className="h-4 w-4" />Back to sign in</Link></div>
    </section>
  </main>;
}
