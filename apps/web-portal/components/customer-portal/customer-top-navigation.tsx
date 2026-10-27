"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BadgeIndianRupee, CalendarSync, CarFront, ChevronDown, ClipboardCheck, ClipboardPlus, FileText, Headset, Home, PanelLeftOpen, ReceiptText, Settings, ShieldCheck, Store, UserRound } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";

const primary = [
  { label: "Home", href: "/customer/home", Icon: Home },
  { label: "Vehicles", href: "/customer/vehicles", Icon: CarFront },
  { label: "Policies", href: "/customer/policies", Icon: ShieldCheck },
  { label: "Claims", href: "/customer/claims", Icon: ClipboardCheck },
  { label: "Support", href: "/customer/support", Icon: Headset },
] as const;

const menuGroups = {
  Vehicles: [
    { heading: "Your fleet", items: [
      { label: "My Vehicles", detail: "View and manage registered vehicles", href: "/customer/vehicles", Icon: CarFront },
      { label: "Add Vehicle", detail: "Register another vehicle", href: "/customer/add-vehicle", Icon: CarFront },
    ] },
    { heading: "Explore", items: [
      { label: "Vehicle Exchange", detail: "Browse vehicles on the exchange", href: "/customer/exchange", Icon: Store },
    ] },
  ],
  Policies: [
    { heading: "Your coverage", items: [
      { label: "My Policies", detail: "Review policy documents and coverage", href: "/customer/policies", Icon: ShieldCheck },
      { label: "Renewals", detail: "Check policies due for renewal", href: "/customer/renewals", Icon: CalendarSync },
    ] },
    { heading: "New business", items: [
      { label: "Insurance Quote", detail: "Request insurance pricing", href: "/customer/insurance-quote", Icon: BadgeIndianRupee },
    ] },
  ],
  Claims: [
    { heading: "Claim management", items: [
      { label: "My Claims", detail: "Track submitted claims", href: "/customer/claims", Icon: ClipboardCheck },
      { label: "Start New Claim", detail: "Report a new incident", href: "/customer/start-claim", Icon: ClipboardPlus },
    ] },
  ],
  Support: [
    { heading: "Help centre", items: [
      { label: "Support Requests", detail: "View requests and get assistance", href: "/customer/support", Icon: Headset },
      { label: "Raise New Ticket", detail: "Open the customer support page", href: "/customer/support", Icon: ClipboardPlus },
    ] },
  ],
  More: [
    { heading: "Services", items: [
      { label: "E-Challan", detail: "Check vehicle challans", href: "/customer/e-challan", Icon: ReceiptText },
      { label: "Vehicle Exchange", detail: "Browse the exchange", href: "/customer/exchange", Icon: Store },
      { label: "Insurance Quote", detail: "Get a new quote", href: "/customer/insurance-quote", Icon: BadgeIndianRupee },
    ] },
    { heading: "Your account", items: [
      { label: "Profile", detail: "Your account information", href: "/customer/profile", Icon: UserRound },
      { label: "Documents", detail: "Manage your documents", href: "/customer/documents", Icon: FileText },
      { label: "Settings", detail: "Appearance and security options", href: "/customer/settings", Icon: Settings },
    ] },
  ],
} as const;
type MenuName = keyof typeof menuGroups;
const menuNames: MenuName[] = ["Vehicles", "Policies", "Claims", "Support", "More"];

