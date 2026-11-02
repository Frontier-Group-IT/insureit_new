"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

export function AccessDeniedActions({ homeHref, homeLabel }: { homeHref?: string; homeLabel?: string }) {
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
    <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
      {homeHref && homeLabel ? <a href={homeHref} className="rounded-lg bg-[#17365D] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#102A4C]">{homeLabel}</a> : null}
      <button
        type="button"
        onClick={useAnotherAccount}
        disabled={isSigningOut}
        className="rounded-lg bg-navy-700 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSigningOut ? "Signing out..." : "Use another account"}
      </button>
      <a className="rounded-lg border border-slate-200 px-4 py-2.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50" href="mailto:insureit@frontiergroup.in">
        Get help
      </a>
    </div>
  );
}
