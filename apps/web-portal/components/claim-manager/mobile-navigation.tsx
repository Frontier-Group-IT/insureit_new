"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckSquare2, FileChartColumn, FileCheck2, Gauge, Menu, Settings, ShieldCheck, Sparkles, UsersRound, X } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";

const primaryItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/claims", label: "Claims", icon: ShieldCheck },
  { href: "/customers", label: "Customers", icon: UsersRound },
  { href: "/intermediaries", label: "Distribution Network", icon: Sparkles },
  { href: "/customers/posp-misp", label: "Intermediary Onboarding", icon: FileCheck2 },
  { href: "/tasks", label: "Tasks", icon: CheckSquare2 },
];

const secondaryItems = [
  { href: "/customers/applications", label: "Customer KYC", icon: FileCheck2 },
  { href: "/employees", label: "Employees", icon: UsersRound },
  { href: "/vehicles", label: "Vehicles", icon: Gauge },
  { href: "/policies", label: "Policies", icon: ShieldCheck },
  { href: "/reports", label: "Reports", icon: FileChartColumn },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); trigger?.focus(); };
  }, [open]);

  const drawer = open && mounted ? createPortal(
    <div className="fixed inset-0 isolate lg:hidden" style={{ zIndex: 2147483647 }} role="dialog" aria-modal="true" aria-label="Workspace navigation">
      <button className="absolute inset-0 h-full w-full bg-[#081127]/78 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close navigation" />
      <aside ref={panelRef} id="mobile-workspace-navigation" className="fixed inset-y-0 left-0 flex h-[100dvh] w-[min(88vw,360px)] flex-col overflow-hidden bg-[#111a35] text-white shadow-[24px_0_70px_rgba(0,0,0,.5)] animate-portal-enter">
        <div className="flex h-[74px] shrink-0 items-center justify-between border-b border-white/10 px-4"><BrandLockup compact inverse /><button ref={closeRef} type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-white" aria-label="Close navigation"><X className="h-5 w-5" /></button></div>
        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4" aria-label="Mobile workspace navigation">
          <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">My work</p>
          <div className="space-y-1.5">{primaryItems.map((item) => <MobileNavItem key={item.href} {...item} active={isActive(pathname, item.href)} />)}</div>
          <p className="mb-2 mt-6 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">More workspaces</p>
          <div className="space-y-1.5">{secondaryItems.map((item) => <MobileNavItem key={item.href} {...item} active={isActive(pathname, item.href)} />)}</div>
          <div className="h-[max(1rem,env(safe-area-inset-bottom))]" />
        </nav>
      </aside>
    </div>, document.body
  ) : null;

  return <><button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#dbe2ec] bg-white text-[#1b2b49] shadow-[0_8px_24px_rgba(28,39,68,.08)] lg:hidden" aria-label="Open workspace navigation" aria-expanded={open} aria-controls="mobile-workspace-navigation"><Menu className="h-5 w-5" /></button>{drawer}</>;
}

function MobileNavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Gauge; active: boolean }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-2xl px-3.5 text-[14px] font-bold ${active ? "bg-white text-[#17213e] shadow-[0_12px_28px_rgba(0,0,0,.2)]" : "text-[#D7DDF0] hover:bg-white/8 hover:text-white"}`}><span className={`grid h-9 w-9 place-items-center rounded-xl ${active ? "bg-gradient-to-br from-[#6759ff] to-[#17c7c9] text-white" : "bg-white/10 text-white"}`}><Icon className="h-[18px] w-[18px]" /></span><span>{label}</span></Link>;
}

function isActive(pathname: string, href: string) { if (href === "/dashboard") return pathname === href; return pathname === href || pathname.startsWith(`${href}/`); }
