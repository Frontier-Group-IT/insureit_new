"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ExternalLink, Menu, RefreshCw, X } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { PartnerCustomIcon, type PartnerCustomIconName } from "./partner-custom-icon";

const items: Array<{ href: string; label: string; icon: PartnerCustomIconName }> = [
  { href: "/partner", label: "Home", icon: "home" },
  { href: "/partner/business", label: "My Business", icon: "business" },
  { href: "/partner/customers", label: "Customers", icon: "customers" },
  { href: "/partner/policies", label: "Policies", icon: "policies" },
  { href: "/partner/renewals", label: "Renewals", icon: "renewals" },
  { href: "/partner/claims", label: "Claims", icon: "claims" },
  { href: "/partner/policy-intakes", label: "Policy Intake", icon: "policy-intake" },
  { href: "/partner/payout", label: "Payout", icon: "payout" },
  { href: "/partner/network", label: "Network", icon: "network" },
  { href: "/partner/search", label: "Search", icon: "search" },
  { href: "/partner/activity", label: "Activity", icon: "activity" },
  { href: "/partner/account", label: "Account", icon: "account" },
  { href: "/partner/support", label: "Support", icon: "support" },
];

function activeFor(pathname: string, href: string) {
  if (href === "/partner") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PartnerMobileNavigation({ hideAccount = false }: { hideAccount?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const visibleItems = hideAccount ? items.filter((item) => item.href !== "/partner/account") : items;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const drawer = open && mounted
    ? createPortal(
        <div className="fixed inset-0 isolate lg:hidden" style={{ zIndex: 2147483647 }} role="dialog" aria-modal="true" aria-label="Partner navigation">
          <button className="absolute inset-0 h-full w-full bg-[#081127]/78 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close navigation" />
          <aside className="fixed inset-y-0 left-0 flex h-[100dvh] w-[min(88vw,360px)] flex-col overflow-hidden border-r border-white/10 bg-[#111a35] text-white shadow-[24px_0_70px_rgba(0,0,0,.5)] animate-portal-enter">
            <div className="flex h-[78px] shrink-0 items-center justify-between border-b border-white/10 px-4">
              <BrandLockup compact inverse />
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45" aria-label="Close navigation">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4">
              <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/55">Partner Workspace</p>
              <div className="space-y-1.5">
                {visibleItems.map((item) => {
                  const active = activeFor(pathname, item.href);

                  if (item.href === "/partner/renewals") {
                    const internalActive = pathname === "/partner/renewals";
                    const externalActive = pathname.startsWith("/partner/renewals/external");
                    const childClass = (childActive: boolean) => `group flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition ${childActive ? "bg-white text-[#141d3b] shadow-[0_2px_10px_rgba(5,18,45,0.16)]" : "text-white/72 hover:bg-white/8 hover:text-white"}`;
                    const childIconClass = (childActive: boolean) => `grid h-6 w-6 shrink-0 place-items-center rounded-md ${childActive ? "bg-[#EAF1FF] text-[#2F70E5]" : "text-white/60 group-hover:bg-white/8 group-hover:text-white"}`;
                    return (
                      <div key={item.href}>
                        <div className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[12px] font-bold ${active ? "bg-white/8 text-white" : "text-white/88"}`}>
                          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-white/10" : "bg-white/5"}`}>
                            <PartnerCustomIcon name={item.icon} size={22} className="h-[22px] w-[22px]" />
                          </span>
                          <span>{item.label}</span>
                        </div>
                        <div className="ml-[29px] mt-1.5 border-l border-white/30 pl-3.5">
                          <div className="space-y-1">
                            <Link
                              href="/partner/renewals"
                              prefetch={false}
                              aria-current={internalActive ? "page" : undefined}
                              onClick={() => setOpen(false)}
                              className={childClass(internalActive)}
                            >
                              <span className={childIconClass(internalActive)}><RefreshCw className="h-3.5 w-3.5" /></span>
                              <span>Internal Renewal</span>
                            </Link>
                            <Link
                              href="/partner/renewals/external"
                              prefetch={false}
                              aria-current={externalActive ? "page" : undefined}
                              onClick={() => setOpen(false)}
                              className={childClass(externalActive)}
                            >
                              <span className={childIconClass(externalActive)}><ExternalLink className="h-3.5 w-3.5" /></span>
                              <span>External Renewal</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      onClick={() => setOpen(false)}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[12px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${
                        active ? "bg-white text-[#141d3b]" : "text-white/88 hover:bg-white/10"
                      }`}
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-[#EAF1FF]" : "bg-white/5"}`}>
                        <PartnerCustomIcon name={item.icon} size={22} className="h-[22px] w-[22px]" />
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </aside>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl border border-[#dbe2ec] bg-white text-[#1b2b49] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 lg:hidden" aria-label="Open Partner navigation">
        <Menu className="h-5 w-5" />
      </button>
      {drawer}
    </>
  );
}
