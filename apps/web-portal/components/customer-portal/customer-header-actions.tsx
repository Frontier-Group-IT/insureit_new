"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, LogOut, Monitor, Sun, Moon } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { CustomerAvatar } from "./customer-avatar";
import { customerNavigationPreferenceKey, customerNavigationPreferenceEvent } from "./customer-sidebar-shell";
import { customerThemeKey, customerThemeEvent, readCustomerTheme, type CustomerTheme } from "./customer-theme";

export function CustomerHeaderActions({ name, userId }: { name: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<CustomerTheme>("light");
  const [navigationLayout, setNavigationLayout] = useState<"sidebar" | "top">("sidebar");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [open]);
  useEffect(() => {
    function readPreferences() {
      setTheme(readCustomerTheme());
      try { setNavigationLayout(window.localStorage.getItem(customerNavigationPreferenceKey) === "top" ? "top" : "sidebar"); } catch { /* keep current preference */ }
    }
    const onTheme = (event: Event) => {
      const next = (event as CustomEvent<CustomerTheme>).detail;
      if (next === "system" || next === "light" || next === "dark") setTheme(next);
    };
    const onLayout = (event: Event) => {
      const next = (event as CustomEvent<{ layout?: "sidebar" | "top" }>).detail?.layout;
      if (next === "sidebar" || next === "top") setNavigationLayout(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === customerThemeKey || event.key === customerNavigationPreferenceKey) readPreferences();
    };
    readPreferences();
    window.addEventListener(customerThemeEvent, onTheme);
    window.addEventListener(customerNavigationPreferenceEvent, onLayout);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(customerThemeEvent, onTheme);
      window.removeEventListener(customerNavigationPreferenceEvent, onLayout);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function setPreferredTheme(next: CustomerTheme) {
    setTheme(next);
    try { window.localStorage.setItem(customerThemeKey, next); } catch { /* session only */ }
    window.dispatchEvent(new CustomEvent(customerThemeEvent, { detail: next }));
  }
  function setPreferredLayout(next: "sidebar" | "top") {
    setNavigationLayout(next);
    try { window.localStorage.setItem(customerNavigationPreferenceKey, next); } catch { /* session only */ }
    window.dispatchEvent(new CustomEvent(customerNavigationPreferenceEvent, { detail: { layout: next } }));
  }

  const initial = name.trim().charAt(0).toUpperCase() || "C";

  async function signOut() {
    await createClient().auth.signOut();
    await fetch("/api/customer/auth/session", { method: "DELETE" });
    window.location.href = "/customer/login";
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/customer/support" aria-label="Customer updates and support" title="Updates and support" className="customer-header-notification customer-motion-icon relative grid h-10 w-10 place-items-center rounded-xl bg-[#F3F4FF] text-[#152550] hover:bg-[#EDEBFF]">
        <Bell className="h-5 w-5" />
        <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border border-white bg-[#F53C77]" aria-hidden="true" />
      </Link>
      <span className="customer-header-action-divider h-8 w-px bg-[#D2DAE7]" aria-hidden="true" />
      <div ref={menuRef} className="relative">
        <button type="button" aria-label="Open customer profile menu" aria-expanded={open} onClick={() => setOpen(!open)} className="customer-motion-icon grid h-11 w-11 place-items-center rounded-full bg-[#633BF5] text-base font-bold text-white shadow-[0_4px_12px_rgba(95,61,245,.18)]">{initial}</button><button type="button" className="ref-home-profile-name hidden" aria-label="Open customer profile menu" aria-expanded={open} onClick={()=>setOpen(!open)}>{name} <ChevronRight className="h-4 w-4 rotate-90"/></button>
        {open ? (
          <>
            <div className="customer-profile-preference-menu customer-motion-menu absolute right-0 top-14 z-50 max-h-[calc(100dvh-84px)] overflow-y-auto w-[min(320px,calc(100vw-24px))] rounded-3xl border border-[#DBE4F0] bg-white shadow-[0_20px_50px_rgba(15,32,57,0.17)]">
              <div className="flex items-center gap-3 border-b border-[#EDF1F6] px-4 py-4 hover:bg-[#F6F9FD]">
                <CustomerAvatar userId={userId} />
                <Link href="/customer/profile" onClick={() => setOpen(false)} className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#142746]">{name}</span><span className="text-xs text-[#78869A]">View user details</span></Link>
              </div>
              <Link href="/customer/profile" onClick={() => setOpen(false)} className="flex items-center justify-between px-5 py-4 text-sm font-semibold text-[#142746] hover:bg-[#F6F9FD]">Profile & account <ChevronRight className="h-4 w-4" /></Link>
              <div className="customer-popup-preferences space-y-3 border-y border-[#EAE5F4] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[#292655]">Theme</span>
                  <div role="group" aria-label="Color theme" className="customer-theme-segment customer-popup-theme-segment rounded-full border border-[#EAE5F4] p-1">
                    {([{ value: "system", label: "System theme", icon: Monitor }, { value: "light", label: "Light theme", icon: Sun }, { value: "dark", label: "Dark theme", icon: Moon }] as const).map(({ value, label, icon: Icon }) => (
                      <button key={value} type="button" title={label} aria-label={label} aria-pressed={theme === value} onClick={() => setPreferredTheme(value)} className="customer-appearance-option grid h-8 w-8 place-items-center rounded-full border border-transparent text-[#733BD4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7843DC]"><Icon className="h-4 w-4" aria-hidden="true" /></button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-[#292655]">Appearance &amp; Layout</p>
                  <div role="group" aria-label="Navigation layout" className="grid grid-cols-2 gap-2">
                    {([{ value: "sidebar", label: "Sidebar" }, { value: "top", label: "Top Menu" }] as const).map(({ value, label }) => (
                      <button key={value} type="button" aria-pressed={navigationLayout === value} onClick={() => setPreferredLayout(value)} className="customer-appearance-option min-h-9 rounded-lg border border-[#EAE5F4] bg-[#F6F8FB] px-2 text-xs font-semibold text-[#292655] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7843DC]">{label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => void signOut()} className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-red-600 hover:bg-red-50">Logout <LogOut className="h-4 w-4" /></button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
