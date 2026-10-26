"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BadgeIndianRupee, CalendarSync, CarFront, ChevronDown, ClipboardCheck, Headset, Home, PanelLeftOpen, ReceiptText, Settings, ShieldCheck, Store, UserRound } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";

const primary = [
  { label: "Home", href: "/customer/home", Icon: Home },
  { label: "Vehicles", href: "/customer/vehicles", Icon: CarFront },
  { label: "Policies", href: "/customer/policies", Icon: ShieldCheck },
  { label: "Claims", href: "/customer/claims", Icon: ClipboardCheck },
  { label: "Support", href: "/customer/support", Icon: Headset },
];
const additional = [
  { label: "Renewals", href: "/customer/renewals", Icon: CalendarSync },
  { label: "Exchange", href: "/customer/exchange", Icon: Store },
  { label: "Insurance Quote", href: "/customer/insurance-quote", Icon: BadgeIndianRupee },
  { label: "E-Challan", href: "/customer/e-challan", Icon: ReceiptText },
  { label: "Profile", href: "/customer/profile", Icon: UserRound },
  { label: "Settings", href: "/customer/settings", Icon: Settings },
];

export function CustomerTopNavigation({ onSwitchToSidebar }: { onSwitchToSidebar: () => void }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setMoreOpen(false); }, [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMoreOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMoreOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [moreOpen]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/") || (href === "/customer/home" && pathname === "/customer");
  const moreActive = additional.some((item) => isActive(item.href));

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
      <Link href="/customer/home" aria-label="INSUREIT Customer home" className="shrink-0 rounded-lg bg-white px-2 py-1.5">
        <BrandLockup compact />
      </Link>
      <button type="button" onClick={onSwitchToSidebar} title="Switch to sidebar navigation" aria-label="Switch to sidebar navigation" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/90 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
        <PanelLeftOpen className="h-[19px] w-[19px]" />
      </button>
      <nav aria-label="Customer top navigation" className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1">
        {primary.map(({ label, href, Icon }) => (
          <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined}
            className={`customer-motion-nav-link hidden items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors hover:bg-white/15 xl:flex 2xl:gap-2 2xl:px-3 2xl:text-[12px] ${isActive(href) ? "bg-white/20 text-white" : "text-white/90"}`}>
            <Icon className="h-[17px] w-[17px] shrink-0" />{label}
          </Link>
        ))}
        <div ref={menuRef} className="relative">
          <button type="button" aria-label="More customer navigation" aria-expanded={moreOpen} aria-haspopup="menu" onClick={() => setMoreOpen((open) => !open)}
            className={`flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold hover:bg-white/15 ${moreActive || moreOpen ? "bg-white/20 text-white" : "text-white/90"}`}>
            More <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
          </button>
          {moreOpen && (
            <div role="menu" aria-label="More customer pages" className="customer-motion-menu absolute right-0 top-full z-[80] mt-2 w-[240px] max-h-[min(70vh,480px)] overflow-y-auto rounded-xl border border-[#DDD9F3] bg-white p-1.5 text-[#1B2C4F] shadow-[0_18px_45px_rgba(10,20,49,0.24)]">
              <div className="xl:hidden">
                {primary.map(({ label, href, Icon }) => (
                  <Link role="menuitem" key={href} href={href} onClick={() => setMoreOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-semibold hover:bg-[#F0ECFF] ${isActive(href) ? "bg-[#F0ECFF] text-[#5638A7]" : ""}`}>
                    <Icon className="h-4 w-4" />{label}
                  </Link>
                ))}
                <div className="mx-2 my-1 border-t border-[#E5E7EB]" />
              </div>
              {additional.map(({ label, href, Icon }) => (
                <Link role="menuitem" key={href} href={href} onClick={() => setMoreOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-semibold hover:bg-[#F0ECFF] ${isActive(href) ? "bg-[#F0ECFF] text-[#5638A7]" : ""}`}>
                  <Icon className="h-4 w-4" />{label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
