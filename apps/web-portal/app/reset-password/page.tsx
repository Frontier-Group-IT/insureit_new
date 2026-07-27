"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { createClient } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("The passwords do not match."); return; }
    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    setMessage("Your password has been updated. You can now sign in.");
    setPassword("");
    setConfirmPassword("");
  }

  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F9FF] p-4 sm:p-6">
    <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#D8EBFF]" />
    <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-96 rotate-[-12deg] rounded-[45%] bg-[#DDF6EC]" />
    <section className="relative w-full max-w-[470px] rounded-[28px] border border-[#D7E6F5] bg-white/95 px-6 py-7 shadow-[0_24px_70px_rgba(11,55,105,0.14)] backdrop-blur sm:px-9 sm:py-9">
      <div className="mb-8 flex justify-center"><BrandLockup size="hero" className="max-w-full" /></div>
      <div className="border-t border-[#E3ECF6] pt-6 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#EEF4FF] text-[#071D49]"><KeyRound className="h-5 w-5" /></span><h1 className="mt-4 text-[23px] font-extrabold tracking-[-0.025em] text-[#071D49]">Create a new password</h1><p className="mt-1.5 text-[12px] leading-5 text-[#59687A]">Choose a secure password for your InsureIT workspace.</p></div>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} disabled={saving} />
        <PasswordField id="confirm-password" label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} disabled={saving} />
        {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-semibold text-red-700">{error}</p> : null}
        <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center rounded-xl bg-[#071D49] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0F2A55] disabled:opacity-60">{saving ? "Updating password…" : "Update password"}</button>
      </form>
      <div className="mt-5 flex justify-center"><Link href="/login" className="text-[11px] font-bold text-[#071D49] hover:text-[#635BFF]">Back to sign in</Link></div>
    </section>
  </main>;
}

function PasswordField({ id, label, value, onChange, visible, onToggle, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void; disabled: boolean }) {
  return <div className="grid gap-2"><label htmlFor={id}>{label}</label><div className="relative"><input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} minLength={8} required disabled={disabled} className="w-full pr-12" placeholder="At least 8 characters" /><button type="button" onClick={onToggle} disabled={disabled} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#53627A] hover:text-[#071D49]" aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}</button></div></div>;
}
