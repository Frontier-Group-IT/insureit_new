"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CarFront, ClipboardList, Home, LogOut, RefreshCcw, ShieldCheck } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { createClient } from "@/lib/supabase";

export function CustomerNavigation() {
  const pathname = usePathname();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await fetch("/api/customer/auth/session", { method: "DELETE" });
    window.location.href = "/customer/login";
  }

  const homeActive = pathname === "/customer" || pathname === "/customer/home";
  const vehiclesActive = pathname.startsWith("/customer/vehicles");
  const policiesActive = pathname.startsWith("/customer/policies");
  const renewalsActive = pathname.startsWith("/customer/renewals");
  const claimsActive = pathname.startsWith("/customer/claims");

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[248px] border-r border-white/10 bg-[#111A35] text-white lg:flex lg:flex-col">
        <Link href="/customer/home" className="flex h-[78px] items-center border-b border-white/10 px-5" aria-label="INSUREIT Customer home">
          <BrandLockup compact inverse />
        </Link>
        <nav className="flex-1 px-3.5 py-5" aria-label="Customer navigation">
          <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/55">Customer</p>
          <div className="space-y-1.5">
            <Link href="/customer/home" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[12px] font-bold transition ${homeActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><Home className="h-[17px] w-[17px]" /></span>
              Home
            </Link>
            <Link href="/customer/vehicles" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[12px] font-bold transition ${vehiclesActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><CarFront className="h-[17px] w-[17px]" /></span>
              Vehicles
            </Link>
            <Link href="/customer/policies" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[12px] font-bold transition ${policiesActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><ShieldCheck className="h-[17px] w-[17px]" /></span>
              Policies
            </Link>
            <Link href="/customer/renewals" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[12px] font-bold transition ${renewalsActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><RefreshCcw className="h-[17px] w-[17px]" /></span>
              Renewals
            </Link>
            <Link href="/customer/claims" className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[12px] font-bold transition ${claimsActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><ClipboardList className="h-[17px] w-[17px]" /></span>
              Claims
            </Link>
          </div>
        </nav>
        <div className="border-t border-white/10 p-3.5">
          <button type="button" onClick={() => void logout()} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-[12px] font-bold text-white/80 transition hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#D7DEE8] bg-white/95 px-4 py-2 backdrop-blur lg:hidden" aria-label="Customer mobile navigation">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          <Link href="/customer/home" className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-bold ${homeActive ? "bg-[#EEF4FF] text-[#174EA6]" : "text-[#53627A]"}`}>
            <Home className="h-4.5 w-4.5" /> Home
          </Link>
          <Link href="/customer/vehicles" className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-bold ${vehiclesActive ? "bg-[#EEF4FF] text-[#174EA6]" : "text-[#53627A]"}`}>
            <CarFront className="h-4.5 w-4.5" /> Vehicles
          </Link>
          <Link href="/customer/policies" className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-bold ${policiesActive ? "bg-[#EEF4FF] text-[#174EA6]" : "text-[#53627A]"}`}>
            <ShieldCheck className="h-4.5 w-4.5" /> Policies
          </Link>
          <Link href="/customer/renewals" className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-bold ${renewalsActive ? "bg-[#EEF4FF] text-[#174EA6]" : "text-[#53627A]"}`}>
            <RefreshCcw className="h-4.5 w-4.5" /> Renewals
          </Link>
          <Link href="/customer/claims" className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-bold ${claimsActive ? "bg-[#EEF4FF] text-[#174EA6]" : "text-[#53627A]"}`}>
            <ClipboardList className="h-4.5 w-4.5" /> Claims
          </Link>
        </div>
      </nav>
    </>
  );
}