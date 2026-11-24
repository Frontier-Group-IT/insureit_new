"use client";

import Link from "next/link";
import { ChevronRight, Loader2, LogOut, ShieldCheck, PanelLeft, PanelTop, Sun, Moon, Monitor } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { customerNavigationPreferenceEvent, customerNavigationPreferenceKey } from "@/components/customer-portal/customer-sidebar-shell";

import { customerThemeKey, customerThemeEvent, readCustomerTheme, type CustomerTheme } from "@/components/customer-portal/customer-theme";

const accountLinks = [
  { href: "/customer/profile", title: "My Profile", detail: "View and update your personal information", icon: "profile" },
  { href: "/customer/profile#customer-profile-vault", title: "My Documents", detail: "Access and manage your important documents.", icon: "total_documents" },
  { href: "/customer/support", title: "Help & Support", detail: "Get assistance or track your support request.", icon: "help_and_support" },
];

export default function CustomerSettingsPage() {
  const [signingOut, setSigningOut] = useState(false);
  const [navigationLayout, setNavigationLayout] = useState<"sidebar" | "top">("sidebar");
  const [theme, setTheme] = useState<CustomerTheme>("light");
  useEffect(() => {
    setTheme(readCustomerTheme());
    try { setNavigationLayout(window.localStorage.getItem(customerNavigationPreferenceKey) === "top" ? "top" : "sidebar"); } catch { /* keep sidebar */ }
  }, []);
  function setPreferredLayout(next: "sidebar" | "top") {
    setNavigationLayout(next);
    try { window.localStorage.setItem(customerNavigationPreferenceKey, next); } catch { /* session only */ }
    window.dispatchEvent(new CustomEvent(customerNavigationPreferenceEvent, { detail: { layout: next } }));
  }

  function setPreferredTheme(next: CustomerTheme) {
    setTheme(next);
    try { window.localStorage.setItem(customerThemeKey, next); } catch { /* session only */ }
    window.dispatchEvent(new CustomEvent(customerThemeEvent, { detail: next }));
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
      <div className="flex min-w-0 items-center gap-3 py-2">
        <img src="/assets/customer-3d-icons/settings.png" alt="" aria-hidden="true" width={76} height={76} className="h-14 w-14 shrink-0 object-contain sm:h-[76px] sm:w-[76px]" />
        <div className="min-w-0">
          <h1 className="text-[clamp(22px,2.3vw,29px)] font-extrabold leading-tight text-[#29265B]">Account Settings</h1>
          <p className="mt-1.5 text-[12px] leading-4 text-[#777896]">Manage your account and keep your information up to date.</p>
        </div>
      </div>

      <section aria-labelledby="settings-layout-title" className="customer-appearance-panel w-full min-w-0 rounded-xl border border-[#EAE5F4] bg-white px-3 py-2.5 sm:px-4">
        <div className="flex w-full min-w-0 flex-nowrap items-center gap-3 overflow-x-auto py-0.5">
          <h2 id="settings-layout-title" className="shrink-0 whitespace-nowrap text-[13px] font-bold text-[#292655]">Appearance &amp; Layout</h2>
          <div role="group" aria-label="Navigation layout" className="flex shrink-0 flex-1 items-center justify-evenly gap-2">
            {([{ value: "sidebar", label: "Sidebar (Default)", name: "Sidebar", icon: PanelLeft }, { value: "top", label: "Top Menu Bar", name: "Top Menu", icon: PanelTop }] as const).map(({ value, label, name, icon: Icon }) => (
              <button key={value} type="button" title={label} aria-label={label} aria-pressed={navigationLayout === value} onClick={() => setPreferredLayout(value)} className="customer-appearance-option inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-3 text-[11px] font-semibold text-[#733BD4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7843DC]"><Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" /><span>{name}</span></button>
            ))}
          </div>
          <span aria-hidden="true" className="h-8 w-px shrink-0 bg-[#EAE5F4]" />
          <div role="group" aria-label="Color theme" className="flex shrink-0 flex-1 items-center justify-evenly gap-3">
            <span className="shrink-0 text-[12px] font-bold text-[#292655]">Theme</span>
            <div className="customer-theme-segment flex shrink-0 flex-1 items-center gap-1 rounded-full border border-[#EAE5F4] p-1">
              {([{ value: "light", label: "Light theme", name: "Light", icon: Sun }, { value: "dark", label: "Dark theme", name: "Dark", icon: Moon }, { value: "system", label: "System theme", name: "System", icon: Monitor }] as const).map(({ value, label, name, icon: Icon }) => (
                <button key={value} type="button" title={label} aria-label={label} aria-pressed={theme === value} onClick={() => setPreferredTheme(value)} className="customer-appearance-option inline-flex h-8 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent px-3 text-[11px] font-semibold text-[#733BD4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7843DC]"><span>{name}</span><Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" /></button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#EAE5F4] bg-white p-3 shadow-[0_4px_20px_rgba(91,62,143,.035)]" aria-labelledby="settings-account-title">
        <div className="flex items-center gap-3 px-1 pb-3 pt-1">
          <img src="/assets/customer-3d-icons/profile.png" alt="" aria-hidden="true" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <h2 id="settings-account-title" className="text-[15px] font-bold text-[#292655]">My Account</h2>
            <p className="mt-1 text-[11px] text-[#8683A2]">Manage your personal and account information</p>
          </div>
        </div>
        <div className="space-y-2">
          {accountLinks.map(({ href, title, detail, icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 rounded-lg border border-[#EAE5F4] bg-white px-3 py-2.5 transition hover:bg-[#F8F6FE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7843DC]">
              <img src={`/assets/customer-3d-icons/${icon}.png`} alt="" aria-hidden="true" width={44} height={44} className="h-11 w-11 shrink-0 object-contain" />
              <span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-[#292655]">{title}</span><span className="mt-1 block text-[10px] leading-4 text-[#8783A0]">{detail}</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#7842DA]" aria-hidden="true" />
            </Link>
          ))}
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
