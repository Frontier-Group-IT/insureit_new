"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Gauge, Menu, Settings, Sparkles, X } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { isCurrent, navigationSections, sectionForPath } from "@/components/claim-manager/app-navigation";

export function MobileNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const resolvedSection = sectionForPath(pathname);
  const [open, setOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(resolvedSection);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => { setOpen(false); if (resolvedSection) setOpenSection(resolvedSection); }, [pathname, resolvedSection]);
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
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); trigger?.focus(); };
  }, [open]);

  const drawer = open && mounted ? createPortal(
    <div className="fixed inset-0 isolate lg:hidden" style={{ zIndex: 2147483647 }} role="dialog" aria-modal="true" aria-label="Workspace navigation">
      <button className="absolute inset-0 h-full w-full bg-[#081127]/78 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close navigation" />
      <aside ref={panelRef} id="mobile-workspace-navigation" className="fixed inset-y-0 left-0 flex h-[100dvh] w-[min(88vw,360px)] flex-col overflow-hidden border-r border-white/10 bg-[#111a35] text-white shadow-[24px_0_70px_rgba(0,0,0,.5)] animate-portal-enter">
        <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -left-20 top-14 h-52 w-52 rounded-full bg-[#6759ff]/25 blur-3xl"/><div className="absolute -right-20 bottom-20 h-56 w-56 rounded-full bg-[#17c7c9]/15 blur-3xl"/></div>
        <div className="relative flex h-[78px] shrink-0 items-center justify-between border-b border-white/10 px-4"><BrandLockup compact inverse /><button ref={closeRef} type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-white" aria-label="Close navigation"><X className="h-5 w-5" /></button></div>
        <nav className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-4" aria-label="Mobile workspace navigation">
          <Link href="/dashboard" className={`group mb-2 flex h-12 items-center gap-3 rounded-2xl px-3.5 text-[12px] font-bold ${pathname === "/dashboard" ? "bg-white text-[#141d3b] shadow-[0_14px_35px_rgba(0,0,0,.18)]" : "text-white/90 hover:bg-white/10 hover:text-white"}`}><span className={`grid h-8 w-8 place-items-center rounded-xl ${pathname === "/dashboard" ? "bg-gradient-to-br from-[#6759ff] to-[#17c7c9] text-white" : "bg-[#E8F0FF] text-[#2F6BFF]"}`}><Gauge className="h-4 w-4" /></span><span className="flex-1">Dashboard</span></Link>
          <Link href="/customers/posp-misp" className="mb-4 flex h-11 items-center gap-3 rounded-2xl bg-gradient-to-r from-[#6759ff] to-[#17bfc5] px-3.5 text-[12px] font-bold text-white shadow-[0_12px_28px_rgba(103,89,255,.28)]"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15"><Sparkles className="h-4 w-4" /></span><span>Quick onboard</span></Link>
          <p className="mb-2 mt-4 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/65">Workspaces</p>
          <div className="space-y-1.5">{navigationSections.map((section) => { const sectionOpen = openSection === section.key; const active = resolvedSection === section.key; const SectionIcon = section.icon; return <div key={section.key} className={`overflow-hidden rounded-2xl border ${active ? "border-white/15 bg-white/10" : "border-transparent"}`}><button type="button" onClick={() => setOpenSection((current) => current === section.key && !active ? null : section.key)} className={`flex h-11 w-full items-center gap-3 px-3.5 text-left text-[12px] font-bold ${active ? "text-white" : "text-white/88 hover:bg-white/8 hover:text-white"}`} aria-expanded={sectionOpen}><span className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br ${section.tint} text-white`}><SectionIcon className="h-4 w-4" /></span><span className="flex-1">{section.label}</span><ChevronRight className={`h-4 w-4 text-white/65 transition ${sectionOpen ? "rotate-90" : ""}`} /></button>{sectionOpen ? <div className="space-y-1 px-2.5 pb-2.5 pl-[50px]">{section.items.map((item) => { const itemActive = isCurrent(item.href, pathname, currentQuery); const ItemIcon = item.icon; return <Link key={item.href} href={item.href} title={item.label} className={`group flex min-h-10 items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] font-semibold ${itemActive ? "bg-white text-[#17213e]" : "text-white/82 hover:bg-white/10 hover:text-white"}`}><ItemIcon className={`h-3.5 w-3.5 ${itemActive ? "text-[#6759ff]" : "text-white/60"}`} /><span className="truncate">{item.label}</span></Link>; })}</div> : null}</div>; })}</div>
          <div className="mt-4 border-t border-white/10 pt-3"><Link href="/settings" className="flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[12px] font-bold text-white/88 hover:bg-white/10"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10"><Settings className="h-4 w-4" /></span><span>Settings</span></Link></div>
          <div className="h-[max(1rem,env(safe-area-inset-bottom))]" />
        </nav>
      </aside>
    </div>, document.body
  ) : null;

  return <><button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#dbe2ec] bg-white text-[#1b2b49] shadow-[0_8px_24px_rgba(28,39,68,.08)] lg:hidden" aria-label="Open workspace navigation" aria-expanded={open} aria-controls="mobile-workspace-navigation"><Menu className="h-5 w-5" /></button>{drawer}</>;
}
