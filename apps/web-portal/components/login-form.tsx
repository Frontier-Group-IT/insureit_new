"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { isAllowedAdminRole } from "@/lib/auth-config";
import { safePortalReturnPath } from "@/lib/portal-routes";
import { createClient } from "@/lib/supabase";
import { BlockingWorkPanel, InsureItButtonLoader } from "@/components/loading/insureit-loader";

type CaptchaChallenge = {
  token: string;
  image: string;
};

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const searchParams = useSearchParams();
  const requestedPath = safePortalReturnPath(searchParams.get("next"));

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaAnswer("");
    setCaptchaToken("");
    setCaptchaImage("");
    try {
      const response = await fetch("/api/auth/captcha", { cache: "no-store" });
      if (!response.ok) throw new Error("Captcha unavailable");
      const challenge = await response.json() as CaptchaChallenge;
      setCaptchaToken(challenge.token);
      setCaptchaImage(challenge.image);
    } catch {
      setMessage("Captcha is temporarily unavailable. Please refresh and try again.");
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  async function verifyCaptcha() {
    if (!captchaToken || !captchaAnswer.trim()) return false;
    try {
      const response = await fetch("/api/auth/captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: captchaToken, answer: captchaAnswer }),
      });
      if (!response.ok) return false;
      const result = await response.json() as { valid?: boolean };
      return result.valid === true;
    } catch {
      return false;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!captchaAnswer.trim()) {
      setMessage("Please enter the captcha shown above.");
      return;
    }

    setIsSubmitting(true);
    const captchaValid = await verifyCaptcha();
    if (!captchaValid) {
      setIsSubmitting(false);
      setMessage("Invalid or expired captcha. Please try the new captcha.");
      await loadCaptcha();
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      setIsSubmitting(false);
      setMessage(error?.message ?? "The sign-in service did not return a valid session.");
      await loadCaptcha();
      return;
    }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("id, role, is_active").eq("id", data.user.id).maybeSingle<{ id: string; role: string; is_active: boolean }>();
    if (profileError) { setIsSubmitting(false); setMessage(profileError.message); await loadCaptcha(); return; }
    if (!profile?.is_active || !isAllowedAdminRole(profile.role)) {
      await fetch("/auth/session", { method: "DELETE" });
      await supabase.auth.signOut();
      setIsSubmitting(false);
      window.location.href = "/access-denied";
      return;
    }
    const sessionResponse = await fetch("/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_in: data.session.expires_in }) });
    if (!sessionResponse.ok) { setIsSubmitting(false); setMessage("Signed in, but could not create the secure browser session. Please try again."); await loadCaptcha(); return; }
    const nextPath = profile.role === "intermediary" ? "/partner" : requestedPath.startsWith("/partner") || requestedPath.startsWith("/intermediary-portal") ? "/dashboard" : requestedPath;
    window.location.replace(nextPath);
  }

  return <form className="space-y-4" onSubmit={handleSubmit}>
    <div className="grid gap-2"><label htmlFor="email">Email</label><input className={isSubmitting ? "opacity-40 transition-opacity" : "transition-opacity"} id="email" type="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={isSubmitting} /></div>
    <div className="grid gap-2"><label htmlFor="password">Password</label><div className="relative"><input className={`w-full pr-12 ${isSubmitting ? "opacity-40 transition-opacity" : "transition-opacity"}`} id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={isSubmitting} /><button type="button" onClick={() => setShowPassword((current) => !current)} disabled={isSubmitting} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#53627A] transition hover:text-[#071D49] disabled:opacity-40" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}</button></div></div>

    <div className="grid gap-1.5">
      <label htmlFor="captcha">Enter Captcha</label>
      <div className="overflow-hidden rounded-xl border border-dashed border-[#9AA8BA] bg-[#FBFCFE]">
        <div className="flex h-[52px] items-center justify-center">
          {captchaImage ? <img src={captchaImage} alt="Captcha challenge" className="h-full w-full object-cover" draggable={false} /> : <span className="text-xs font-medium text-[#7A8798]">{captchaLoading ? "Loading captcha..." : "Captcha unavailable"}</span>}
        </div>
        <div className="flex border-t border-[#D8E0EA] bg-white">
          <input
            id="captcha"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={5}
            placeholder="Enter captcha"
            value={captchaAnswer}
            onChange={(event) => setCaptchaAnswer(event.target.value)}
            required
            disabled={isSubmitting || captchaLoading || !captchaToken}
            className="min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 py-2 uppercase outline-none focus:ring-0 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void loadCaptcha()}
            disabled={isSubmitting || captchaLoading}
            aria-label="Refresh captcha"
            className="grid w-10 shrink-0 place-items-center border-l border-[#D8E0EA] bg-[#7D828A] text-white transition hover:bg-[#626870] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-[18px] w-[18px] ${captchaLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </div>

    <div className="flex justify-end"><Link href="/forgot-password" className="text-[11px] font-bold text-[#071D49] transition hover:text-[#635BFF] hover:underline">Forgot Password?</Link></div>
    {isSubmitting ? <BlockingWorkPanel title="Signing you in" detail="Verifying security and preparing your workspace." /> : null}
    {message ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}
    <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy-700 px-4 py-3 text-sm font-semibold text-white hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting || captchaLoading || !captchaToken}>{isSubmitting ? <InsureItButtonLoader label="Signing in" /> : "Sign in"}</button>
  </form>;
}
