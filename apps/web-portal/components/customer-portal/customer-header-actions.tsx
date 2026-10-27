"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { CustomerAvatar } from "./customer-avatar";

export function CustomerHeaderActions({ name, userId }: { name: string; userId: string }) {
  const [open, setOpen] = useState(false);
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
        <button type="button" aria-label="Open customer profile menu" aria-expanded={open} onClick={() => setOpen(!open)} className="customer-motion-icon grid h-11 w-11 place-items-center rounded-full bg-[#633BF5] text-base font-bold text-white shadow-[0_4px_12px_rgba(95,61,245,.18)]">{initial}</button>
        {open ? (
          <>
            <div className="customer-motion-menu absolute right-0 top-14 z-50 w-[min(320px,calc(100vw-24px))] rounded-3xl border border-[#DBE4F0] bg-white shadow-[0_20px_50px_rgba(15,32,57,0.17)]">
              <div className="flex items-center gap-3 border-b border-[#EDF1F6] px-4 py-4 hover:bg-[#F6F9FD]">
                <CustomerAvatar userId={userId} />
                <Link href="/customer/profile" onClick={() => setOpen(false)} className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#142746]">{name}</span><span className="text-xs text-[#78869A]">View user details</span></Link>
              </div>
              <Link href="/customer/profile" onClick={() => setOpen(false)} className="flex items-center justify-between px-5 py-4 text-sm font-semibold text-[#142746] hover:bg-[#F6F9FD]">Profile & account <ChevronRight className="h-4 w-4" /></Link>
              <button type="button" onClick={() => void signOut()} className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-red-600 hover:bg-red-50">Logout <LogOut className="h-4 w-4" /></button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
