"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftRight, CalendarSync, CarFront, ClipboardCheck, FileText, Headset, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Receipt, Settings, ShieldCheck, UserRound } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";

export function CustomerNavigation() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(window.localStorage.getItem("insureit:customer-sidebar-collapsed") === "1"); } catch { /* use expanded default */ }
  }, []);
  function toggleSidebar() {
    setCollapsed((previous) => {
      const next = !previous;
      try { window.localStorage.setItem("insureit:customer-sidebar-collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent("insureit:customer-sidebar-toggle", { detail: { collapsed: next } }));
      return next;
    });
  }

  const homeActive = pathname === "/customer" || pathname === "/customer/home";
  const vehiclesActive = pathname.startsWith("/customer/vehicles");
  const policiesActive = pathname.startsWith("/customer/policies");
  const renewalsActive = pathname.startsWith("/customer/renewals");
  const claimsActive = pathname.startsWith("/customer/claims");
  const exchangeActive = pathname.startsWith("/customer/exchange");
  const quoteActive = pathname.startsWith("/customer/insurance-quote");
  const challanActive = pathname.startsWith("/customer/e-challan");
  const supportActive = pathname.startsWith("/customer/support");
  const profileActive = pathname.startsWith("/customer/profile");
  const kycActive = pathname.startsWith("/customer/kyc");
  const documentsActive = pathname.startsWith("/customer/documents");
  const settingsActive = pathname.startsWith("/customer/settings");

  return (
    <>
      <aside className={`fixed inset-y-0 left-0 z-50 hidden border-r border-white/10 bg-[#111A35] text-white transition-[width] duration-200 lg:flex lg:flex-col ${collapsed ? "w-16" : "w-[248px]"}`}>
        <div className={`flex h-[78px] items-center border-b border-white/10 ${collapsed ? "justify-center px-1" : "justify-between pl-5 pr-2"}`}>
          {!collapsed && <Link href="/customer/home" aria-label="INSUREIT Customer home"><BrandLockup compact inverse /></Link>}
          <button type="button" onClick={toggleSidebar} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/85 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>
        <nav className={`flex-1 overflow-y-auto py-5 ${collapsed ? "px-2" : "px-3.5"}`} aria-label="Customer navigation">
          <p className={collapsed ? "sr-only" : "mb-2 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/55"}>Customer</p>
          <div className="space-y-1.5">
            <Link title={collapsed ? "Home" : undefined} aria-label="Home" href="/customer/home" className={`flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${homeActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><LayoutDashboard className="h-[17px] w-[17px]" /></span>
              {!collapsed && <span>Home</span>}
            </Link>
            <Link title={collapsed ? "Vehicles" : undefined} aria-label="Vehicles" href="/customer/vehicles" className={`flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${vehiclesActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><CarFront className="h-[17px] w-[17px]" /></span>{!collapsed && <span>Vehicles</span>}</Link>
            <Link title={collapsed ? "Policies" : undefined} aria-label="Policies" href="/customer/policies" className={`flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${policiesActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><ShieldCheck className="h-[17px] w-[17px]" /></span>{!collapsed && <span>Policies</span>}</Link>
            <Link title={collapsed ? "Renewals" : undefined} aria-label="Renewals" href="/customer/renewals" className={`flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${renewalsActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><CalendarSync className="h-[17px] w-[17px]" /></span>{!collapsed && <span>Renewals</span>}</Link>
            <Link title={collapsed ? "Claims" : undefined} aria-label="Claims" href="/customer/claims" className={`flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${claimsActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><ClipboardCheck className="h-[17px] w-[17px]" /></span>{!collapsed && <span>Claims</span>}</Link>
            <Link title={collapsed ? "Exchange" : undefined} aria-label="Exchange" href="/customer/exchange" className={`flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${exchangeActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><ArrowLeftRight className="h-[17px] w-[17px]" /></span>{!collapsed && <span>Exchange</span>}</Link>
            <Link title={collapsed ? "Insurance Quote" : undefined} aria-label="Insurance Quote" href="/customer/insurance-quote" className={`flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${quoteActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><FileText className="h-[17px] w-[17px]" /></span>{!collapsed && <span>Insurance Quote</span>}</Link>
            <Link title={collapsed ? "E-Challan" : undefined} aria-label="E-Challan" href="/customer/e-challan" className={`flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${challanActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><Receipt className="h-[17px] w-[17px]" /></span>{!collapsed && <span>E-Challan</span>}</Link>
            <Link title={collapsed ? "Support" : undefined} aria-label="Support" href="/customer/support" className={`flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${supportActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><Headset className="h-[17px] w-[17px]" /></span>{!collapsed && <span>Support</span>}</Link>
            <p className={collapsed ? "sr-only" : "mb-1 mt-4 px-3 text-[8px] font-black uppercase tracking-[0.18em] text-white/45"}>Account</p>
            <Link title={collapsed ? "Profile" : undefined} aria-label="Profile" href="/customer/profile" className={`flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${profileActive ? "bg-white text-[#141D3B]" : "text-white/88 hover:bg-white/10"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#2F63E9] text-white"><UserRound className="h-[17px] w-[17px]" /></span>{!collapsed && <span>Profile</span>}</Link>
          </div>
        </nav>
        <div className={`border-t border-white/10 ${collapsed ? "p-2" : "p-3.5"}`}>
          <Link title={collapsed ? "Settings" : undefined} aria-label="Settings" href="/customer/settings" className={`flex min-h-11 w-full items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-left text-[12px] font-bold transition ${settingsActive ? "bg-white text-[#141D3B]" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
            <Settings className="h-4 w-4" />
            {!collapsed && <span>Settings</span>}
          </Link>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#D7DEE8] bg-white/95 px-2 py-2 backdrop-blur lg:hidden" aria-label="Customer mobile navigation">
        <div className="mx-auto flex max-w-full gap-1 overflow-x-auto">
          <Link href="/customer/home" className={`flex min-w-[62px] flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-bold ${homeActive ? "bg-[#EEF4FF] text-[#174EA6]" : "text-[#53627A]"}`}><LayoutDashboard className="h-[18px] w-[18px]" /> Home</Link>
          <Link href="/customer/vehicles" className={`flex min-w-[62px] flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-bold ${vehiclesActive ? "bg-[#EEF4FF] text-[#174EA6]" : "text-[#53627A]"}`}><CarFront className="h-[18px] w-[18px]" /> Vehicles</Link>
          <Link href="/customer/policies" className={`flex min-w-[62px] flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-bold ${policiesActive ? "bg-[#EEF4FF] text-[#174EA6]" : "text-[#53627A]"}`}><ShieldCheck className="h-[18px] w-[18px]" /> Policies</Link>
          <Link href="/customer/renewals" className={`flex min-w-[62px] flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-bold ${renewalsActive ? "bg-[#EEF4FF] text-[#174EA6]" : "text-[#53627A]"}`}><CalendarSync className="h-[18px] w-[18px]" /> Renewals</Link>
          <Link href="/customer/claims" className={`flex min-w-[62px] flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-bold ${claimsActive ? "bg-[#EEF4FF] text-[#174EA6]" : "text-[#53627A]"}`}><ClipboardCheck className="h-[18px] w-[18px]" /> Claims</Link>
          <Link href="/customer/exchange" className={`flex min-w-[62px] flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-bold ${exchangeActive ? "bg-[#EEF4FF] text-[#174EA6]" : "text-[#53627A]"}`}><ArrowLeftRight className="h-[18px] w-[18px]" /> Exchange</Link>
          <Link href="/customer/support" className={`flex min-w-[62px] flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-bold ${supportActive || quoteActive || challanActive ? "bg-[#EEF4FF] text-[#174EA6]" : "text-[#53627A]"}`}><Headset className="h-[18px] w-[18px]" /> Support</Link>
          <Link href="/customer/profile" className={`flex min-w-[62px] flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-bold ${profileActive || kycActive || documentsActive ? "bg-[#EEF4FF] text-[#174EA6]" : "text-[#53627A]"}`}><UserRound className="h-[18px] w-[18px]" /> Profile</Link>
        </div>
      </nav>
    </>
  );
}