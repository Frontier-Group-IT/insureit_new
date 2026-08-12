"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ChevronRight, Gauge, Menu, Search, Settings, X } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import {
  MOBILE_NAVIGATION_EVENT,
  isCurrent,
  permits,
  sectionForPath,
  visibleNavigationSections,
  type NavigationItem,
  type NavigationSection,
  type SectionKey,
} from "@/components/claim-manager/app-navigation";
import { isIntermediaryOnlyLaunch } from "@/lib/launch-scope";
import type { Capability } from "@/lib/roles";
import type { PermissionAccess } from "@/lib/permission-management";

export function MobileNavigation({
  role,
  permissionAccess,
}: {
  role: string | null | undefined;
  permissionAccess: Partial<Record<Capability, PermissionAccess>>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const resolvedSection = sectionForPath(pathname);
  const sections = useMemo(() => visibleNavigationSections(role, permissionAccess), [role, permissionAccess]);
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<SectionKey | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setOpen(false);
    setScreen(null);
    setSearchQuery("");
  }, [pathname, currentQuery]);

  useEffect(() => {
    function openNavigation() {
      setOpen(true);
    }
    window.addEventListener(MOBILE_NAVIGATION_EVENT, openNavigation);
    return () => window.removeEventListener(MOBILE_NAVIGATION_EVENT, openNavigation);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  const activeSection = sections.find((section) => section.key === screen) ?? null;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearch
    ? sections
        .flatMap((section) =>
          section.items.map((item) => ({
            section,
            item,
            haystack: [section.label, item.label, item.group, ...(item.keywords ?? [])].filter(Boolean).join(" ").toLowerCase(),
          })),
        )
        .filter(({ haystack }) => haystack.includes(normalizedSearch))
        .slice(0, 16)
    : [];

  const drawer =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 isolate lg:hidden" style={{ zIndex: 2147483647 }} role="dialog" aria-modal="true" aria-label="Workspace navigation">
            <button className="absolute inset-0 h-full w-full bg-[#071027]/78 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close navigation" />
            <aside
              ref={panelRef}
              className="fixed inset-y-0 left-0 flex h-[100dvh] w-[min(92vw,360px)] flex-col overflow-hidden border-r border-white/10 bg-[#0B1430] text-white shadow-[28px_0_80px_rgba(0,0,0,.48)] animate-portal-enter"
            >
              <div className="relative flex h-[76px] shrink-0 items-center justify-between overflow-hidden border-b border-white/10 px-4">
                <div className="pointer-events-none absolute inset-0 portal-noise opacity-[0.12]" aria-hidden="true" />
                <div className="relative"><BrandLockup compact inverse /></div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  className="relative grid h-11 w-11 place-items-center rounded-[14px] bg-white/[0.07] text-white/80 hover:bg-white/[0.11] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="shrink-0 px-4 pb-3 pt-4">
                {activeSection && !normalizedSearch ? (
                  <button
                    type="button"
                    onClick={() => setScreen(null)}
                    className="mb-3 flex min-h-10 items-center gap-2 rounded-xl pr-3 text-[11px] font-bold text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Workspaces
                  </button>
                ) : null}
                <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/40">
                  {normalizedSearch ? "Search" : activeSection ? "Workspace" : isIntermediaryOnlyLaunch ? "Production workspace" : "Workspaces"}
                </p>
                <h2 className="mt-1 truncate text-[18px] font-extrabold tracking-[-0.025em] text-white">
                  {normalizedSearch ? "Jump to" : activeSection?.label ?? "Navigate INSUREIT"}
                </h2>

                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search pages and actions..."
                    aria-label="Search navigation"
                    className="h-11 w-full !rounded-xl !border-white/10 !bg-white/[0.055] !pl-9 !pr-3 !text-[12px] !font-semibold !text-white placeholder:!text-white/38 focus:!border-white/25 focus:!shadow-none"
                  />
                </div>
              </div>

              <nav className="insureit-nav-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Mobile workspace navigation">
                {normalizedSearch ? (
                  <MobileSearchResults results={searchResults} pathname={pathname} currentQuery={currentQuery} />
                ) : activeSection ? (
                  <MobileSectionDestinations section={activeSection} pathname={pathname} currentQuery={currentQuery} />
                ) : (
                  <div className="space-y-1 pt-1">
                    {!isIntermediaryOnlyLaunch && permits(permissionAccess, "view_dashboard") ? (
                      <MobileRootLink href="/dashboard" label="Dashboard" icon={Gauge} active={pathname === "/dashboard"} />
                    ) : null}

                    {sections.map((section) => {
                      const Icon = section.icon;
                      const active = resolvedSection === section.key;
                      return (
                        <button
                          key={section.key}
                          type="button"
                          onClick={() => setScreen(section.key)}
                          className={`relative flex min-h-[52px] w-full items-center gap-3 rounded-[15px] px-3.5 text-left text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${
                            active ? "bg-white/[0.09] text-white" : "text-white/76 hover:bg-white/[0.06] hover:text-white"
                          }`}
                        >
                          {active ? <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b from-[#7B6CFF] to-[#22C9D0]" aria-hidden="true" /> : null}
                          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[13px] ${active ? "bg-white/[0.08] text-[#B5AEFF]" : "bg-white/[0.045] text-white/55"}`}>
                            <Icon className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{section.label}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </nav>

              {!normalizedSearch && !activeSection && !isIntermediaryOnlyLaunch && permits(permissionAccess, "manage_system", "approve") ? (
                <div className="shrink-0 border-t border-white/[0.08] p-3">
                  <MobileRootLink href="/settings" label="Settings" icon={Settings} active={pathname === "/settings" || pathname.startsWith("/settings/")} />
                </div>
              ) : null}
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-11 w-11 place-items-center rounded-2xl border border-[#dbe2ec] bg-white text-[#1b2b49] lg:hidden"
        aria-label="Open workspace navigation"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </button>
      {drawer}
    </>
  );
}

function MobileSectionDestinations({ section, pathname, currentQuery }: { section: NavigationSection; pathname: string; currentQuery: string }) {
  const destinations = section.items.filter((item) => !item.quickAction);
  const quickActions = section.items.filter((item) => item.quickAction);
  const groups = groupedMobileItems(destinations);

  return (
    <div className="space-y-5 pt-1">
      {groups.map(([group, items]) => (
        <div key={group}>
          <p className="mb-1.5 px-3 text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-white/32">{group}</p>
          <div className="space-y-1">
            {items.map((item) => (
              <MobileContextLink key={item.href} item={item} pathname={pathname} currentQuery={currentQuery} />
            ))}
          </div>
        </div>
      ))}

      {quickActions.length ? (
        <div className="border-t border-white/[0.08] pt-4">
          <p className="mb-1.5 px-3 text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-white/32">Quick actions</p>
          <div className="space-y-1">
            {quickActions.map((item) => (
              <MobileContextLink key={item.href} item={item} pathname={pathname} currentQuery={currentQuery} quickAction />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileContextLink({ item, pathname, currentQuery, quickAction = false }: { item: NavigationItem; pathname: string; currentQuery: string; quickAction?: boolean }) {
  const active = isCurrent(item.href, pathname, currentQuery);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-[48px] items-center gap-3 rounded-[14px] px-3.5 text-[12.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${
        active ? "bg-white/[0.105] text-white" : quickAction ? "text-white/64 hover:bg-white/[0.06] hover:text-white" : "text-white/76 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {active ? <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b from-[#7B6CFF] to-[#22C9D0]" aria-hidden="true" /> : null}
      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-[#B5AEFF]" : "text-white/45"}`} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {quickAction ? <span className="text-[16px] leading-none text-white/34">+</span> : null}
    </Link>
  );
}

function MobileRootLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Gauge; active: boolean }) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-[52px] w-full items-center gap-3 rounded-[15px] px-3.5 text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${
        active ? "bg-white/[0.09] text-white" : "text-white/76 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {active ? <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b from-[#7B6CFF] to-[#22C9D0]" aria-hidden="true" /> : null}
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[13px] ${active ? "bg-white/[0.08] text-[#B5AEFF]" : "bg-white/[0.045] text-white/55"}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

function MobileSearchResults({ results, pathname, currentQuery }: { results: Array<{ section: NavigationSection; item: NavigationItem }>; pathname: string; currentQuery: string }) {
  if (!results.length) {
    return <p className="px-3 py-4 text-[11px] leading-5 text-white/42">No matching destination is available for your permissions.</p>;
  }

  return (
    <div className="space-y-1 pt-1">
      {results.map(({ section, item }) => (
        <div key={`${section.key}:${item.href}`}>
          <p className="px-3 pt-2 text-[8px] font-extrabold uppercase tracking-[0.14em] text-white/28">{section.label}</p>
          <MobileContextLink item={item} pathname={pathname} currentQuery={currentQuery} quickAction={Boolean(item.quickAction)} />
        </div>
      ))}
    </div>
  );
}

function groupedMobileItems(items: NavigationItem[]) {
  const groups = new Map<string, NavigationItem[]>();
  for (const item of items) {
    const key = item.group ?? "Workspace";
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }
  return Array.from(groups.entries());
}