export function CustomerTopNavigation({ onSwitchToSidebar }: { onSwitchToSidebar: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const account = searchParams.get("account");
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Partial<Record<MenuName, HTMLButtonElement | null>>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  const close = () => setOpenMenu(null);
  useEffect(() => { close(); }, [pathname, searchParams]);
  useEffect(() => {
    if (!openMenu) return;
    const onOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) close();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { close(); triggerRefs.current[openMenu]?.focus(); }
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => { document.removeEventListener("pointerdown", onOutside); document.removeEventListener("keydown", onEscape); };
  }, [openMenu]);

  const hrefFor = (href: string) => account ? { pathname: href, query: { account } } : href;
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/") || (href === "/customer/home" && pathname === "/customer");
  const menuActive = (name: MenuName) => menuGroups[name].some(group => group.items.some(item => isActive(item.href)));
  const open = (name: MenuName) => setOpenMenu(name);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
      <Link href={hrefFor("/customer/home")} aria-label="INSUREIT Customer home" className="shrink-0 rounded-lg bg-transparent px-2 py-1.5" onClick={close}>
        <BrandLockup compact inverse />
      </Link>
      <button type="button" onClick={onSwitchToSidebar} title="Switch to sidebar navigation" aria-label="Switch to sidebar navigation" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/90 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
        <PanelLeftOpen className="h-[19px] w-[19px]" />
      </button>
      <div ref={rootRef} className="relative ml-auto min-w-0" onMouseLeave={close}>
        <nav aria-label="Customer top navigation" className="flex min-w-0 items-center gap-0.5 sm:gap-1">
          <Link href={hrefFor("/customer/home")} aria-current={isActive("/customer/home") ? "page" : undefined} onMouseEnter={close} onFocus={close} onClick={close}
            className={`customer-motion-nav-link hidden items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors hover:bg-white/15 xl:flex 2xl:gap-2 2xl:px-3 2xl:text-[12px] ${isActive("/customer/home") ? "bg-white/20 text-white" : "text-white/90"}`}>
            <Home className="h-[17px] w-[17px] shrink-0" /> Home
          </Link>
          {menuNames.map(name => {
            const item = primary.find(entry => entry.label === name);
            const Icon = item?.Icon;
            const isMore = name === "More";
            return <button key={name} type="button" ref={node => { triggerRefs.current[name] = node; }}
              aria-haspopup="true" aria-controls="customer-top-mega-menu" aria-expanded={openMenu === name}
              onMouseEnter={() => open(name)} onFocus={() => open(name)}
              onClick={() => setOpenMenu(current => current === name ? null : name)}
              onKeyDown={event => {
                if (event.key === "ArrowDown") { event.preventDefault(); open(name); requestAnimationFrame(() => menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus()); }
              }}
              className={`customer-motion-nav-link flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors hover:bg-white/15 2xl:gap-2 2xl:px-3 2xl:text-[12px] ${isMore ? "min-h-10 text-[12px]" : "hidden xl:flex"} ${openMenu === name || menuActive(name) ? "bg-white/20 text-white" : "text-white/90"}`}>
              {Icon ? <Icon className="h-[17px] w-[17px] shrink-0" /> : null}{name}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openMenu === name ? "rotate-180" : ""}`} />
            </button>;
          })}
        </nav>
        {openMenu ? (
          <div id="customer-top-mega-menu" ref={menuRef} onMouseEnter={() => open(openMenu)}
            className="customer-motion-menu absolute right-0 top-full z-[80] w-[min(740px,calc(100vw-24px))] pt-2 text-[#1B2C4F]">
            <div className="overflow-hidden rounded-[22px] border border-[#E6DFF7] bg-white p-4 shadow-[0_20px_55px_rgba(22,15,66,.22)] sm:p-5">
              <div className="mb-3 flex items-center justify-between border-b border-[#EEEAF7] pb-3">
                <div><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#8063CE]">INSUREIT Customer Portal</span><h2 className="text-[17px] font-extrabold text-[#452585]">{openMenu}</h2></div>
                <span className="rounded-full bg-[#F0ECFF] px-3 py-1.5 text-[10px] font-semibold text-[#6747B3]">Explore {openMenu}</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {menuGroups[openMenu].map(group => (
                  <section key={group.heading}>
                    <h3 className="mb-2 px-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-[#642DA1]">{group.heading}</h3>
                    <div className="space-y-1">
                      {group.items.map(({label,detail,href,Icon}) => (
                        <Link key={label} href={hrefFor(href)} onClick={close}
                          className="group flex items-center gap-3 rounded-xl px-2.5 py-3 outline-none transition-colors hover:bg-[#F4F0FF] focus-visible:bg-[#F4F0FF] focus-visible:ring-2 focus-visible:ring-[#A48AE9]">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F0EAFF] text-[#6844C4] group-hover:bg-white"><Icon className="h-5 w-5" /></span>
                          <span className="min-w-0 flex-1"><strong className="block text-[13px] text-[#23345D]">{label}</strong><span className="block text-[11px] leading-5 text-[#7A83A0]">{detail}</span></span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-[#8A77BB] transition-transform group-hover:translate-x-1" />
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
                {openMenu !== "More" ? <section className="sm:hidden"><h3 className="mb-2 px-2 text-[11px] font-extrabold uppercase text-[#642DA1]">Other pages</h3>{menuNames.filter(x => x !== openMenu).map(name => <button type="button" key={name} onClick={() => open(name)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-[#F4F0FF]">{name}</button>)}</section> : null}
              </div>
              {openMenu === "More" ? <div className="mt-3 border-t border-[#EEEAF7] pt-3 xl:hidden"><h3 className="mb-2 text-xs font-bold text-[#642DA1]">Main pages</h3><div className="flex flex-wrap gap-2">{primary.map(item => <Link key={item.href} href={hrefFor(item.href)} onClick={close} className="rounded-lg bg-[#F6F3FF] px-3 py-2 text-xs font-semibold text-[#443775]">{item.label}</Link>)}</div></div> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
