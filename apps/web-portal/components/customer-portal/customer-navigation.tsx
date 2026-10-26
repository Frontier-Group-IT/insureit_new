"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftRight, BadgeIndianRupee, CalendarSync, CarFront, ClipboardCheck, ClipboardList, FileText, Headset, LayoutDashboard, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings, ShieldCheck, Store, UserRound } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";

export function CustomerNavigation({ mode = "sidebar" }: { mode?: "top" | "sidebar" }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hoverLabel, setHoverLabel] = useState<{ label: string; top: number } | null>(null);
  function showTooltip(label: string, target: HTMLElement) {
    if (!collapsed) return;
    const rect = target.getBoundingClientRect();
    setHoverLabel({ label, top: rect.top + rect.height / 2 });
  }
  function hideTooltip() { setHoverLabel(null); }
  useEffect(() => {
    try { setCollapsed(window.localStorage.getItem("insureit:customer-sidebar-collapsed") === "1"); } catch { /* use expanded default */ }
  }, []);
  function toggleSidebar() {
    setHoverLabel(null);
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
      {mode === "sidebar" && <aside className={`fixed inset-y-0 left-0 z-50 hidden border-r border-[#E5EAF2] bg-white text-[#172B4D] transition-[width] duration-200 lg:flex lg:flex-col ${collapsed ? "w-16" : "w-[248px]"}`}>
        <div className={`flex h-[78px] items-center border-b border-[#E5EAF2] ${collapsed ? "justify-center px-1" : "justify-between pl-5 pr-2"}`}>
          {!collapsed && <Link href="/customer/home" aria-label="INSUREIT Customer home"><BrandLockup compact /></Link>}
          <button type="button" onClick={toggleSidebar} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#53627A] hover:bg-[#EDF3FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]">
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>
        <nav className={`flex-1 overflow-y-auto py-5 ${collapsed ? "px-2" : "px-3.5"}`} aria-label="Customer navigation">
          <p className={collapsed ? "sr-only" : "mb-2 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-[#8793A7]"}>Customer</p>
          <div className="space-y-1.5">
            <Link aria-label="Home" onMouseEnter={(event) => showTooltip("Home", event.currentTarget)} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip("Home", event.currentTarget)} onBlur={hideTooltip} href="/customer/home" className={`customer-motion-sidebar-link flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${homeActive ? "bg-[#EAF1FF] text-[#194BB1]" : "text-[#172B4D] hover:bg-[#F2F6FD]"}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#4B53AE] text-white"><LayoutDashboard className="h-[18px] w-[18px]" /></span>
              {!collapsed && <span>Home</span>}
            </Link>
            <Link aria-label="Vehicles" onMouseEnter={(event) => showTooltip("Vehicles", event.currentTarget)} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip("Vehicles", event.currentTarget)} onBlur={hideTooltip} href="/customer/vehicles" className={`customer-motion-sidebar-link flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${vehiclesActive ? "bg-[#EAF1FF] text-[#194BB1]" : "text-[#172B4D] hover:bg-[#F2F6FD]"}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#4869E4] text-white"><CarFront className="h-[18px] w-[18px]" /></span>{!collapsed && <span>Vehicles</span>}</Link>
            <Link aria-label="Policies" onMouseEnter={(event) => showTooltip("Policies", event.currentTarget)} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip("Policies", event.currentTarget)} onBlur={hideTooltip} href="/customer/policies" className={`customer-motion-sidebar-link flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${policiesActive ? "bg-[#EAF1FF] text-[#194BB1]" : "text-[#172B4D] hover:bg-[#F2F6FD]"}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#FF8067] text-white"><ShieldCheck className="h-[18px] w-[18px]" /></span>{!collapsed && <span>Policies</span>}</Link>
            <Link aria-label="Renewals" onMouseEnter={(event) => showTooltip("Renewals", event.currentTarget)} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip("Renewals", event.currentTarget)} onBlur={hideTooltip} href="/customer/renewals" className={`customer-motion-sidebar-link flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${renewalsActive ? "bg-[#EAF1FF] text-[#194BB1]" : "text-[#172B4D] hover:bg-[#F2F6FD]"}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#15BDD0] text-white"><CalendarSync className="h-[18px] w-[18px]" /></span>{!collapsed && <span>Renewals</span>}</Link>
            <Link aria-label="Claims" onMouseEnter={(event) => showTooltip("Claims", event.currentTarget)} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip("Claims", event.currentTarget)} onBlur={hideTooltip} href="/customer/claims" className={`customer-motion-sidebar-link flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${claimsActive ? "bg-[#EAF1FF] text-[#194BB1]" : "text-[#172B4D] hover:bg-[#F2F6FD]"}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#20C9C3] text-white"><ClipboardCheck className="h-[18px] w-[18px]" /></span>{!collapsed && <span>Claims</span>}</Link>
            <Link aria-label="Exchange" onMouseEnter={(event) => showTooltip("Exchange", event.currentTarget)} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip("Exchange", event.currentTarget)} onBlur={hideTooltip} href="/customer/exchange" className={`customer-motion-sidebar-link flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${exchangeActive ? "bg-[#EAF1FF] text-[#194BB1]" : "text-[#172B4D] hover:bg-[#F2F6FD]"}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#0BA6D2] text-white"><Store className="h-[18px] w-[18px]" /></span>{!collapsed && <span>Exchange</span>}</Link>
            <Link aria-label="Insurance Quote" onMouseEnter={(event) => showTooltip("Insurance Quote", event.currentTarget)} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip("Insurance Quote", event.currentTarget)} onBlur={hideTooltip} href="/customer/insurance-quote" className={`customer-motion-sidebar-link flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${quoteActive ? "bg-[#EAF1FF] text-[#194BB1]" : "text-[#172B4D] hover:bg-[#F2F6FD]"}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#099F9C] text-white"><BadgeIndianRupee className="h-[18px] w-[18px]" /></span>{!collapsed && <span>Insurance Quote</span>}</Link>
            <Link aria-label="E-Challan" onMouseEnter={(event) => showTooltip("E-Challan", event.currentTarget)} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip("E-Challan", event.currentTarget)} onBlur={hideTooltip} href="/customer/e-challan" className={`customer-motion-sidebar-link flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${challanActive ? "bg-[#EAF1FF] text-[#194BB1]" : "text-[#172B4D] hover:bg-[#F2F6FD]"}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#1592D3] text-white"><ReceiptText className="h-[18px] w-[18px]" /></span>{!collapsed && <span>E-Challan</span>}</Link>
            <Link aria-label="Support" onMouseEnter={(event) => showTooltip("Support", event.currentTarget)} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip("Support", event.currentTarget)} onBlur={hideTooltip} href="/customer/support" className={`customer-motion-sidebar-link flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${supportActive ? "bg-[#EAF1FF] text-[#194BB1]" : "text-[#172B4D] hover:bg-[#F2F6FD]"}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#4B63DD] text-white"><Headset className="h-[18px] w-[18px]" /></span>{!collapsed && <span>Support</span>}</Link>
            <p className={collapsed ? "sr-only" : "mb-1 mt-4 px-3 text-[8px] font-black uppercase tracking-[0.18em] text-[#8793A7]"}>Account</p>
            <Link aria-label="Profile" onMouseEnter={(event) => showTooltip("Profile", event.currentTarget)} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip("Profile", event.currentTarget)} onBlur={hideTooltip} href="/customer/profile" className={`customer-motion-sidebar-link flex min-h-11 items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-[12px] font-bold transition ${profileActive ? "bg-[#EAF1FF] text-[#194BB1]" : "text-[#172B4D] hover:bg-[#F2F6FD]"}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#7560EE] text-white"><UserRound className="h-[18px] w-[18px]" /></span>{!collapsed && <span>Profile</span>}</Link>
          </div>
        </nav>
        <div className={`border-t border-[#E5EAF2] ${collapsed ? "p-2" : "p-3.5"}`}>
          <Link aria-label="Settings" onMouseEnter={(event) => showTooltip("Settings", event.currentTarget)} onMouseLeave={hideTooltip} onFocus={(event) => showTooltip("Settings", event.currentTarget)} onBlur={hideTooltip} href="/customer/settings" className={`customer-motion-sidebar-link flex min-h-11 w-full items-center rounded-xl ${collapsed ? "justify-center px-1" : "gap-3 px-3.5"} text-left text-[12px] font-bold transition ${settingsActive ? "bg-[#EAF1FF] text-[#194BB1]" : "text-[#172B4D] hover:bg-[#F2F6FD]"}`}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#6255E9] text-white"><Settings className="h-[18px] w-[18px]" /></span>
            {!collapsed && <span>Settings</span>}
          </Link>
        </div>
      </aside>}
      {mode === "sidebar" && collapsed && hoverLabel && (
        <div role="tooltip" className="pointer-events-none fixed left-[70px] z-[100] -translate-y-1/2 whitespace-nowrap rounded-lg border border-[#D4E2F7] bg-white px-3 py-2 text-[12px] font-bold text-[#152649] shadow-[0_8px_22px_rgba(5,15,35,0.25)]" style={{ top: hoverLabel.top }}>
          {hoverLabel.label}
        </div>
      )}


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