"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, LogOut, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase";

export function CustomerHeaderActions({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "C";

  async function signOut() {
    await createClient().auth.signOut();
    await fetch("/api/customer/auth/session", { method: "DELETE" });
    window.location.href = "/customer/login";
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/customer/support" aria-label="Customer updates and support" title="Updates and support" className="grid h-10 w-10 place-items-center rounded-full border border-[#D7E3F2] bg-[#EDF4FC] text-[#142746] hover:bg-[#DFEAFA]">
        <Bell className="h-5 w-5" />
      </Link>
      <span className="h-8 w-px bg-[#D2DAE7]" aria-hidden="true" />
      <div className="relative">
        <button type="button" aria-label="Open customer profile menu" aria-expanded={open} onClick={() => setOpen(!open)} className="grid h-11 w-11 place-items-center rounded-full border-2 border-[#245A9A] bg-white text-base font-bold text-[#10213D]">{initial}</button>
        {open ? (
          <>
            <button className="fixed inset-0 z-40 cursor-default" aria-label="Close profile menu" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-14 z-50 w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-[#DBE4F0] bg-white shadow-[0_20px_50px_rgba(15,32,57,0.17)]">
              <Link href="/customer/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 border-b border-[#EDF1F6] px-4 py-4 hover:bg-[#F6F9FD]">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#EDF3FF] text-[#1A4F9D]"><UserRound className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#142746]">{name}</span><span className="text-xs text-[#78869A]">View user details</span></span>
              </Link>
              <Link href="/customer/profile" onClick={() => setOpen(false)} className="flex items-center justify-between px-5 py-4 text-sm font-semibold text-[#142746] hover:bg-[#F6F9FD]">Profile & account <ChevronRight className="h-4 w-4" /></Link>
              <button type="button" onClick={() => void signOut()} className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-red-600 hover:bg-red-50">Logout <LogOut className="h-4 w-4" /></button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
