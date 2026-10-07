"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LogOut } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { createClient } from "@/lib/supabase";

export function CustomerNavigation() {
  const pathname = usePathname();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await fetch("/customer/auth/session", { method: "DELETE" });
    window.location.href = "/customer/login";
  }

  const active = pathname === "/customer" || pathname === "/customer/home";

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[248px] border-r border-white/10 bg-[#111A35] text-white lg:flex lg:flex-col">
        <Link href="/customer/home" className="flex h-[78px] items-center border-b border-white/10 px-5" aria-label="INSUREIT Customer home">
          <BrandLockup compact inverse />
        </Link>
        <nav className="flex-1 px-3.5 py-5" aria-label="Customer navigation">
          <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/55">Customer</p>
          <Link href="/customer/home" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[12px] font-bold transition ${active ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><Home className="h-[17px] w-[17px]" /></span>
            Home
          </Link>
        </nav>
        <div className="border-t border-white/10 p-3.5">
          <button type="button" onClick={() => void logout()} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-[12px] font-bold text-white/80 transition hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#D7DEE8] bg-white/95 px-4 py-2 backdrop-blur lg:hidden" aria-label="Customer mobile navigation">
        <div className="mx-auto flex max-w-md justify-center">
          <Link href="/customer/home" className="flex min-w-[90px] flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-[11px] font-bold text-[#142746]">
            <Home className="h-5 w-5" />
            Home
          </Link>
        </div>
      </nav>
    </>
  );
}
