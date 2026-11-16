"use client";

import { useState } from "react";
import { Headset, House } from "lucide-react";
import { createClient } from "@/lib/supabase";

export function AccessDeniedActions({ homeHref = "/", homeLabel = "Go to Home" }: { homeHref?: string; homeLabel?: string }) {
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
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href={homeHref}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#102D61] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#0C2450]"
        >
          <House className="h-[17px] w-[17px]" aria-hidden="true" />
          {homeLabel}
        </a>
        <a
          href="mailto:insureit@frontiergroup.in"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#D5DFEC] bg-white px-4 py-3 text-[13px] font-semibold text-[#14294D] transition hover:bg-[#F8FAFE]"
        >
          <Headset className="h-[17px] w-[17px]" aria-hidden="true" />
          Get Help
        </a>
      </div>
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={useAnotherAccount}
          disabled={isSigningOut}
          className="text-[12px] font-medium text-[#667993] underline-offset-2 transition hover:text-[#102D61] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSigningOut ? "Signing out..." : "Use another account"}
        </button>
      </div>
    </div>
  );
}
