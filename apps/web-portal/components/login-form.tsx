"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { createClient } from "@/lib/supabase";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setIsSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" placeholder="admin@claimbridge.example" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <div className="grid gap-2">
        <label htmlFor="password">Password</label>
        <input id="password" type="password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </div>
      {message ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}
      <button className="w-full rounded-xl bg-navy-700 px-4 py-3 text-sm font-semibold text-white hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in with Supabase Auth"}
      </button>
    </form>
  );
}
