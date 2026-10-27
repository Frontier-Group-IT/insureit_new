"use client";

import Link from "next/link";
import { ChevronRight, FileText, Headphones, Loader2, LogOut, Settings, ShieldCheck, UserRound, PanelLeft, PanelTop } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { customerNavigationPreferenceEvent, customerNavigationPreferenceKey } from "@/components/customer-portal/customer-sidebar-shell";

const accountLinks = [
  { href: "/customer/profile", title: "My Profile", detail: "View and update your personal information", Icon: UserRound },
  { href: "/customer/profile#customer-profile-vault", title: "My Documents", detail: "Access and manage your important documents.", Icon: FileText },
  { href: "/customer/support", title: "Help & Support", detail: "Get assistance or track your support request.", Icon: Headphones },
];

export default function CustomerSettingsPage() {
  const [signingOut, setSigningOut] = useState(false);
  const [navigationLayout, setNavigationLayout] = useState<"sidebar" | "top">("sidebar");
  useEffect(() => {
    try { setNavigationLayout(window.localStorage.getItem(customerNavigationPreferenceKey) === "top" ? "top" : "sidebar"); } catch { /* keep sidebar */ }
  }, []);
  function setPreferredLayout(next: "sidebar" | "top") {
    setNavigationLayout(next);
    try { window.localStorage.setItem(customerNavigationPreferenceKey, next); } catch { /* session only */ }
    window.dispatchEvent(new CustomEvent(customerNavigationPreferenceEvent, { detail: { layout: next } }));
  }

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
      <section className="relative isolate overflow-hidden rounded-xl border border-[#E4E8F1] bg-white">
        <div className="relative flex min-h-[120px] items-center gap-5 px-5 py-5 sm:min-h-[140px] sm:px-6">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#9A66EC] to-[#5724C7] text-white shadow-sm"><Settings className="h-9 w-9" aria-hidden="true" /></span>
          <span aria-hidden="true" className="h-16 w-px shrink-0 bg-[#B8A7DF]" />
          <div className="max-w-[440px]">
            <h1 className="text-[clamp(22px,2.3vw,29px)] font-extrabold leading-tight text-[#29265B]">Account Settings</h1>
            <p className="mt-1.5 max-w-[320px] text-[12px] leading-4 text-[#777896]">Manage your account and keep your information up to date.</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#EAE5F4] bg-white p-3 shadow-[0_4px_20px_rgba(91,62,143,.035)]" aria-labelledby="settings-account-title">
        <div className="flex items-center gap-3 px-1 pb-3 pt-1">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F0E9FF] text-[#733BD4]"><UserRound className="h-6 w-6" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="settings-account-title" className="text-[15px] font-bold text-[#292655]">My Account</h2>
            <p className="mt-1 text-[11px] text-[#8683A2]">Manage your personal and account information</p>
          </div>
        </div>
        <div className="space-y-2">
          {accountLinks.map(({ href, title, detail, Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 rounded-lg border border-[#EAE5F4] bg-white px-3 py-2.5 transition hover:bg-[#F8F6FE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7843DC]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EAE0FF] text-[#753CD4]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-[#292655]">{title}</span><span className="mt-1 block text-[10px] leading-4 text-[#8783A0]">{detail}</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#7842DA]" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="settings-layout-title" className="rounded-xl border border-[#EAE5F4] bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-[#733BD4]"><PanelLeft className="h-5 w-5" /><h2 id="settings-layout-title" className="text-[15px] font-bold text-[#292655]">Appearance &amp; Layout</h2></div>
        <p className="mb-4 text-[11px] text-[#8683A2]">Choose your preferred Customer Portal navigation layout.</p>
        <div role="group" aria-label="Navigation layout" className="grid gap-3 sm:grid-cols-2">
          <button type="button" aria-pressed={navigationLayout === "sidebar"} onClick={() => setPreferredLayout("sidebar")} className={"flex items-center gap-3 rounded-xl border p-4 text-left transition " + (navigationLayout === "sidebar" ? "border-[#7950DA] bg-white ring-1 ring-[#7950DA]/20" : "border-[#EAE5F4] hover:bg-[#F8F5FF]")}>
            <PanelLeft className="h-7 w-7 shrink-0 text-[#733BD4]" /><span><strong className="block text-[13px] text-[#292655]">Sidebar (Default)</strong><span className="block text-[11px] text-[#8683A2]">Left navigation with comfortable content width</span></span>
          </button>
          <button type="button" aria-pressed={navigationLayout === "top"} onClick={() => setPreferredLayout("top")} className={"flex items-center gap-3 rounded-xl border p-4 text-left transition " + (navigationLayout === "top" ? "border-[#7950DA] bg-[#F3EDFF]" : "border-[#EAE5F4] hover:bg-[#F8F5FF]")}>
            <PanelTop className="h-7 w-7 shrink-0 text-[#733BD4]" /><span><strong className="block text-[13px] text-[#292655]">Top Menu Bar</strong><span className="block text-[11px] text-[#8683A2]">Horizontal navigation and full-width pages</span></span>
          </button>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-[#EAE5F4] bg-white p-3 shadow-[0_4px_20px_rgba(91,62,143,.035)]" aria-labelledby="settings-security-title">
        <div className="flex items-center gap-3 px-1 pb-3 pt-1">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F0E9FF] text-[#733BD4]"><ShieldCheck className="h-6 w-6" aria-hidden="true" /></span>
          <div><h2 id="settings-security-title" className="text-[15px] font-bold text-[#292655]">Security & Account</h2><p className="mt-1 text-[11px] text-[#8683A2]">Manage your account security and preferences</p></div>
        </div>
        <div className="">
          <button type="button" onClick={() => void signOut()} disabled={signingOut} className="flex w-full items-center gap-3 rounded-lg border border-[#EAE5F4] bg-white px-3 py-2.5 text-left transition hover:bg-[#F8F6FE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7843DC] disabled:cursor-wait disabled:opacity-60">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#FFE0F3] text-[#D23F91]">{signingOut ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <LogOut className="h-5 w-5" aria-hidden="true" />}</span>
            <span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-[#292655]">{signingOut ? "Signing out…" : "Sign Out"}</span><span className="mt-1 block text-[10px] text-[#8783A0]">Securely end your session and sign out from your account.</span></span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#7842DA]" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
