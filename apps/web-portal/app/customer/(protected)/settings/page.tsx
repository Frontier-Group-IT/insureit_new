"use client";

import Link from "next/link";
import { ChevronRight, FileText, Headphones, Loader2, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useState } from "react";

const accountLinks = [
  { href: "/customer/profile", title: "My Profile", detail: "View and update your personal information", Icon: UserRound },
  { href: "/customer/profile#customer-profile-vault", title: "My Documents", detail: "Access your secure document vault", Icon: FileText },
  { href: "/customer/support", title: "Help & Support", detail: "Get assistance or track support requests", Icon: Headphones },
];

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
    <div className="space-y-4 sm:space-y-5">
      <section className="relative isolate overflow-hidden rounded-2xl bg-[#061B3B] text-white">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[65%] bg-[radial-gradient(ellipse_at_80%_40%,#3299FF_0%,#1155A0_42%,transparent_75%)] opacity-85" />
        <div className="pointer-events-none absolute -bottom-32 right-[12%] h-72 w-72 rounded-full border-[45px] border-[#80C7FF]/10" />
        <div className="relative flex min-h-[175px] items-center justify-between gap-4 px-5 py-6 sm:px-8">
          <div className="max-w-[560px]">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#A8C9F4]">Customer account</p>
            <h1 className="mt-2 text-[clamp(27px,3.5vw,40px)] font-black leading-tight">Account <span className="text-[#369BFF]">Settings</span></h1>
            <p className="mt-2 text-[12px] leading-6 text-[#E0EDFF]">Manage your profile, documents and account securely.</p>
          </div>
          <span className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white sm:flex"><Settings className="h-10 w-10" aria-hidden="true" /></span>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_8px_24px_rgba(28,50,82,.04)]" aria-labelledby="settings-account-title">
        <div className="flex items-center gap-3 border-b border-[#E5ECF5] p-4 sm:p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#E5F1FF] text-[#176BD4]"><UserRound className="h-6 w-6" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="settings-account-title" className="text-[16px] font-black text-[#10213D]">My Account</h2>
            <p className="mt-1 text-[11px] text-[#687D98]">Your personal details and documents in one place</p>
          </div>
        </div>
        <div className="divide-y divide-[#E9EEF5] px-3 sm:px-4">
          {accountLinks.map(({ href, title, detail, Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-2 py-4 transition hover:bg-[#F5F9FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#267AFF]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#176BD4]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[12px] font-black text-[#10213D]">{title}</span><span className="mt-1 block text-[10px] leading-4 text-[#71839A]">{detail}</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#7B91AE]" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_8px_24px_rgba(28,50,82,.04)]" aria-labelledby="settings-security-title">
        <div className="flex items-center gap-3 border-b border-[#E5ECF5] px-5 py-4">
          <ShieldCheck className="h-5 w-5 text-[#176BD4]" aria-hidden="true" />
          <h2 id="settings-security-title" className="text-[14px] font-black text-[#10213D]">Security & Account</h2>
        </div>
        <div className="p-3 sm:p-4">
          <button type="button" onClick={() => void signOut()} disabled={signingOut} className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-[#FFF5F5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C94848] disabled:cursor-wait disabled:opacity-60">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF0F0] text-[#B74646]">{signingOut ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <LogOut className="h-5 w-5" aria-hidden="true" />}</span>
            <span className="min-w-0 flex-1"><span className="block text-[12px] font-black text-[#B74646]">{signingOut ? "Signing out…" : "Sign Out"}</span><span className="mt-1 block text-[10px] text-[#71839A]">Securely end your current session</span></span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#B74646]" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
