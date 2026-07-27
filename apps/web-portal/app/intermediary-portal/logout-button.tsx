"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

export function IntermediaryLogoutButton() {
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    await fetch("/auth/session", { method: "DELETE" });
    await createClient().auth.signOut();
    window.location.replace("/login");
  }
  return <button type="button" onClick={signOut} disabled={busy} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[11px] font-semibold text-[#334155] disabled:opacity-50">{busy ? "Signing out…" : "Sign out"}</button>;
}
