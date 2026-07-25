"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  CheckSquare2,
  FileChartColumn,
  FileCheck2,
  Gauge,
  LayoutGrid,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";

const primaryItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/claims", label: "Claims", icon: ShieldCheck },
  { href: "/customers", label: "Customers", icon: UsersRound },
  { href: "/customers/applications", label: "KYC Applications", icon: FileCheck2 },
  { href: "/customers/posp-misp", label: "POSP / MISP", icon: Sparkles },
  { href: "/tasks", label: "Tasks", icon: CheckSquare2 },
];

const secondaryItems = [
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

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#dbe2ec] bg-white/92 text-[#1b2b49] shadow-[0_8px_24px_rgba(28,39,68,.08)] lg:hidden"
        aria-label="Open workspace navigation"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] lg:hidden" role="dialog" aria-modal="true" aria-label="Workspace navigation">
          <button className="absolute inset-0 bg-[#081127]/70 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close navigation" />
          <aside className="absolute inset-y-0 left-0 flex w-[min(88vw,360px)] flex-col overflow-hidden bg-[#111a35] text-white shadow-[24px_0_70px_rgba(0,0,0,.4)] animate-portal-enter">
            <div className="flex h-[74px] items-center justify-between border-b border-white/10 px-4">
              <BrandLockup compact />
              <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-white" aria-label="Close navigation">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">My work</p>
              <div className="space-y-1.5">
                {primaryItems.map((item) => <MobileNavItem key={item.href} {...item} active={isActive(pathname, item.href)} />)}
              </div>

              <p className="mb-2 mt-6 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">More workspaces</p>
              <div className="space-y-1.5">
                {secondaryItems.map((item) => <MobileNavItem key={item.href} {...item} active={isActive(pathname, item.href)} />)}
              </div>
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function MobileNavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Gauge; active: boolean }) {
  return (
    <Link href={href} className={`flex min-h-12 items-center gap-3 rounded-2xl px-3.5 text-[14px] font-bold ${active ? "bg-white text-[#17213e] shadow-[0_12px_28px_rgba(0,0,0,.2)]" : "text-white/72 hover:bg-white/8 hover:text-white"}`}>
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${active ? "bg-gradient-to-br from-[#6759ff] to-[#17c7c9] text-white" : "bg-white/8"}`}><Icon className="h-4.5 w-4.5" /></span>
      <span>{label}</span>
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
