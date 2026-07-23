"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

export function AccessDeniedActions() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function useAnotherAccount() {
    setIsSigningOut(true);
    const supabase = createClient();
    await Promise.allSettled([
      supabase.auth.signOut(),
      fetch("/auth/session", { method: "DELETE" })
    ]);
    window.location.replace("/login");
  }

  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
      <button
        type="button"
        onClick={useAnotherAccount}
        disabled={isSigningOut}
        className="rounded-xl bg-navy-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSigningOut ? "Signing out..." : "Sign out and use another account"}
      </button>
      <a className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" href="mailto:insureit@frontiergroup.in">
        Contact administrator
      </a>
    </div>
  );
}
