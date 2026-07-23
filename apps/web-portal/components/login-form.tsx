"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { isAllowedAdminRole } from "@/lib/auth-config";
import { safePortalReturnPath } from "@/lib/portal-routes";
import { createClient } from "@/lib/supabase";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useSearchParams();
  const nextPath = safePortalReturnPath(searchParams.get("next"));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session || !data.user) {
      setIsSubmitting(false);
      setMessage(error?.message ?? "The sign-in service did not return a valid session.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", data.user.id)
      .maybeSingle<{ id: string; role: string; is_active: boolean }>();

    if (profileError) {
      setIsSubmitting(false);
      setMessage(profileError.message);
      return;
    }

    if (!profile?.is_active || !isAllowedAdminRole(profile.role)) {
      await fetch("/auth/session", { method: "DELETE" });
      await supabase.auth.signOut();
      setIsSubmitting(false);
      window.location.href = "/access-denied";
      return;
    }

    const sessionResponse = await fetch("/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in
      })
    });

    if (!sessionResponse.ok) {
      setIsSubmitting(false);
      setMessage("Signed in, but could not create the secure browser session. Please try again.");
      return;
    }

    setIsSubmitting(false);
    window.location.replace(nextPath);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <label htmlFor="email">Email</label>
        <input className={isSubmitting ? "opacity-40 transition-opacity" : "transition-opacity"} id="email" type="email" placeholder="admin@insureit.example" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={isSubmitting} />
      </div>
      <div className="grid gap-2">
        <label htmlFor="password">Password</label>
        <input className={isSubmitting ? "opacity-40 transition-opacity" : "transition-opacity"} id="password" type="password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={isSubmitting} />
      </div>
      {message ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}
      <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy-700 px-4 py-3 text-sm font-semibold text-white hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting}>
        {isSubmitting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> Signing in...</> : "Sign in"}
      </button>
    </form>
  );
}
