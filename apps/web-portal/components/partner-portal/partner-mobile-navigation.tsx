"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  Activity,
  BadgeIndianRupee,
  BriefcaseBusiness,
  ClipboardList,
  FileInput,
  LifeBuoy,
  Menu,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";

const items = [
  { href: "/partner", label: "Home", icon: BriefcaseBusiness },
  { href: "/partner/business", label: "My Business", icon: BriefcaseBusiness },
  { href: "/partner/customers", label: "Customers", icon: UsersRound },
  { href: "/partner/policies", label: "Policies", icon: ShieldCheck },
  { href: "/partner/renewals", label: "Renewals", icon: RefreshCw },
  { href: "/partner/claims", label: "Claims", icon: ClipboardList },
  { href: "/partner/policy-intakes", label: "Policy Intake", icon: FileInput },
  { href: "/partner/payout", label: "Payout", icon: BadgeIndianRupee },
  { href: "/partner/network", label: "Network", icon: Network },
  { href: "/partner/search", label: "Search", icon: Search },
  { href: "/partner/activity", label: "Activity", icon: Activity },
  { href: "/partner/account", label: "Account", icon: UserRound },
  { href: "/partner/support", label: "Support", icon: LifeBuoy },
];

function activeFor(pathname: string, href: string) {
  if (href === "/partner") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PartnerMobileNavigation() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);

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
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = activeFor(pathname, item.href);
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
                      <Icon className="h-4 w-4" />
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
