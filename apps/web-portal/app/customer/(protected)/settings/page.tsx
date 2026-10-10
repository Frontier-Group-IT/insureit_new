"use client";

import Link from "next/link";
import { LogOut, Settings, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useState } from "react";

export default function CustomerSettingsPage() {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      await fetch("/api/customer/auth/session", { method: "DELETE" });
      window.location.replace("/customer/login");
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-[#2454A5]" aria-hidden="true" />
        <h1 className="text-lg font-bold text-[#11264A]">Settings</h1>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#DCE5F1] bg-white shadow-sm">
        <Link href="/customer/profile" className="flex items-center gap-3 border-b border-[#E5ECF5] px-4 py-4 text-sm font-semibold text-[#15345C] transition hover:bg-[#F3F7FD]">
          <UserRound className="h-5 w-5 text-[#3466B0]" aria-hidden="true" />
          My profile
        </Link>
        <button type="button" onClick={() => void signOut()} disabled={signingOut} className="flex w-full items-center gap-3 px-4 py-4 text-left text-sm font-semibold text-[#15345C] transition hover:bg-[#F3F7FD] disabled:opacity-60">
          <LogOut className="h-5 w-5 text-[#3466B0]" aria-hidden="true" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </section>
  );
}
